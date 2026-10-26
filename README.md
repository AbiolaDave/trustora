# Trustora

A mobile-first marketplace where customers in Nigeria book verified artisans (plumbers, electricians, cleaners, AC technicians and more).
Built with Next.js (App Router) + TypeScript, Tailwind CSS, MongoDB Atlas (Mongoose), Zod and Paystack.

Launch region defaults to **Ogun State**. Change it any time in **Admin > Settings** (for example add `lagos`).

## 1. Install the tools (Windows)

1. Install **Node.js 20 or newer** (LTS) from nodejs.org.
2. Open **PowerShell** and check:
   ```powershell
   node -v
   npm -v
   ```
3. If PowerShell blocks npm scripts ("running scripts is disabled"), run this once:
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```

## 2. Set up the project

```powershell
cd path\to\kasuwa
npm install
Copy-Item .env.example .env.local
notepad .env.local
```

### Fill in `.env.local`

| Variable | What to put |
|---|---|
| `MONGODB_URI` | Your Atlas connection string (see below) |
| `AUTH_SECRET` | 32+ random characters. Generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `APP_URL` | `http://localhost:3000` locally. Your real domain in production |
| `PAYSTACK_SECRET_KEY` | Leave **blank** in development to use the labelled sandbox payment page. Use your Paystack **test** key later. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Optional. See "Gmail" below. Without them, emails are printed in the PowerShell window |
| `CRON_SECRET` | Any long random string (for the expiry job) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Your admin login (password 10+ characters) |
| `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET` | Cloudinary credentials for private uploads. Set all three; find them in the Cloudinary dashboard. |

### MongoDB Atlas

1. Create a free cluster at cloud.mongodb.com.
2. **Database Access**: add a database user with a password.
3. **Network Access**: add your current IP (use `0.0.0.0/0` only temporarily while testing).
4. **Connect > Drivers**: copy the connection string, replace `<password>`, and add a database name, e.g. `...mongodb.net/kasuwa?retryWrites=true&w=majority`.

This app does not need MongoDB transactions, so the free tier works.

### Gmail

1. Turn on 2-Step Verification for the Gmail account.
2. Open myaccount.google.com/apppasswords and create an App Password.
3. Put the Gmail address in `GMAIL_USER` and the 16-character password in `GMAIL_APP_PASSWORD`.

Gmail is fine for early testing (it has daily sending limits). Move to a transactional provider before real volume.

## 3. Add starter data and run

```powershell
npm run seed                # categories, Ogun and Lagos areas, settings, admin account
npm run seed -- --demo      # optional: demo customer + demo artisan (needs SEED_DEMO_PASSWORD)
npm run dev
```

Open http://localhost:3000. Log in at /login with your admin email to reach /admin.

### Try the full flow
1. Register a customer and an artisan (two browsers or one normal and one private window). Verification and reset emails appear in the PowerShell window if Gmail is not set.
2. Artisan: complete the profile, add a service, set working hours, upload ID in Verification.
3. Admin: approve in **Verification**. The badge only appears after this.
4. Customer: find the service, pick a slot, send the request.
5. Artisan: accept (or send a quote). Customer: **Pay**. With no Paystack key you land on the sandbox page; click "Simulate successful payment".
6. Artisan: start, mark as done. Customer: confirm and review.
7. Admin > Payments: the artisan payout appears after the 72-hour protection window.

## 4. Commands

```powershell
npm run dev         # development server
npm run build       # production build
npm run start       # run the production build
npm run typecheck   # TypeScript check
npm test            # unit tests
```

## 5. Paystack

1. Create a Paystack account and copy your **test** keys (Settings > API Keys).
2. Set `PAYSTACK_SECRET_KEY` and `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`.
3. In the Paystack dashboard set the **webhook URL** to `https://YOUR-DOMAIN/api/webhooks/paystack`.
   For local testing use a tunnel (for example ngrok) because Paystack cannot reach localhost.
4. Payments are only confirmed after the server verifies them with Paystack (callback) or a signed webhook. The browser is never trusted.

Going live: switch to live keys only after Paystack approves your business, and have a lawyer review the policy pages.

## 6. Scheduled job (important)

Unanswered requests, quotes and unpaid bookings must expire, and silent completions must auto-confirm. Call this every 10 to 15 minutes:

```
GET https://YOUR-DOMAIN/api/cron/sweep
Authorization: Bearer <CRON_SECRET>
```

On Vercel, add a Cron Job for that path. Elsewhere use cron-job.org or similar.

## 7. Deploy (Vercel + Atlas)

1. Push to GitHub and import the repo in Vercel.
2. Add all `.env.local` values as Vercel environment variables (`APP_URL` = your live URL).
3. In Atlas Network Access allow Vercel (simplest for MVP: `0.0.0.0/0` with a strong database password).
4. Run `npm run seed` once against the production database from your machine.
5. Configure the Paystack webhook and the cron job.
6. Uploads use Cloudinary when all three Cloudinary credentials are set. Configure them in the deployment environment before launch.

## 8. How it is organised

```
src/domain/      pure rules: booking state machine, pricing, refund policy, availability, webhook checks (unit tested)
src/models/      Mongoose schemas and indexes
src/server/      database workflows and server actions (booking, payments, admin)
src/lib/         env, db, auth/session, email, storage, payment-provider adapters
src/app/         pages and API routes
src/components/  shared UI
scripts/seed.ts  reference data, admin, optional demo data
docs/            ARCHITECTURE.md
```

Key decisions (plain English):
- **Money is whole kobo.** Prices are computed on the server from artisan prices and admin settings. The browser only sends IDs.
- **Status changes go through one state machine** (`src/domain/booking-state.ts`), and only a server-verified payment can confirm a booking.
- **Double booking is blocked by the database**, with a unique index on each 30-minute slot, so it also works under simultaneous requests.
- **Forms are plain HTML posting to server actions.** No client JavaScript is needed for most pages, which keeps pages light on slow data.
- **Every action re-checks who you are** and that the booking or service is yours. Hiding links is never the only protection.

## 9. Still needs your credentials or decisions

- **Private file storage:** ID documents and job photos are uploaded to Cloudinary as authenticated assets when `CLOUD_NAME`, `CLOUD_API_KEY` and `CLOUD_API_SECRET` are set. The app serves files only through its authenticated `/api/files` route. Without Cloudinary credentials, development saves files to `.private-uploads/`; production refuses uploads.
- **Paystack live account** and webhook URL.
- **Email provider** beyond Gmail for real volume.
- **Artisan payouts are manual** (admin transfers from the bank, then records the reference). Automatic payouts need Paystack Transfers or Split/Subaccounts, which require Paystack's approval and onboarding.
- **WhatsApp**: set `NEXT_PUBLIC_WHATSAPP_NUMBER` for the support button. Automated WhatsApp notifications need WhatsApp Business API approval (not built).
- **Legal pages** are drafts. Have a Nigerian lawyer review them.
- **Business decisions**: whether to charge commission or fees (off by default), and when to start.
