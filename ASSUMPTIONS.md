# MVP assumptions and production follow-ups

This is an executable MVP foundation and core learner flow, not a claim that
every marketplace/compliance integration is production-certified.

## Implemented assumptions

- Course prices are stored in paise. GST is assumed to be 18% and included in
  displayed prices; validate tax treatment, place-of-supply and invoice wording
  with an Indian GST professional before launch.
- Seed/demo data is fictional, scheduled relative to seed time, and intended
  only for local development. The four seeded instructor accounts and admin
  account have no password; local development OTP is the only demo sign-in
  method.
- Admin-created courses start as drafts. Course creation currently covers
  catalogue metadata; full module/lesson/batch/question-bank/review moderation
  management is a follow-up.
- OTP delivery is an adapter contract (`OTP_DELIVERY_URL`) and is not tied to an
  SMS, email, WhatsApp, or Google provider. Google OAuth is not configured.
- Razorpay is used only when explicit test/live credentials are supplied. The
  default local payment simulator is available only outside production and
  changes order/enrollment state on the API, never from a client payment claim.
- Batches created by the seed script use illustrative dates, seat counts and
  cities. Production operators must create and maintain real schedules.
- Catalog language denotes course content language; UI translation is not
  inferred from it.

## Required before production

- Add a managed Redis-backed OTP/IP rate limiter, distributed cache, session
  policy, refresh-token cookie rotation and abuse monitoring. The present
  per-identity OTP cooldown is in-process and is not a multi-instance limiter.
- Move access and refresh tokens out of browser local storage into secure,
  HttpOnly, SameSite cookies behind a same-origin API/BFF; add CSRF protection.
- Add field-level encryption/key management for email, phone and billing PII,
  retention/deletion jobs, privacy request tooling, consent withdrawal and a
  DPDP/legal review. The consent record and privacy page here are scaffolding.
- Replace substring catalog lookup with PostgreSQL full-text indexes/ranking,
  add representative query plans, load tests and p95 measurements. The current
  seed-sized catalog uses Prisma filters.
- Complete course/module/batch/coupon CRUD, question banks and assessment
  grading, attendance, certificates, verified-review moderation, refunds,
  downloadable GST invoice PDFs and transactional notification adapters.
- Add production Google OAuth, OTP provider integration, payment retry/refund
  reconciliation and payment webhook replay/alert operations. Only verified
  Razorpay callbacks/webhooks may change a production order to paid.
- Translate UI and course fields with `next-intl` and human-reviewed Hindi,
  Tamil, Telugu, Kannada, Marathi and Bengali copy. Current UI chrome is
  English; course language is independently filterable and translation records
  are modeled.
- Add a maintained offline service worker, richer accessibility audit,
  security headers/CSP, structured request/audit logging, error monitoring,
  backups and a production deployment configuration.
- Expand recommendation evaluation beyond the initial deterministic
  profile/topic/search/view/co-purchase/trending rules, including privacy
  controls and event retention.

Local `.env.example` values are placeholders. Rotate all signing keys and
configure provider secrets through a production secret manager.
