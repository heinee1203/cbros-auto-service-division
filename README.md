# AutoServ Pro

Auto body shop management system for CBROS Auto Painting Division. Handles estimates, job orders, intake, service tracking, invoicing, and vehicle release with a frontliner (shop floor) interface and admin dashboard.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** NextAuth.js (credentials + PIN login)
- **UI:** Tailwind CSS, Lucide Icons, Sonner (toasts)
- **PWA:** Offline-capable with service worker
- **Photo Processing:** Sharp (watermark, resize, thumbnails)

## Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd cbros-auto-painting-division
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL connection string and secrets

# 3. Push schema and seed
npx prisma db push
npx tsx prisma/seed.ts

# 4. Run dev server
npm run dev
```

## Default Login

| Method | Credentials |
|--------|-------------|
| Username/Password | `admin` / `changeme` |
| PIN (Shop Floor) | `1234` |

## Deployment (Railway)

1. Create a new Railway project
2. Add a PostgreSQL addon (DATABASE_URL auto-injected)
3. Set environment variables: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
4. Deploy from GitHub
5. Run `npx prisma db push && npx tsx prisma/seed.ts` via Railway CLI or deploy command

The app uses `output: 'standalone'` for optimized Railway builds.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | Random secret for JWT signing |
| `NEXTAUTH_URL` | Yes | App URL (e.g., https://app.railway.app) |
| `PHOTO_STORAGE_PATH` | No | Photo storage directory (default: ./public/uploads) |
| `APEX_POS_API_URL` | No | Apex POS integration URL |
| `APEX_POS_API_KEY` | No | Apex POS API key |
| `CRON_SECRET` | No | Secret for cron job endpoints |

## Key Features

- **Estimates:** Multi-version estimates with two-tier approval chain (tech review + management)
- **Intake:** Photo-documented vehicle check-in with damage mapping
- **Job Orders:** Bay assignment, task tracking, time entries
- **Invoicing:** Cash and charge (corporate AR) invoice types with BIR-compliant VAT
- **Frontliner:** Dark-themed shop floor interface for advisors and technicians
- **Live Floor:** Real-time bay map + job queue with status filters
- **Parts Catalog:** Apex POS integration for 46,000+ SKU search
