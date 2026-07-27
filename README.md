# RX Expert Miners — Data Bridge

Repair & dispatch tracking for RX Expert Miners. Rebuilt from the original
Lovable export (TanStack Start + TanStack Router) onto a plain Vite SPA with
React Router, keeping the existing Supabase backend as-is.

## Stack

React 19 · Vite · TypeScript · Tailwind v4 · shadcn/ui · React Router 7 ·
React Hook Form + Zod · TanStack Query · Framer Motion · Recharts ·
Supabase (auth + Postgres + RLS + 1 edge function).

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Supabase project's
   URL + anon key (Supabase dashboard → Project Settings → API).
3. Apply the schema to your Supabase project — either:
   - `supabase link --project-ref <ref>` then `supabase db push` (uses
     everything in `supabase/migrations/`), or
   - paste each migration file into the SQL editor in order.
4. Deploy the edge function: `supabase functions deploy notify-owner-approval`
   (it emails the owner when a new user signs up and needs approval).
5. `npm run dev`

The **first account that ever signs up automatically becomes `owner`**
(see the `handle_new_user()` trigger in the migrations) — sign up with your
own account first, before anyone else.

## Structure

```
src/
  components/
    ui/        shadcn primitives (unchanged from source)
    layout/     Header, TabNav, AppShell
    shared/      LanguageToggle and other cross-page bits
    forms/       BulkAddDialog
  pages/         MasterDataPage, PassingByPage, PrintingPage, DataBankPage,
                 SettingsPage, UsersPage, LoginPage, PendingApprovalPage
  routes/        AppRoutes (React Router tree), ProtectedRoute/AdminRoute guards
  contexts/      AuthContext, LanguageContext
  services/      supabase.ts (client)
  types/         database.ts (hand-derived row types), supabase-generated.ts
  utils/         cn, serial (serial-number validation), printQueue
                 (localStorage dispatch/receive queue), errorHandler
  i18n/          translations.ts (English/Arabic)
  styles/        globals.css (dark elegant theme tokens)
supabase/
  migrations/    unchanged from the original export
  functions/     notify-owner-approval edge function
```

## What changed vs. the original export

- **Routing:** TanStack Router's single tab-switcher route → real React
  Router routes (`/`, `/passing-by`, `/printing`, `/data-bank`, `/settings`,
  `/users`), each lazy-loaded (`React.lazy` + route-based code splitting).
- **Auth:** Lovable Cloud's OAuth helper (`lovable.auth.signInWithOAuth`)
  replaced with plain `supabase.auth.signInWithOAuth`.
- **Theme:** replaced the original light-first palette with a dark, elegant
  theme (deep charcoal/graphite + warm brass-gold accent). Light mode was
  dropped per your request — everything now assumes `.dark`.
- **Charts:** the hand-rolled div/width "bar charts" in Data Bank were
  replaced with real Recharts (area chart for records-by-month, donut charts
  for warranty and final-status breakdowns).
- **Removed:** 8 components that existed in the source but were never
  actually routed to anywhere (`DashboardTab`, `ContactsTab`,
  `MaintenanceTab`, `MaintenanceRecordsTab`, `DataRecordsTab`,
  `ApprovedDevicesTab`, `AwaitingApprovalTab`, `InMaintenanceTab`) — confirmed
  with you that the current 6 pages are the intended set.
- **Not yet regenerated:** `src/types/supabase-generated.ts` is a hand-written
  stand-in for the Supabase CLI's generated types (the export didn't include
  one). Once you have CLI access to your own project, regenerate it properly
  — see the comment in `src/services/supabase.ts`.

## Verified

`npm install`, `npx tsc -b --noEmit`, and `npx vite build` all pass cleanly
against this codebase as delivered.
