# سنتر الأستاذ محمد نجم — Tutoring Center Management Platform

An Arabic-language management platform for "Mohamed Negm's Tutoring Center", built with Lovable. Handles students, groups, lessons, attendance, finances, homework, and reports.

## Stack

- **Frontend**: React 19, TanStack Router, TanStack Start (SSR), Tailwind CSS v4
- **Backend/DB**: Supabase (auth + database)
- **Build**: Vite 8, TypeScript
- **UI**: Radix UI components (shadcn/ui style), Lucide icons, Cairo Arabic font

## Running the app

```sh
npm run dev
```

Starts the dev server on **port 5000**. The workflow "Start application" is configured to run this automatically.

## Key routes

| Route | Description |
|---|---|
| `/` | Landing page — entry point for students and teacher |
| `/auth` | Teacher login (admin dashboard) |
| `/student/portal` | Student portal — code-based login, no password |
| `/student/register` | New student registration |
| `/_authenticated/*` | Protected admin routes (dashboard, groups, attendance, etc.) |

## Environment

Supabase credentials are already set in `.env`:
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon key

## Notes

- The `@lovable.dev/vite-tanstack-config` package manages most Vite/TanStack plugin setup — do not add duplicate plugins (tanstackStart, tailwindcss, tsConfigPaths, viteReact) to `vite.config.ts`.
- Port is set to 5000 via `vite.server.port` in `vite.config.ts` (overrides the lovable default of 8080, which only applies in Lovable's own sandbox).
- UI is right-to-left (RTL), Arabic language, using the Cairo Google Font.

## User preferences

*(none recorded yet)*
