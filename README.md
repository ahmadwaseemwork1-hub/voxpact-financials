<div align="center">

# Voxpact Financials

**A premium financial management portal for a business with multiple partners and employees.**

React 19 · TypeScript 5.9 · Tailwind 4 · Vite 8 · Framer Motion · Recharts 3
Express 5 · Prisma 7 · PostgreSQL · JWT + bcrypt

</div>

---

## ⚠️ Read this before you push to GitHub

The seeded accounts exist so you can log in on day one. They are **not** production credentials.

| | |
|---|---|
| **Host (super admin)** | `ahmad.waseem` / `Host#2026` |
| **Admin (partner)** | `voxpactadmin` / `voxpact123` |

1. Both passwords are **bcrypt-hashed** (12 rounds) before they reach the database — the plaintext is never stored.
2. Both accounts seed with `mustChangePassword = true`, so the portal **forces a password change at first sign-in**. This is verified by an automated browser test, not just intended.
3. `voxpact123` fails the password policy (no uppercase, no symbol) and cannot be reused as the new password.
4. Change `SEED_HOST_PASSWORD` / `SEED_ADMIN_PASSWORD` in `server/.env` before seeding anything reachable by other people. `.env` is git-ignored; `.env.example` is not — never put real secrets in it.

---

## 1. Two ways to run this

| | **`demo.html`** | **The real app** |
|---|---|---|
| Start it by | double-clicking the file | `npm run dev` |
| Needs a server? | no | Node + PostgreSQL |
| Where data lives | your browser (`localStorage`) | **PostgreSQL** |
| Survives clearing site data? | ✗ | ✓ |
| Multiple users / devices? | ✗ | ✓ |
| Good for | clicking around, showing someone the UI | actually running the business |

`demo.html` is a single self-contained file — the whole portal in ~3,600 lines of vanilla JS with hand-drawn SVG charts, no build step and no dependencies. It has every screen the React app has.

**It can also drive your real database.** Open it, click the avatar → **Connect to database**, enter your API URL (e.g. `http://localhost:4000`), and it becomes a thin client over the same Express API — every action then writes to PostgreSQL. Add the page's origin to `CORS_ORIGIN` in `server/.env` first; a `file://` page sends `Origin: null`, so serve it over http (`npx serve .`) if you want to connect it.

> A web page can never talk to PostgreSQL directly — it talks to your API, and the API owns the database credentials. Anything that skipped that step would be shipping your database password to every visitor.

Local test accounts inside `demo.html`: `ahmad.waseem` / `Host#2026`, `voxpactadmin` / `Voxpact#2026`, `dataentry` / `Entry#2026`.

---

## 2. What's in here

```
voxpact-financials/
├── demo.html                 # standalone single-file build (no install needed)
├── package.json              # npm workspaces root (runs both apps together)
├── docker-compose.yml        # local PostgreSQL 16
├── .gitignore .editorconfig
│
├── server/                   # Express 5 + TypeScript API
│   ├── .env.example
│   ├── prisma.config.ts      # Prisma 7 CLI config (schema, datasource, seed)
│   ├── prisma/
│   │   ├── schema.prisma     # all models, enums, indexes
│   │   ├── schema.sql        # fallback DDL if Prisma's engine CDN is blocked
│   │   └── seed.ts           # Host + Admin accounts, settings, demo data
│   ├── uploads/              # receipt files (git-ignored)
│   └── src/
│       ├── index.ts          # bootstrap + graceful shutdown
│       ├── app.ts            # middleware pipeline + route mounting
│       ├── config/env.ts     # typed, validated environment
│       ├── generated/        # Prisma client output (git-ignored, regenerated)
│       ├── lib/              # prisma client + pg adapter, settings store
│       ├── middleware/       # auth, RBAC, audit, rate limit, upload, validation, errors
│       ├── utils/            # jwt, bcrypt, csv, dates, zod helpers, http errors
│       └── routes/           # auth, users, expenses, revenue, partners, employees,
│                             # budget, dashboard, reports, audit-logs, settings,
│                             # search, notifications
│
└── web/                      # React 19 + Vite 8 SPA
    ├── .env.example
    ├── vite.config.ts
    └── src/
        ├── main.tsx App.tsx  # providers + lazy-loaded routes
        ├── index.css         # Tailwind v4 theme, glassmorphism, skeletons
        ├── lib/              # api client, formatters, PDF builder
        ├── store/            # Auth, Theme, Toast providers
        ├── hooks/            # count-up, debounce, smooth scroll, form state
        ├── components/
        │   ├── ui/           # Button, Card, Modal, DataTable, Badge, …
        │   ├── layout/       # Sidebar, Topbar, AppLayout, QuickActions
        │   ├── charts/       # Recharts wrappers + shared palette
        │   └── forms/        # Expense, Revenue, Partner, Employee, User modals
        └── pages/            # Dashboard, Expenses, Revenue, Partners, Employees,
                              # Budget, Reports, Users, Audit, Settings
```

---

## 3. Requirements

| Tool | Version | Why |
|---|---|---|
| Node.js | **20.19+ or 22.12+** | Vite 8 requires it |
| npm | 10+ | workspaces |
| PostgreSQL | **14+** | 16 via `docker compose` is easiest |

---

## 4. Quick start

```bash
# 1. install everything (root + both workspaces)
npm install

# 2. start PostgreSQL  (skip if you already have one)
docker compose up -d

# 3. configure the API
cp server/.env.example server/.env
#    → set a real JWT_SECRET:
#      node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 4. (optional) the web app — defaults work with the dev proxy
cp web/.env.example web/.env

# 5. create the schema and seed
npm run db:generate      # generate the Prisma client
npm run db:push          # create tables   (or: npm run db:migrate)
npm run db:seed          # Host + Admin accounts, settings, demo data

# 6. run both apps
npm run dev
```

| | |
|---|---|
| Web app | http://localhost:5173 |
| API | http://localhost:4000/api |
| Health check | http://localhost:4000/api/health |

Sign in as the Host, change the password when prompted, then create your real users under **Users**.

> `npm run setup` does steps 1 and 5 in one go, once `server/.env` exists.

---

## 5. Scripts

Run from the repository root.

| Command | What it does |
|---|---|
| `npm run dev` | API (`:4000`) + web (`:5173`) together, both hot-reloading |
| `npm run dev:server` / `npm run dev:web` | just one of them |
| `npm run build` | compiles the API to `server/dist`, builds the SPA to `web/dist` |
| `npm start` | runs the compiled API (which also serves `web/dist` if present) |
| `npm run typecheck` | strict TypeScript across both apps |
| `npm run db:generate` | regenerate the Prisma client after schema changes |
| `npm run db:push` | push the schema without a migration file (dev) |
| `npm run db:migrate` | create + apply a migration (use this for real environments) |
| `npm run db:seed` | seed accounts, settings and demo records (idempotent) |
| `npm run db:studio` | Prisma Studio, a GUI over the database |

---

## 6. Environment variables

### `server/.env`

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | local docker URL | PostgreSQL connection string |
| `PORT` | `4000` | API port |
| `NODE_ENV` | `development` | `production` enforces a real `JWT_SECRET` |
| `CORS_ORIGIN` | `http://localhost:5173` | comma-separated allowlist. Same-origin requests are always permitted, so single-service deployments need no extra entry |
| `JWT_SECRET` | — | **required.** 48+ random bytes. The app refuses to boot in production with the placeholder |
| `JWT_EXPIRES_IN` | `24h` | token lifetime |
| `BCRYPT_ROUNDS` | `12` | a floor of 10 is enforced in code |
| `INACTIVITY_TIMEOUT_MINUTES` | `30` | auto sign-out window |
| `LOGIN_RATE_LIMIT_MAX` | `5` | failed sign-ins allowed per window |
| `LOGIN_RATE_LIMIT_WINDOW_MINUTES` | `15` | the window |
| `UPLOAD_DIR` | `uploads` | where receipts are written |
| `MAX_UPLOAD_MB` | `10` | per file (PNG/JPG/WEBP/PDF only) |
| `DEFAULT_DAILY_BUDGET` | `20000` | starting daily budget |
| `CURRENCY` | `USD` | ISO code used for all formatting |
| `SEED_*` | see `.env.example` | seed-only; ignored at runtime |

### `web/.env`

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_URL` | *(empty)* | leave empty in dev — Vite proxies `/api` to `:4000`. In production set it to your API origin |
| `VITE_APP_NAME` | `Voxpact Financials` | shown in the top bar |

---

## 7. Roles and what each one sees

| | **Host** (super admin) | **Admin** (partner) | **User** (data entry) |
|---|:--:|:--:|:--:|
| Dashboard | ✅ | ✅ | ✅ (no cash-on-hand) |
| Daily expenses | ✅ all | ✅ all | ✅ **own entries only** |
| Weekly / monthly rollups | ✅ | ✅ | ✅ |
| Recurring expenses | ✅ | ✅ | ❌ |
| Revenue | ✅ | ✅ | 👁 read-only |
| Daily budget | ✅ set | ✅ set | 👁 read-only |
| Partner distribution | ✅ | ✅ | ❌ |
| Employees & salaries | ✅ | ✅ | ❌ |
| Reports & exports | ✅ | ✅ | ❌ |
| User management | ✅ Host + Admin + User | ✅ **User only** | ❌ |
| Audit log | ✅ everything | ✅ **excluding Host activity** | ❌ |
| Settings | ✅ | ✅ | 👁 profile only |

**Host invisibility.** An Admin has no way to learn that Host accounts exist: the user list filters them server-side, the role dropdown offers only `User`, audit entries written by a Host are excluded from the Admin's view, and any request targeting a Host record answers `404 Not Found` rather than `403 Forbidden` — a 403 would itself confirm the account exists. Each of those four is covered by an automated test.

---

## 8. Security

- **Passwords** — bcrypt, 12 rounds by default, never logged or returned by the API.
- **Policy** — minimum 8 characters with an uppercase letter, a number and a symbol; enforced server-side (the client mirrors it for live feedback).
- **Sessions** — JWT, 24-hour expiry, re-checked against the live user record on every request, so deactivating an account kills its session immediately.
- **Inactivity** — the SPA signs out after 30 idle minutes and clears the token.
- **Rate limiting** — 5 failed sign-ins per 15 minutes, keyed by username plus the IPv6-normalised client address (a raw-IP key would let an IPv6 user rotate addresses inside their own /64 and walk past the limit). Successful logins don't count.
- **CORS** — a disallowed origin gets no CORS headers rather than an error; same-origin requests are always allowed so the single-service deployment can serve its own assets.
- **Audit log** — every login (success and failure), create, update, delete and export, with user, role, entity, before/after diff, IP and user-agent.
- **Input handling** — Zod schemas on every write, plus a sanitiser that strips control characters and HTML tags from string fields.
- **Uploads** — MIME allow-list, 10 MB cap, randomised filenames, stored outside the code path.
- **Headers** — Helmet, compression, no stack traces in production responses.
- **Self-protection** — you cannot delete or deactivate your own account, and the last active Host cannot be removed or demoted.

---

## 9. API reference

All routes live under `/api` and require `Authorization: Bearer <token>` unless noted.

<details>
<summary><strong>Auth</strong></summary>

| Method | Path | Notes |
|---|---|---|
| `GET` | `/auth/config` | public — password policy, inactivity window |
| `POST` | `/auth/login` | public, rate-limited |
| `GET` | `/auth/me` | current user |
| `POST` | `/auth/logout` | writes an audit entry |
| `POST` | `/auth/change-password` | requires the current password |
| `PATCH` | `/auth/profile` | own name / email |
</details>

<details>
<summary><strong>Users</strong> — Host &amp; Admin</summary>

`GET /users` · `GET /users/assignable-roles` · `POST /users` · `PATCH /users/:id` · `POST /users/:id/reset-password` · `DELETE /users/:id`
</details>

<details>
<summary><strong>Expenses</strong></summary>

| Method | Path | Notes |
|---|---|---|
| `GET` | `/expenses` | filters: `type, category, status, from, to, minAmount, maxAmount, search`; paginated |
| `GET` | `/expenses/weekly` | ISO-week rollup with per-category totals |
| `GET` | `/expenses/monthly` | monthly rollup, daily vs recurring split |
| `GET` | `/expenses/categories` | configured + in-use categories |
| `GET` | `/expenses/export` | CSV of the current filters |
| `POST` | `/expenses` | JSON or `multipart/form-data` with an optional `receipt` file |
| `PATCH` | `/expenses/:id` | same shape; `removeReceipt=true` detaches a file |
| `POST` | `/expenses/:id/toggle-paid` | |
| `POST` | `/expenses/:id/rollover` | clone a recurring bill into next month |
| `DELETE` | `/expenses/:id` | |
</details>

<details>
<summary><strong>Revenue</strong></summary>

`GET /revenue` · `GET /revenue/trends` · `GET /revenue/export` · `POST /revenue` · `PATCH /revenue/:id` · `POST /revenue/:id/receive` · `DELETE /revenue/:id`

Writes are Host/Admin only; `GET` is open to all roles.
</details>

<details>
<summary><strong>Partners</strong> — Host &amp; Admin</summary>

`GET /partners` (accepts `?profit=` for a live what-if) · `PUT /partners/profit` · `POST /partners` · `PATCH /partners/:id` · `POST /partners/:id/toggle-paid` · `POST /partners/reset-payments` · `DELETE /partners/:id` · `GET /partners/export`
</details>

<details>
<summary><strong>Employees</strong> — Host &amp; Admin</summary>

`GET /employees` · `POST /employees` · `PATCH /employees/:id` · `DELETE /employees/:id` · `POST /employees/bulk-status` · `POST /employees/post-salaries` · `GET /employees/export`

Percentage-based: `GET|POST /employees/special/projects` · `PATCH|DELETE /employees/special/projects/:id`
</details>

<details>
<summary><strong>Budget, dashboard, reports, audit, settings, search</strong></summary>

`GET /budget/today` · `GET /budget/day?date=` · `GET /budget/history?days=` · `PUT /budget/day` · `PUT /budget/default`
`GET /dashboard`
`GET /reports/summary?from=&to=` · `GET /reports/export?type=pnl|expense-breakdown|revenue-trends|partner-distribution|employee-cost`
`GET /audit-logs` · `GET /audit-logs/export`
`GET /settings` · `PUT /settings`
`GET /search?q=`
`GET /notifications` · `POST /notifications/read-all`
</details>

---

## 10. How the money moves

Worth knowing before you trust the numbers:

- **Net profit** = revenue *received* in the period − *all* expenses dated in the period. Projected revenue never counts as profit.
- **Cash on hand** = every payment ever received − every expense ever recorded. Host and Admin only.
- **Daily budget** applies to `DAILY` expenses only, so a monthly rent bill doesn't blow up a single day.
- **Salary run** (Employees → *Post salary run*) writes one `Salary`-category recurring expense for the current month, dated month-end. Re-posting the same month updates that entry instead of duplicating it.
- **Percentage payouts** create a linked expense; editing the payout updates it, deleting the payout deletes it.
- **Partner shares** are always calculated, even when the split doesn't total 100% — the page warns rather than blocking, because part-way through adding partners is a normal state.
- **Overdue** revenue = still projected more than `overdueGraceDays` (default 3) past its expected date.

---

## 11. Deploying

### Render (one click, via `render.yaml`)

1. Create a PostgreSQL database — [Neon](https://neon.tech)'s free tier doesn't expire. Copy its **direct** (non-pooled) connection string.
2. Render dashboard → **New → Blueprint** → pick this repo. It creates one web service that serves both the API and the SPA.
3. When prompted, enter `DATABASE_URL` (the Neon string), `SEED_HOST_PASSWORD` and `SEED_ADMIN_PASSWORD` (8+ chars, upper, number, symbol).

Every deploy runs `db:push` and the idempotent seed before starting. Set `SEED_DEMO_DATA=true` if you want sample records in an empty database. Receipts are stored in PostgreSQL (`receipt_files`), so no persistent disk is needed. On the free plan the service sleeps after 15 idle minutes, and the first request after that takes about a minute.

### Option A — one service (the API serves the SPA)

```bash
npm run build
cd server && npx prisma migrate deploy
npm start
```
`app.ts` mounts `../web/dist` automatically when the folder exists, so a single Node process serves both, on one origin. Put it behind Nginx/Caddy for TLS.

### Option B — split (recommended)

| Piece | Where | Notes |
|---|---|---|
| `web/` | Vercel / Netlify / Cloudflare Pages | build `npm run build`, output `dist`, set `VITE_API_URL` |
| `server/` | Railway / Render / Fly / a VPS | set every variable from `.env.example`, run `prisma migrate deploy` on release |
| Database | managed PostgreSQL | Neon, Supabase, RDS, Railway |
| Receipts | stored in PostgreSQL | nothing extra to provision |

**Production checklist**

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` is 48+ random bytes, unique to this environment
- [ ] `CORS_ORIGIN` lists your real web origin only
- [ ] `DATABASE_URL` uses SSL
- [ ] Seeded passwords changed, `SEED_*` removed from the server env
- [ ] `prisma migrate deploy` runs on every release
- [ ] Automated database backups on

---

## 12. Notes on the stack

Everything is on current majors as of September 2026. The ones that changed how the code is written:

- **Prisma 7** no longer bundles a Rust query engine. `PrismaClient` takes a **driver adapter** (`@prisma/adapter-pg`), the connection URL lives in `prisma.config.ts` instead of `schema.prisma`, and the client is generated as TypeScript into `server/src/generated/` (git-ignored — run `npm run db:generate` after cloning).
- **Express 5** types route params as `string | string[]`, so routes read them through the `param()` helper in `utils/http.ts`. `req.query` is now getter-only, so validated query data is stashed on `res.locals`.
- **Tailwind 4** is configured in CSS, not JavaScript — there is no `tailwind.config.js`. Design tokens live in the `@theme` block at the top of `web/src/index.css`, and dark mode is a `@custom-variant` bound to `data-theme`.
- **Zod 4** moved string formats to the top level (`z.email()`), and replaced `invalid_type_error` with a single `error` option.
- **Vite 8** bundles with Rolldown. Vendor chunking is left at the defaults deliberately — hand-written chunk groups reordered React's internals and broke hooks at runtime.
- **React 19** requires an explicit initial value for `useRef`.

---

## 13. Verification

This was tested, not just compiled. Against a live PostgreSQL 16 instance:

- **41 API assertions passed** — authentication, all three roles' permission boundaries, Host invisibility (including the 404-not-403 behaviour), CRUD with `Decimal` precision, the 60/40 partner split, over-100 % rejection, salary-run idempotency, the 7.5 %-of-12,500 payout maths, budget thresholds, P&L, CSV export, audit trail and the login rate limiter.
- **The React app was driven in a real browser** — every one of the 14 routes rendered with live data, the forced password change intercepted the first sign-in, and creating an expense through the UI landed in PostgreSQL.
- **`demo.html` was driven in a real browser** — all 14 routes, a create/validate/delete round-trip, session persistence across reload, theme switching and the USER role's restrictions, with zero console errors.

Two real bugs surfaced this way and are fixed: the CORS layer returned 500 for its own static assets in the single-service deployment, and the login rate limiter could be bypassed over IPv6.

---

## 14. Known gaps

Straight, so nothing surprises you later:

- **Receipts are stored in PostgreSQL**, which keeps them durable and backed up with everything else, but a large volume of scans will eat into a small free database quota (10 MB cap per file). Move `middleware/upload.ts` to object storage (S3, R2) if that becomes a problem.
- **No automated test suite in the repo.** The verification above was run against this build; it isn't wired into CI yet.
- **Recurring expenses roll over on a button press**, not a cron job.
- **Notifications are derived live** from budget breaches, overdue invoices and unpaid bills. The `Notification` table exists but nothing writes to it yet.
- **`demo.html` duplicates the UI.** It is a second implementation of the same screens — a change to the React app does not change it.
- **`prisma/schema.sql` is maintained by hand** as a fallback for networks that block Prisma's binary CDN. Prefer `db:push` / `db:migrate`.

---

## 15. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Could not connect to the database` | PostgreSQL isn't up or `DATABASE_URL` is wrong. `docker compose up -d`, then `npm run db:push`. |
| `prisma db push` fails downloading an engine | The machine can't reach `binaries.prisma.sh`. Allow that host, set `PRISMA_ENGINES_MIRROR`, or apply `server/prisma/schema.sql` with `psql` and skip straight to `npm run db:seed`. |
| `Refusing to start in production with the default JWT_SECRET` | Working as intended — set a real `JWT_SECRET`. |
| CORS error in the browser | Add the exact web origin (scheme + host + port) to `CORS_ORIGIN`. Same-origin needs no entry. |
| `401` right after signing in | Clocks far apart, or the API restarted with a different `JWT_SECRET` — sign in again. |
| Too many failed sign-ins | The 15-minute lockout is per IP + username. Wait it out, or lower `LOGIN_RATE_LIMIT_*` in dev. |
| Receipts 404 after a redeploy | The container disk was ephemeral. Mount a volume or move uploads to S3. |
| Types look wrong after editing `schema.prisma` | `npm run db:generate`. |
| `Cannot find module '../generated/prisma/client'` | Fresh clone — run `npm run db:generate`. |
| Node version errors on `npm run dev` | Vite 8 needs Node 20.19+ or 22.12+. |

---

## 16. Accessibility & performance

- Every interactive control has an accessible name; modals trap Escape, tables use real `<th scope>` headers, and status colours are always paired with text or an icon.
- `prefers-reduced-motion` disables the count-up animation, smooth scrolling and transitions.
- Routes are code-split; charts and the PDF builder load on demand.
- Tables paginate server-side at 50 rows; rollup views paginate client-side.
- Dark mode is the default and is remembered per browser; light mode is a full second theme, not an inversion.

---

## 17. License

Private and proprietary — © Voxpact. Not for redistribution.
