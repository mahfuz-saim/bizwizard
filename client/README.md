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
- **Expenses / Debts / Employees / Messages / Reports** — supporting modules
- Collapsible sidebar, mobile drawer, theme toggle, top bar search
- Mock data layer that can be swapped for real API calls in `src/lib/store.tsx`

## Getting Started

Create your local env file and point it at the running backend:

```bash
cp .env.example .env.local
# edit .env.local and set NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
```

The backend Express server already CORS-allows `http://localhost:3000` with credentials, so the client calls it directly (no dev proxy is required).

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
│   │   ├── messages/ employees/ reports/
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

The data layer (`src/lib/store.tsx`) always renders immediately:
- **When the backend is reachable**, it loads `/product` (paginated shop variants) and best-effort loads `/analytics`, wiring Add/Sell mutations to `/product/catalog`, `/product/:id` and `/checkout/quick`.
- **When the backend is unreachable or unauthenticated**, it falls back to realistic demo data (from `src/lib/mock-data.ts`) so the UI stays usable for development / demos. Mutations remain fully interactive against the local state.
- The store exposes `source: "backend" | "mock" | "loading"` and `refresh()` for the UI status indicator and manual reconnect.

## Authentication

Unauthenticated visits show login, Create account, Reset password (phone OTP), and Run Demo options. Stored sessions are validated against `/auth/me`. Backend failures never fall back to demo data. Demo changes are temporary and local; use the profile menu to exit demo or log out. Modules not yet connected to backend data start empty for real accounts.
