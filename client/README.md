# BizWizard Web Client

Modern web frontend for BizWizard — an inventory & sales management system.

## Tech Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** with a blue-centric brand palette matching the mobile app
- **shadcn/ui**-style components (built on Radix UI primitives)
- **Lucide Icons**
- Light / dark / system theme support with persistence

## Features

- **Dashboard** — today&apos;s sales, profit, debt, quick actions, low-stock alerts, recent transactions
- **Inventory** — product list with search, category/stock filters, sorting, add/buy/sell/edit/delete, detail page
- **Add Product** — full dialog with name, variant, SKU, barcode, category, unit, pricing, expiry
- **Buy Stock** — purchase dialog with supplier selection, multi-line items, partial payment / due tracking, auto stock update
- **Sell (POS)** — point-of-sale dialog with customer selection, payment method, discount, partial payment/due, over-stock validation, success screen
- **Sales** — transactions list with tabs (All / Sales / Purchases), stats, search
- **Customers / Suppliers** — contact cards with due balances
- **Expenses / Debts / Employees / Reports** — supporting modules
- Collapsible sidebar, mobile drawer, theme toggle, top bar search
- Mock data layer that can be swapped for real API calls in `src/lib/store.tsx`

## Getting Started

Create your local env file and point it at the running backend:

```bash
cp .env.example .env.local
# edit .env.local and set NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
```

The browser uses the same-origin Next.js API proxy, so it does not need direct backend access or cross-origin CORS configuration.

```bash
cd client
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

A small status chip in the top bar shows whether you are running against the **Live** backend or **Demo data** (only after explicitly clicking **Run Demo**). Click the chip (or use the profile menu) to retry the connection.

## Project Structure

```
src/
├── app/                      # Next.js App Router pages
│   ├── (dashboard)/          # App pages under sidebar layout
│   │   ├── page.tsx          # Dashboard
│   │   ├── inventory/        # Inventory list + [id] detail
│   │   ├── sales/ customers/ suppliers/ expenses/ debts/
│   │   ├── employees/ reports/
│   │   ├── sell/  buy/       # Dedicated POS/purchase entry pages
│   │   └── layout.tsx        # Sidebar + topbar shell
│   ├── globals.css           # Tailwind + theme tokens
│   └── layout.tsx            # Root layout (theme + store providers)
├── components/
│   ├── ui/                   # shadcn-style primitives
│   ├── inventory/            # Add/Buy/Sell dialogs
│   ├── sidebar.tsx           # Navigation sidebar
│   ├── topbar.tsx            # Top bar with search, theme, profile
│   ├── theme-provider.tsx    # Light/dark mode
│   ├── recent-transactions.tsx
│   └── low-stock-alert.tsx
└── lib/
    ├── store.tsx             # App state (swap for API calls)
    ├── mock-data.ts          # Seed data
    ├── types.ts              # TypeScript types
    └── utils.ts              # cn(), formatting helpers
```

## API Integration

The API client lives in `src/lib/api.ts`. It:

- Reads `NEXT_PUBLIC_API_BASE_URL` from env (defaults to `http://localhost:5000/api/v1`)
- Sends `credentials: "include"` so httpOnly refresh cookies from `/auth/*` flow through
- Attaches a bearer token from `localStorage` (set via `setAccessToken(...)` after login)
- Normalises the backend&apos;s shop-variant response into the frontend `Product` type via `normalizeShopVariant()`

The data layer validates `/auth/me`, resolves the tenant and shop, then loads real shop data.
API failures show a retry screen; they are never represented as zero balances or demo data.
Demo data is loaded only after **Run Demo** is clicked.

### Connected reads

- `/shop/:shopId?includeProduct=true` — products, FIFO lots and last-known prices
- `/buyer/shop-buyer/:shopId` — shop customers, using `buyerID` for checkout identity
- `/supplier/:shopId` — shop suppliers (purchase requests use the supplier's user ID)
- `/checkout?shopId=...` — posted sales, line items, historical lot costs, debt payments, cashier
- `/expense/shop/:shopId` — purchase history and operating expenses (owner only)
- `/employee?shopID=...` — staff for the selected shop (owner only)
- `/analytics?shopId=...&startDate=...&endDate=...` — today's and yesterday's analytics
- `/notifications/:shopId` — recorded notifications

Paginated service envelopes are nested under `response.data.{data,meta}`. The loader
fetches every page with bounded concurrency, so a two-year history is not truncated
at the first 10/200/500 records. Refresh uses a new server snapshot. Stale requests
cannot overwrite a later login, logout, or demo selection.

All browser requests use `/api/proxy/v1`, rewritten by Next.js to
`NEXT_PUBLIC_API_BASE_URL`. That variable points to the backend **from the Next
server**, not from the user's browser. Requests include credentials, bearer token,
`x-tenant-id`, and `cache: no-store`. Restart/rebuild Next after changing the URL.

### Connected writes and limitations

- Add product / buy stock: `POST /product`, including the required lot payload.
- Sell: `POST /checkout`, allocating requested quantities across real FIFO lot IDs;
  partial payment uses `paidAmount` and requires an existing customer.
- Edit variant: `PUT /product/:id` with backend field names such as `lowStock`;
  sell prices/expiry use `PUT /product/lot/:lotId`.
- Delete variant: `DELETE /product/:id`; errors are displayed, not silently removed locally.

Dialogs await saves and display backend errors. There are no optimistic-only live
transactions. A multi-item stock purchase uses one backend request per line; if a
later line fails, the error reports the number saved so those lines aren't retried.
The backend does not store supplier payment balances or payment channels. The UI
labels these as not tracked/recorded instead of inventing a cash payment or settled
balance. Live purchases currently require full payment. Catalog identity fields and
historical purchase costs cannot be edited through the variant API. Invitation,
payment-recording and export controls aren't connected yet.

Reports use actual transaction dates and historical lot costs. They no longer
multiply revenue or display placeholder growth percentages/charts. Daily analytics
and report date boundaries currently use UTC, matching backend analytics.

### Checks

```bash
npm test                       # transport, pagination, normalization, reads and FIFO writes
npm run test:backend-contract   # actual backend Zod schemas; requires server dependencies/client generation
npm run build
```

## Authentication

Unauthenticated visits show login, Create account, Reset password (phone OTP), and Run Demo options. Stored sessions are validated against `/auth/me`. Backend failures never fall back to demo data. Demo changes are temporary and local; use the profile menu to exit demo or log out. Restricted staff and expense records are identified as owner-only.
