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
- Rerunning skips accounts already created by this seed, preserving edits,
  passwords, and history. It does not advance their history or duplicate data.
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
about 15,200 sales for the long-history shop and 160 for the short-history shop.
