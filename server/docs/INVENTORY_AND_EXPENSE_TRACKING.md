# Inventory and Expense Tracking System

## Overview
This document explains the design decisions and implementation details for tracking product purchases, inventory updates, and deletions in the bebsapati system.

---

## Core Principles

### 1. **Immutable Expense Records**
Once a purchase is recorded in `ExpenseItem`, it is **never modified or deleted**. This maintains an accurate audit trail of all cash outflows.

### 2. **Separate Purchase and Loss Tracking**
- **Purchases** → Recorded in `ExpenseItem` (when money is spent)
- **Losses** → Recorded in `LotDeletion` (when inventory is damaged, expired, or returned)

### 3. **Multiple Lots Per Variant**
A single `ShopVariant` (e.g., "Coca Cola 500ml") can have multiple `Lot` records representing different purchase batches with:
- Different buy prices
- Different suppliers
- Different expiry dates
- Different manufacturing dates

---

## Three Core Events

### 1. Purchase Event (Create)
**Trigger:** `addProductInShop()` service function

**What happens:**
1. Creates a new `Lot` record with stock, prices, dates
2. Creates an `ExpenseItem` record with full tracking:
   - `amount`: Total cost (quantity × unitPrice)
   - `shopVariantId`: Links to the variant
   - `lotId`: Links to the specific lot
   - `supplierId`: Links to supplier (if provided)
   - `quantity`: Number of units purchased
   - `unitPrice`: Buy price per unit
3. Updates `Expense` monthly aggregate
4. Updates `ShopVariant.totalProducts`

**Example:**
```typescript
// First purchase
addProductInShop({
    variantId: "variant-123",
    lot: { stock: 10, buyPrice: 5, expDate: "2026-01-15" }
})
// Creates: Lot 1 (10 units) + ExpenseItem 1 ($50)

// Later restock (same variant, different batch)
addProductInShop({
    variantId: "variant-123",
    lot: { stock: 8, buyPrice: 5.50, expDate: "2026-03-20" }
})
// Creates: Lot 2 (8 units) + ExpenseItem 2 ($44)
// Total: 18 units across 2 lots, $94 total expense
```

**Why this design:**
- ✅ Each purchase is tracked separately
- ✅ Can track different prices and suppliers per batch
- ✅ Clear audit trail (each ExpenseItem = one purchase event)
- ✅ Supports FIFO/FEFO inventory management

---

### 2. Update Event (Modify)
**Trigger:** `updateLotInShop()` service function

**What happens:**
1. **Directly updates** the existing `Lot` record
2. **Only allows** updating these fields:
   - `mrp`, `isMRPDefault`, `retail`, `includeVAT`
   - `sellPrice`, `vat`
   - `mfgDate`, `expDate`
   - `locationAtStore`, `note`
3. **Does NOT allow** updating:
   - ❌ `stock` (use create for new purchases, delete for removals)
   - ❌ `buyPrice` (immutable once purchased)
4. No expense changes (prices/dates are just corrections)

**Example:**
```typescript
// Fix expiry date or update sell price
updateLot(lotId, { 
    expDate: "2026-02-15",
    sellPrice: 7.99,
    locationAtStore: "Shelf A3"
})
// Only updates lot properties, no financial impact
```

**Why this design:**
- ✅ Prevents accidental stock manipulation
- ✅ Buy price remains accurate (can't be changed after purchase)
- ✅ Updates are for corrections/adjustments, not inventory changes
- ✅ No ambiguity about whether update = new purchase or correction

**Previous implementation problem:**
The old `updateLotInShop` would delete the lot and create a new one. This created issues:
- Lost the link between ExpenseItem and Lot
- Unclear if stock increase = new purchase or correction
- Difficult to track inventory history

---

### 3. Deletion Event (Remove)
**Trigger:** `deleteLotInShop()` service function

**What happens:**
1. Validates stock amount and loss calculation
2. Creates a `LotDeletion` record tracking:
   - Stock removed
   - Financial loss amount
   - Reason (EXPIRED, DAMAGED, RETURNED)
   - Loss type (FULL_LOSS, PARTIAL_LOSS, NO_LOSS)
3. **Full deletion** (if deleting all remaining stock):
   - Marks lot status as `DELETED`
4. **Partial deletion** (if deleting some stock):
   - Reduces lot stock by deleted amount
   - Keeps status as `ACTIVE`
5. Updates `ShopVariant.totalProducts`
6. **Does NOT change ExpenseItem** (expense already incurred)

**Loss Amount Validation:**
- `FULL_LOSS`: `lossAmount` must equal `stock × buyPrice`
- `PARTIAL_LOSS`: `0 < lossAmount < stock × buyPrice`
- `NO_LOSS`: `lossAmount` must be `0`

**Example:**
```typescript
// Original: Lot has 10 units @ $5
// Sold: 3 units → 7 remaining

// Scenario A: Partial deletion (3 units expired)
deleteLotInShop({
    lotId: "lot-1",
    stock: 3,
    lossAmount: 15,  // 3 × $5
    lossType: "FULL_LOSS",
    reason: "EXPIRED"
})
// Result: Lot has 4 units, LotDeletion record created
// ExpenseItem unchanged: still shows $50 original purchase

// Scenario B: Full deletion (remaining 4 units damaged)
deleteLotInShop({
    lotId: "lot-1",
    stock: 4,
    lossAmount: 20,  // 4 × $5
    lossType: "FULL_LOSS",
    reason: "DAMAGED"
})
// Result: Lot status = DELETED, another LotDeletion record
// ExpenseItem unchanged: still shows $50 original purchase
```

**Why this design:**
- ✅ ExpenseItem reflects actual cash spent (never changes)
- ✅ LotDeletion tracks when/why inventory was lost
- ✅ Can calculate net inventory value: purchases - losses
- ✅ Supports partial deletions (e.g., some damaged, rest sellable)
- ✅ Clear separation between purchase cost and inventory loss

---

## Schema Relationships

```
ShopVariant (e.g., "Coca Cola 500ml")
  │
  ├─► Lot 1 (10 units, $5/unit, expires Jan 2026)
  │     └─► ExpenseItem 1 ($50, 10 units, $5/unit)
  │     └─► LotDeletion 1 (3 units expired, $15 loss)
  │
  ├─► Lot 2 (8 units, $5.50/unit, expires Mar 2026)
  │     └─► ExpenseItem 2 ($44, 8 units, $5.50/unit)
  │
  └─► Lot 3 (15 units, $5.20/unit, expires Feb 2026)
        └─► ExpenseItem 3 ($78, 15 units, $5.20/unit)
        └─► LotDeletion 2 (5 units damaged, $10 partial loss)
```

---

## Key Calculations

### 1. Total Purchase Cost for a Variant
```typescript
const totalPurchases = await prisma.expenseItem.aggregate({
    where: { 
        expenseType: 'PRODUCT',
        shopVariantId: variantId 
    },
    _sum: { amount: true }
});

// Result: Sum of all money spent purchasing this variant
```

### 2. Total Inventory Loss for a Variant
```typescript
const totalLosses = await prisma.lotDeletion.aggregate({
    where: { shopVariantId: variantId },
    _sum: { lossAmount: true }
});

// Result: Sum of all financial losses (expired, damaged, etc.)
```

### 3. Net Inventory Investment
```typescript
const netInvestment = totalPurchases._sum.amount - totalLosses._sum.lossAmount;

// Result: Current money invested in this variant's inventory
```

### 4. Purchase History with Details
```typescript
const purchaseHistory = await prisma.expenseItem.findMany({
    where: {
        expenseType: 'PRODUCT',
        shopVariantId: variantId
    },
    include: {
        supplier: true,
        lot: {
            select: {
                stock: true,
                expDate: true,
                status: true
            }
        }
    },
    orderBy: { createdAt: 'desc' }
});

// Result: List of all purchases with dates, suppliers, quantities, prices
```

### 5. Loss History with Reasons
```typescript
const lossHistory = await prisma.lotDeletion.findMany({
    where: { shopVariantId: variantId },
    include: {
        Lot: {
            select: {
                ShopVariant: {
                    select: { name: true }
                }
            }
        }
    },
    orderBy: { deletionDate: 'desc' }
});

// Result: List of all losses with dates, reasons, amounts
```

### 6. Current Available Stock
```typescript
const currentStock = await prisma.lot.aggregate({
    where: {
        shopVariantId: variantId,
        status: 'ACTIVE'
    },
    _sum: { stock: true }
});

// Result: Total sellable units currently in inventory
```

### 7. Average Buy Price
```typescript
const stats = await prisma.expenseItem.aggregate({
    where: {
        expenseType: 'PRODUCT',
        shopVariantId: variantId
    },
    _sum: { 
        amount: true,
        quantity: true 
    }
});

const avgBuyPrice = stats._sum.amount / stats._sum.quantity;

// Result: Average price paid per unit across all purchases
```

### 8. Supplier Performance Analysis
```typescript
const supplierPurchases = await prisma.expenseItem.groupBy({
    by: ['supplierId'],
    where: {
        expenseType: 'PRODUCT',
        supplierId: { not: null }
    },
    _sum: {
        amount: true,
        quantity: true
    },
    _count: true
});

// Result: Total spent, quantity purchased, number of orders per supplier
```

### 9. Monthly Purchase Trends
```typescript
const monthlyPurchases = await prisma.expenseItem.findMany({
    where: {
        expenseType: 'PRODUCT',
        shopVariantId: variantId,
        createdAt: {
            gte: new Date('2025-01-01'),
            lt: new Date('2026-01-01')
        }
    },
    orderBy: { createdAt: 'asc' }
});

// Group by month to analyze purchase patterns
```

### 10. Profitability Analysis
```typescript
// Get total purchase cost
const purchaseCost = await prisma.expenseItem.aggregate({
    where: { 
        expenseType: 'PRODUCT',
        shopVariantId: variantId 
    },
    _sum: { amount: true }
});

// Get total sales revenue (from CheckoutItem)
const revenue = await prisma.checkoutItem.aggregate({
    where: {
        Lot: {
            shopVariantId: variantId
        }
    },
    _sum: { discountedPrice: true }
});

// Get total losses
const losses = await prisma.lotDeletion.aggregate({
    where: { shopVariantId: variantId },
    _sum: { lossAmount: true }
});

const profit = revenue._sum.discountedPrice - purchaseCost._sum.amount;
const netProfit = profit + losses._sum.lossAmount; // losses are already negative impact

// Result: Profit margin for this variant
```

---

## Business Rules

### Rule 1: One Purchase = One ExpenseItem
Every time `addProductInShop` is called, exactly one `ExpenseItem` is created, linking to the created `Lot`.

### Rule 2: Stock Changes Only Through Create/Delete
- **Increase stock** → Call `addProductInShop` (new purchase)
- **Decrease stock** → Call `deleteLotInShop` (loss/damage) OR sell through checkout
- **Update prices/dates** → Call `updateLotInShop` (corrections only)

### Rule 3: Expenses Are Immutable
Once recorded, `ExpenseItem` records are never modified or deleted. They represent historical cash outflows.

### Rule 4: Losses Are Tracked Separately
`LotDeletion` records track inventory losses but don't modify the original purchase expense.

### Rule 5: Partial Deletions Allowed
A lot can be partially deleted multiple times until fully depleted or deleted.

---

## Frontend Implementation Notes

### Add Stock Form
- Reuses the "Add Product" form
- Pre-fills variant selection
- Creates new lot for the same variant
- Labels as "Restock" or "Add Inventory"

### Update Lot Form
- Only shows: MRP, Retail, Sell Price, VAT, Dates, Location, Notes
- **Hides:** Stock, Buy Price (not editable)
- Clear label: "Update Lot Properties"

### Delete Stock Form
- Requires: Stock amount, Loss amount, Loss type, Reason
- Validates loss amount based on loss type
- Shows calculation helper: `Loss Amount = Stock × Buy Price`
- Supports partial deletion with remaining stock display

---

## Migration Considerations

### Existing Data
Existing `ExpenseItem` records will have `NULL` values for new fields:
- `shopVariantId`, `lotId`, `supplierId`, `quantity`, `unitPrice`

This is acceptable as they represent historical data before the tracking enhancement.

### Future Purchases
All new purchases (after migration) will have complete tracking information.

### Backfilling (Optional)
If needed, a data migration script could attempt to link existing expenses to lots based on:
- Timestamp matching (expense.createdAt ≈ lot.createdAt)
- Amount matching (expense.amount ≈ lot.stock × lot.buyPrice)
- Name matching (expense.name ≈ variant.name)

However, this may not be accurate and is not recommended unless critical.

---

## Testing Scenarios

### Scenario 1: Normal Purchase Flow
1. Purchase 10 units @ $5 → Creates Lot + ExpenseItem ($50)
2. Sell 3 units → Lot stock: 7
3. Restock 8 units @ $5.50 → Creates new Lot + ExpenseItem ($44)
4. Total: 15 units, $94 spent

### Scenario 2: Partial Expiry
1. Purchase 10 units @ $5 → $50 expense
2. Sell 3 units → 7 remaining
3. 3 units expire → LotDeletion ($15 loss), 4 remaining
4. Net: 4 units, $50 spent, $15 lost, $35 inventory value

### Scenario 3: Price Correction
1. Purchase 10 units, accidentally enter $5.50
2. Update lot: change to correct prices/dates
3. Stock remains 10, no expense changes

### Scenario 4: Supplier Return
1. Purchase 20 units @ $10 → $200 expense
2. Return 5 defective units → LotDeletion ($0 loss, NO_LOSS type)
3. Stock: 15, Expense: $200, Loss: $0
4. (Future: track refund as income separately)

---

## Future Enhancements

### 1. Refund Tracking
Add `ExpenseAdjustment` table to track supplier refunds:
```prisma
model ExpenseAdjustment {
    id              String      @id
    expenseItemId   String
    expenseItem     ExpenseItem
    adjustmentAmount Float      // Negative for refunds
    reason          String
    lotDeletionId   String?
    createdAt       DateTime
}
```

### 2. Inventory Alerts
- Low stock alerts (based on `ShopVariant.lowStock`)
- Expiry alerts (based on `Lot.expDate`)
- Not-sold alerts (based on `ShopVariant.lastSoldDate`)

### 3. Advanced Analytics
- Turnover ratio (sales / average inventory)
- Dead stock identification (no sales in X days)
- Supplier reliability scoring
- Seasonal purchase pattern analysis

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-12-21 | System | Initial documentation |

