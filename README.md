# UpSkillIN

Hassle-free upskilling for Indian graduates, working professionals and job seekers. This MVP pairs a mobile-first Next.js marketplace with a NestJS REST API, PostgreSQL/Prisma and optional Redis.

## Quick start (5 commands)

Run the first three commands from the repository root. Keep the PostgreSQL
process from command 3 running in its terminal; run commands 4 and 5 from
another terminal:

```powershell
Copy-Item .env.example .env
npm install
npm run db:up -w @upskillin/api
npm run db:init
npm run dev
```

The project-local PostgreSQL server uses `apps/api/data/postgres/` and does not
require Docker or a system-wide PostgreSQL installation. If you already have a
PostgreSQL server on port 5432, configure `DATABASE_URL` for it instead of
running `db:up`. Docker Compose remains available as an alternative database
setup.

Open [http://localhost:3000](http://localhost:3000). The API is at
[http://localhost:4000/api](http://localhost:4000/api); OpenAPI docs are at
[http://localhost:4000/api/docs](http://localhost:4000/api/docs).

`db:init` generates the Prisma client, applies the initial database migration
and seeds 48 courses. If a `.env` already exists, keep it and verify the
PostgreSQL URL and JWT/OTP secrets before starting. The local payment provider
is server-simulated and is never enabled in `NODE_ENV=production`.

## Demo

1. Explore, search, combine the course filters, and open a self-paced course.
   Instructor-led course cards take you to their detail page to choose an
   available batch.
2. Add a course, open the cart, and continue to checkout. Choose **Register**
   to create a new account, or **Sign in** for an existing email or Indian phone
   number. In local development the API returns a short-lived development OTP
   in its response; this is deliberately disabled in production. Edit your
   learning profile or sign out from the account menu in the storefront header.
3. Complete billing details and the local payment simulation. A verified
   server-side test payment creates the enrollment; visit **My Courses**.
4. For the admin studio, sign in as `admin@upskillin.demo`, then visit
   `/admin/courses` to create a course draft. Use the same development OTP flow.
   Seeded instructor accounts are `instructor1@upskillin.demo` through
   `instructor4@upskillin.demo`.

The local OTP and simulated payment are test conveniences, not production
identity or payment providers. Configure `OTP_DELIVERY_URL` and
`OTP_DELIVERY_SECRET` for a trusted OTP delivery adapter. To use Razorpay test
mode, set `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. Configure the webhook at
`POST /api/payments/webhook`; payment signature verification and webhook
verification are performed by the API.

## Quality checks

```powershell
npm test
npm run build
npm run test:e2e -w @upskillin/web
```

The Playwright scenarios cover signup → browse → buy (local payment), URL-synced
filter combinations, and admin course creation. Before running them locally,
start PostgreSQL with `npm run db:up -w @upskillin/api`, run
`npm run db:init`, and install Chromium once with
`npx playwright install chromium`.

## Project map

- [apps/web](./apps/web): Next.js App Router storefront, course pages, learner
  cart/checkout, My Courses and course studio.
- [apps/api](./apps/api): NestJS controllers/services, validation, auth,
  catalog, commerce, learning and recommendation APIs.
- [apps/api/prisma/schema.prisma](./apps/api/prisma/schema.prisma): relational
  data model.
- [ARCHITECTURE.md](./ARCHITECTURE.md): architecture, ER diagram and delivery
  slices.
- [ASSUMPTIONS.md](./ASSUMPTIONS.md): MVP boundaries and production follow-ups.
- [.env.example](./.env.example): local configuration template; never commit
  populated `.env` files.

Docker Compose can also start PostgreSQL and Redis. Redis is reserved for the
planned distributed OTP/session limits and cache; current demo login
throttling is process-local.
