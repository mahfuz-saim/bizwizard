# todo after deployment

- add app version
- add trial plan
- add other subscription plans

## Transactional development seed

Configure a **development PostgreSQL database** in `server/.env` (`DATABASE_URL`),
install dependencies, and apply the existing migrations before seeding:

```bash
cd server
npm ci
npx prisma migrate deploy
npm run seed
```

`npm run seed` generates the Prisma client, creates the following active owner
accounts and their independent tenants/shops, prints a summary, then exits:

| Login email | Password (development only) | History | Shop | Products | Customers |
| --- | --- | --- | --- | --- | --- |
| `ownery@mail.com` | `BizWizard@2026!` | Two calendar years through seed time | Gazipur Family Mart | 120 | 180 |
| `ownerw@mail.com` | `BizWizard@2026!` | Seven calendar days, including today | Dhaka Neighbourhood Store | 120 | 60 |

The history is relative to the time of the **first seed**, not hardcoded dates.
The long-history owner has ID `seed-v2-year-user-0`; the short-history owner has
ID `seed-v2-week-user-0`. Login with the email, not the internal ID.

Each shop has eight suppliers, three pack sizes for 40 everyday grocery and
household products, repeat customers, daily sales (busier Fridays), item/cart
discounts, FIFO stock purchases, monthly operating expenses, and paid/part-paid/
unpaid credit sales with chronological payment and debt-ledger histories. Every
purchase is linked to a supplier, lot, and product expense; remaining lot stock
matches the product stock. All customer contacts are synthetic; no SMS or other
external services are called. Customers/suppliers are not given login passwords.
Passwords for the two owners use the same salted hashing helper as backend login.

### Safety and reruns

- This replaces the old global-delete seed: unrelated existing data is **not deleted**.
- Each owner and all their data are inserted in one transaction, using chunked
  bulk inserts. A failed account rolls back completely and can be retried.
- Rerunning normally skips accounts already created by this seed, preserving
  edits, passwords, and history. It does not duplicate data.
- To replace the earlier fixture with the expanded activity history, run
  `npm run seed -- --refresh`. This **replaces generated products, stock, sales,
  expenses, and other activity** for these two seed shops only, relative to the
  current date. Owner/customer/supplier profiles and passwords are preserved.
  Cleanup and re-insertion run in the same transaction per shop. There are no
  global deletes. If manually-added records reference generated stock/history,
  foreign-key protection aborts the refresh rather than deleting those records;
  use a fresh development database in that case.
- An existing non-seed user with either requested email causes an error rather
  than being overwritten. Use a separate, freshly migrated development database
  to regenerate a fresh history window.
- The script refuses to run when `NODE_ENV=production`: these are public test
  passwords and must not be used for real business accounts.
- `prisma/seed/demo-seed.ts` is an older standalone fixture with hardcoded shop
  IDs. It is **not** invoked by `npm run seed`.

### Integrity checks

```bash
npm run seed:test
```

The deterministic generator tests check date windows (including a leap-year
boundary), tenant separation, foreign-key links, sale/expense totals, inventory
conservation, payment/debt totals, running debt balances, no future transactions,
and repeatability. These tests generate fixtures in memory and do not alter a
database. Actual counts vary with the date; for 16 October 2026 the fixture has
about 15,500 sales for the long-history shop and 125 for the short-history shop.

### Full shop activity history

The fixtures are operational histories, not just catalog records. Both windows
include:

- Customer-linked purchases **on every calendar day**, with each customer having
  purchase history and returning customers buying again.
- Sales by the owner and three employees, with daily attendance and late/absent
  shifts. Employee sales are attributed to an employee who was present.
- Small opening quantities for fast movers in the new shop; subsequent supplier
  deliveries and FIFO sell-through create repeat purchases within the first week.
  The long-history shop has restocks throughout every month of its two years.
- Purchase expenses connected to suppliers and lots, discounts, paid/part-paid/
  unpaid sales, and customers returning on later days to repay credit.
- Daily pickup orders, completed/paid pickups, canceled/released reservations,
  and recent pending/processing pickups. Their stock reservations are counted
  separately from checkout sales, without double-counting transactions.
- Damaged delivery write-offs, goods returned to suppliers, associated stock
  adjustment/loss records, rent, wages, utilities, transport, and completed/open
  supplier and customer follow-up notes.

Every generated stock balance reconciles to purchased quantity minus checkout
sales, non-canceled pickup reservations, and stock adjustments. All historical
activity is dated inside the selected account's time window. No real orders,
SMS messages, payments, or supplier notifications are sent.

For the deterministic 16 October 2026 test fixture, the two-year shop has 15,492
sales, 1,833 purchase lots, 731 pickup orders, and 54 stock adjustments. The
one-week shop has 124 sales, 208 purchase lots, seven pickup orders, and two stock
adjustments; 50 products have repeat purchases within that week. Exact counts
vary with the seed date.
