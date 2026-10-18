-- Keep cash events in the same transaction as their source, including nested writes.
CREATE FUNCTION finance_sync_event(kind text, event_id text, include_demo boolean DEFAULT false) RETURNS void AS $$
DECLARE
  tenant_id text; shop_id text; event_amount double precision; event_at timestamp;
  account_id text; direction_value "CashDirection"; category_value "CashCategory";
  source_value "CashTransactionSource"; simulated boolean; removed record;
  ledger_id text := 'event-' || kind || '-' || event_id;
BEGIN
  IF kind = 'sale' THEN
    SELECT c."tenantID", c."shopID", c."totalPrice", c."createdAt", c."isSimulated"
    INTO tenant_id, shop_id, event_amount, event_at, simulated
    FROM checkouts c WHERE c.id = event_id AND NOT c."isDraft" AND c.status = 'PAID'
      AND NOT EXISTS (SELECT 1 FROM debt d WHERE d."checkoutID" = c.id);
    direction_value := 'IN'; category_value := 'SALES_COLLECTION'; source_value := 'SALE';
  ELSIF kind = 'payment' THEN
    SELECT d."tenantID", d."shopID", p.amount, p."createdAt", p."isSimulated"
    INTO tenant_id, shop_id, event_amount, event_at, simulated
    FROM "DebtPayments" p JOIN debt d ON d.id = p."debtId" WHERE p.id = event_id;
    direction_value := 'IN'; category_value := 'INVOICE_PAYMENT'; source_value := 'DEBT_PAYMENT';
  ELSIF kind = 'expense' THEN
    SELECT e."tenantID", x."shopID", e.amount, e."createdAt", e."isSimulated",
      CASE WHEN e."expenseType" = 'PRODUCT' THEN 'PRODUCT_PURCHASE'::"CashCategory"
           WHEN e."expenseType" = 'EMPLOYEE_SALARY' THEN 'SALARY'::"CashCategory"
           ELSE 'OPERATING_EXPENSE'::"CashCategory" END
    INTO tenant_id, shop_id, event_amount, event_at, simulated, category_value
    FROM expense_item e JOIN expense x ON x.id = e."expenseID" WHERE e.id = event_id;
    direction_value := 'OUT'; source_value := 'EXPENSE';
  ELSE
    RAISE EXCEPTION 'Unknown finance event';
  END IF;
  IF simulated OR (NOT include_demo AND EXISTS (SELECT 1 FROM shops WHERE id = shop_id AND "simulationSourceShopID" IS NOT NULL)) THEN
    RETURN;
  END IF;
  -- Replace the old imported representation of this event, not manual entries.
  FOR removed IN DELETE FROM cash_transactions WHERE id = ledger_id OR
    ("sourceRefID" = event_id AND source = 'BACKFILL' AND
     (tenant_id IS NULL OR ("tenantID" = tenant_id AND "shopID" = shop_id))) RETURNING *
  LOOP
    IF removed.status = 'CLEARED' THEN
      UPDATE cash_accounts SET "currentBalance" = ROUND(("currentBalance" -
        CASE WHEN removed.direction = 'IN' THEN removed.amount ELSE -removed.amount END)::numeric,2), "updatedAt" = NOW()
        WHERE id = removed."accountID";
    END IF;
  END LOOP;
  IF event_amount < 0 THEN
    event_amount := -event_amount;
    direction_value := CASE WHEN direction_value = 'IN' THEN 'OUT'::"CashDirection" ELSE 'IN'::"CashDirection" END;
  END IF;
  IF tenant_id IS NOT NULL AND event_amount > 0 THEN
    event_amount := ROUND(event_amount::numeric,2);
    SELECT id INTO account_id FROM cash_accounts
      WHERE "tenantID" = tenant_id AND "shopID" = shop_id AND "isActive" AND currency = 'BDT'
      ORDER BY "isPrimary" DESC, id LIMIT 1;
    IF account_id IS NULL THEN
      account_id := 'event-cash-' || shop_id;
      INSERT INTO cash_accounts (id,"tenantID","shopID",name,"accountType",currency,"openingBalance","currentBalance","isPrimary","isActive","createdAt","updatedAt")
        VALUES (account_id,tenant_id,shop_id,'Daily Cash Box','CASH','BDT',0,0,true,true,NOW(),NOW())
        ON CONFLICT (id) DO NOTHING;
    END IF;
    INSERT INTO cash_transactions (id,"tenantID","shopID","accountID",direction,amount,category,"occurredAt",source,"sourceRefID",status,"aiCategorized","isBackfilled","isSimulated","createdAt","updatedAt")
      VALUES (ledger_id,tenant_id,shop_id,account_id,direction_value,ROUND(event_amount::numeric,2),category_value,event_at,source_value,event_id,'CLEARED',false,false,false,NOW(),NOW());
    UPDATE cash_accounts SET "currentBalance" = ROUND(("currentBalance" +
      CASE WHEN direction_value = 'IN' THEN event_amount ELSE -event_amount END)::numeric,2), "updatedAt" = NOW()
      WHERE id = account_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION finance_event_trigger() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM finance_sync_event(TG_ARGV[0], OLD.id);
    RETURN OLD;
  END IF;
  PERFORM finance_sync_event(TG_ARGV[0], NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER finance_sale AFTER INSERT OR UPDATE OR DELETE ON checkouts
  FOR EACH ROW EXECUTE FUNCTION finance_event_trigger('sale');
CREATE TRIGGER finance_payment AFTER INSERT OR UPDATE OR DELETE ON "DebtPayments"
  FOR EACH ROW EXECUTE FUNCTION finance_event_trigger('payment');
CREATE TRIGGER finance_expense AFTER INSERT OR UPDATE OR DELETE ON expense_item
  FOR EACH ROW EXECUTE FUNCTION finance_event_trigger('expense');
