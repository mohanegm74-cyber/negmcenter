# AI Development Guidelines & Tech Stack

This codebase is a web platform for **سنتر الأستاذ محمد نجم** (Mr. Mohamed Negm Center), a specialized Egyptian educational center management application supporting student portals, attendance tracking, automated grading, AI report generation, exam management, and financial record keeping.

---

## 1. Tech Stack (Core Overview)

* **Meta-Framework**: [TanStack Start](https://tanstack.com/router/latest/docs/framework/react/start/overview) (SSR, React 19, Vite, TypeScript, Nitro server).
* **Routing**: [TanStack Router](https://tanstack.com/router/latest) with file-based routing (`src/routes/`), using TanStack Start's `routeTree.gen.ts`.
* **State & Data Fetching**: TanStack Query (`@tanstack/react-query`) alongside TanStack Start Server Functions (`createServerFn`, `useServerFn`).
* **Database & Authentication**: Supabase (`@supabase/supabase-js`) with Service Role for privileged server operations and Supabase Auth with RLS for user sessions.
* **Styling & Design System**: Tailwind CSS v4 (`@tailwindcss/vite`), CSS variables, custom Cairo/Arabic typography, and `tw-animate-css`.
* **UI Components**: Shadcn UI / Radix UI primitives, Lucide Icons (`lucide-react`), and Sonner (`sonner`) for toast notifications.
* **AI Engine**: Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) using `google/gemini-3.6-flash` called safely within server functions.
* **QR & Print Utilities**: `qrcode` for rendering student cards, `html5-qrcode` for live QR scanning, and native HTML printable document generation via `window.open()`.

---

## 2. Library Selection & Usage Rules

### 📍 Routing & Pages
* **Use**: `@tanstack/react-router` file-based routing in `src/routes/`.
* **Rule**:
  * Root shell is strictly `src/routes/__root.tsx`.
  * Authenticated teacher routes go in `src/routes/_authenticated/`.
  * Public student routes go in `src/routes/student.*.tsx` or `src/routes/index.tsx`.
  * Do **NOT** create Next.js or Remix folders (no `app/`, `pages/`, or manual `routeTree.gen.ts` editing).

### ⚡ Data Fetching & Server Functions
* **Use**: `createServerFn` from `@tanstack/react-start` for backend logical operations, student portal verifications, exam grading, backup export/import, and AI prompt execution.
* **Use**: `useServerFn` on the client side to invoke server functions seamlessly.
* **Use**: Supabase client (`supabase` in `src/integrations/supabase/client.ts`) directly in React components when performing simple client queries or listening to real-time database changes.
* **Rule**: Never expose `SUPABASE_SERVICE_ROLE_KEY` or `LOVABLE_API_KEY` to client bundles; always wrap admin or AI routines inside server functions or server modules (`.server.ts`).

### 🎨 UI & Styling
* **Use**: Tailwind CSS classes for layout, spacing, flexbox/grid, and colors.
* **Use**: `lucide-react` for UI icons.
* **Use**: `sonner` (`toast.success()`, `toast.error()`, `toast.loading()`) for user notifications.
* **Rule**: All UI text must default to Arabic with proper RTL formatting (`dir="rtl"`). Ensure numbers formatted for Egyptian display (`.toLocaleString("ar-EG")`) where appropriate.

### 📷 QR Code & Scanning
* **Use**: `qrcode` (`QRCode.toDataURL` / `QRCode.toCanvas`) for generating QR codes on student cards and student portals.
* **Use**: `html5-qrcode` for browser camera QR scanning in `src/routes/_authenticated/scan.tsx`.

### 🖨️ Printing & PDF Generation
* **Use**: Custom HTML template helper (`openPrint` in `src/lib/print.ts`) using `window.open()` + native `window.print()` styling for crisp Arabic typography and PDF generation.
* **Rule**: Prefer styled HTML print popups over canvas-based PDF tools for better Arabic font support and document clarity.

---

## 3. General Development Rules

1. **RTL First**: Maintain Right-to-Left layout compatibility across all components.
2. **Type Safety**: Strictly define TypeScript interfaces for tables, exams, students, and server function payloads.
3. **Graceful Error Handling**: Surface descriptive Arabic error messages in toasts or inline UI when operations fail.
4. **Code Organization**:
   * Component files in `src/components/`
   * Server helper functions in `src/lib/*.server.ts` or `src/lib/*.functions.ts`
   * Utilities in `src/lib/`