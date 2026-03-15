# AutoServ Pro — Schema + Phase 1 Design

## Decisions

- **Database:** SQLite (dev), PostgreSQL (prod). Prisma handles migration.
- **IDs:** CUID via `@default(cuid())` — sortable, collision-resistant.
- **Money:** All monetary values as `Int` (centavos). Display via `formatPeso()`.
- **Soft delete:** `deletedAt DateTime?` on every model. Enforced via Prisma Client Extensions (`$extends` with query extension), not deprecated middleware.
- **Photos:** Polymorphic `Photo` model with `entityType + entityId`. No FK at DB level — integrity enforced at application layer.
- **Enums:** Prisma enums for all status fields. SQLite stores as strings; PostgreSQL migration converts to native enums.
- **Audit fields:** `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt` on every model (repeated, no inheritance in Prisma).
- **Indexes:** Plate numbers, phone numbers, all document numbers (JO-*, EST-*, INV-*, OR-*).

## Auth

- NextAuth.js with JWT strategy (no session table).
- Two credential providers: standard (username+password) and PIN (4-6 digit, hashed with bcrypt).
- PIN uniqueness enforced before save. `pinHash` indexed.
- Session expiry configurable per role (2hr tech, 8hr admin).

## Permissions

- Centralized `lib/permissions.ts` with `PERMISSIONS` map and `can(role, action)` helper.
- Used by: middleware (route protection), API routes (action authorization), UI (conditional rendering).

## Route Structure

- `(auth)/` — login, pin-login (no sidebar)
- `(dashboard)/` — all authenticated pages (sidebar + topbar)
- `(dashboard)/jobs/[id]/` — tabbed layout: Overview, Estimate, Intake, Tasks, Photos, QC, Invoice, Release (stubbed with placeholders for future phases)

## UI

- Tailwind + shadcn/ui, charcoal primary (#1A1A2E), amber accent (#F59E0B), warm gray surfaces.
- JetBrains Mono for data, DM Sans for UI text. 48px min touch targets.
- Sidebar: collapsible icon+label. Global search: Cmd+K command palette, plate-number-first.

## Seed Data

- Default admin user (owner role)
- Full service catalog (7 categories, ~50 services from spec Section 3)
- Default settings (shop profile placeholder, 12% VAT, labor rates, photo requirements)
