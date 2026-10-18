-- AlterTable
ALTER TABLE "cash_commitments" ADD COLUMN "paymentExpenseID" TEXT,
ADD COLUMN "supplierPayable" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "cash_commitments_paymentExpenseID_key" ON "cash_commitments"("paymentExpenseID");

CREATE FUNCTION protect_supplier_payment_evidence() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM cash_commitments WHERE "paymentExpenseID" = OLD.id) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Purchase is linked to settled supplier evidence';
    END IF;
    IF NEW.amount <> OLD.amount OR NEW."expenseID" <> OLD."expenseID" OR NEW."tenantID" <> OLD."tenantID" OR NEW."expenseType" <> OLD."expenseType" OR NEW."createdAt" <> OLD."createdAt" OR NEW."isSimulated" <> OLD."isSimulated" THEN
      RAISE EXCEPTION 'Purchase is linked to settled supplier evidence';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER protect_supplier_payment BEFORE DELETE ON expense_item
  FOR EACH ROW EXECUTE FUNCTION protect_supplier_payment_evidence();
CREATE TRIGGER protect_supplier_payment_update BEFORE UPDATE ON expense_item
  FOR EACH ROW EXECUTE FUNCTION protect_supplier_payment_evidence();
