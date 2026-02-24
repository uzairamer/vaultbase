# Vaultbase - Claude Code Context

## Project Overview

**Vaultbase** is a personal wealth management web app built with Next.js (App Router). It tracks expenses, investments (stocks, commodities, real estate), and provides financial insights including live stock data and portfolio analytics.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15+ (App Router), React 19, TypeScript 5 |
| Styling | TailwindCSS 4, shadcn/ui (Radix UI), Lucide icons |
| Auth | NextAuth 5 (beta) — JWT strategy, Credentials + Google OAuth |
| Database | PostgreSQL via Prisma 5 ORM |
| Data fetching | TanStack React Query 5 |
| Tables | TanStack React Table 8 |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Notifications | Sonner (toasts) |
| Utilities | date-fns, bcryptjs, papaparse |

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # login, register pages
│   ├── (dashboard)/         # protected pages
│   │   ├── dashboard/       # overview/net worth
│   │   ├── expenses/        # wallets, transactions, categories
│   │   ├── insights/        # stock charts, heatmaps, watchlist
│   │   └── investments/     # stocks, commodities, real estate, other
│   └── api/
│       ├── auth/            # NextAuth + register
│       ├── expenses/        # wallets, transactions, categories, receivables, liabilities, import
│       ├── insights/        # aggregate, watchlist, stock-live, stock-history
│       └── investments/     # stocks, commodities, real-estate, other
├── components/
│   ├── ui/                  # shadcn/ui primitives
│   ├── layout/              # Sidebar, Topbar
│   └── shared/              # StatCard, DataTable, etc.
├── lib/
│   ├── auth.ts              # NextAuth config
│   ├── prisma.ts            # Prisma client singleton
│   ├── constants.ts         # App-wide constants
│   └── utils.ts             # cn(), formatters
├── modules/
│   ├── auth/                # Zod schemas, auth components
│   ├── expenses/            # React Query hooks
│   ├── insights/            # Stock hooks (live, history, watchlist)
│   └── investments/         # React Query hooks
├── providers/               # SessionProvider, ThemeProvider, QueryProvider
└── types/                   # Shared TypeScript types
```

## Database Schema (Prisma)

Key models grouped by domain:

**Auth:** `User`, `Account`, `Session`, `VerificationToken`

**Expenses:** `Wallet`, `Transaction`, `Category`, `Receivable`, `ReceivablePayment`, `Liability`, `LiabilityPayment`

**Investments:** `Property`, `Installment`, `StockHolding`, `StockTrade`, `CommodityHolding`, `CommodityTrade`, `SideInvestment`, `WatchlistItem`

- Financial amounts use `Decimal` (15,2 precision)
- All user data is scoped by `userId` for isolation
- Status enums: `pending`, `partial`, `settled`, `active`, `sold`

## API Conventions

- All routes require authentication (`session.user.id`)
- Standard REST: GET/POST/PUT/DELETE on resource routes
- HTTP status codes: 201 (created), 400 (validation), 401 (auth), 404 (not found)
- Request validation via Zod
- User-scoped queries always filter by `userId`

## Authentication

- **Strategy:** JWT (NextAuth 5 beta)
- **Providers:** Credentials (email + bcrypt, 12 salt rounds) + optional Google OAuth
- **Middleware:** All routes protected except `/login`, `/register`, `/api/auth/*`
- **Session:** `session.user.id` injected via JWT callback

## Environment Variables

```
DATABASE_URL          # PostgreSQL connection string
NEXTAUTH_URL          # e.g. http://localhost:7190
NEXTAUTH_SECRET       # JWT secret
GOOGLE_CLIENT_ID      # Optional
GOOGLE_CLIENT_SECRET  # Optional
```

Dev server runs on port **7190**.

## Code Patterns & Conventions

**API Routes:**
- Check session at top: `const session = await auth(); if (!session) return 401`
- Validate body with Zod before DB operations
- Return `NextResponse.json()`

**React Query Hooks:**
- Defined per module in `src/modules/<domain>/hooks/`
- Keys follow pattern: `['resource-name']`
- Mutations call `queryClient.invalidateQueries()` after success

**Components:**
- Client components use `"use client"` at top
- shadcn/ui for all UI primitives
- `cn()` from `src/lib/utils.ts` for conditional classes
- Currency formatted for Pakistani locale (`en-PK`, PKR)

**Type Safety:**
- Strict TypeScript throughout
- Zod schemas for API input validation
- Types inferred from Prisma models where possible

**Styling:**
- TailwindCSS 4 with dark mode support
- shadcn/ui theme variables
- No custom CSS files — all Tailwind utility classes

## Key Features

- Multi-wallet expense tracking with income/expense categorization
- Receivables (money lent) and liabilities (debts owed)
- Real estate portfolio with installment tracking
- Stock portfolio: holdings, trade history, P&L
- Commodity holdings: gold, silver, oil, other
- Side investments: crypto, lending, business
- Stock watchlist with live prices (refetch every 10s)
- Historical stock data (YTD, 1Y, 3Y, 5Y, max)
- Net worth calculation and asset allocation
- CSV transaction import
