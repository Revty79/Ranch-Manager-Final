# Render Deployment Notes

## Services

- Web service for Next.js app
- Managed PostgreSQL database

## Environment Variables

- `DATABASE_URL`
- `APP_URL`
- `APP_SECRET`
- `SESSION_COOKIE_NAME`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `BETA_LIFETIME_CODE` (optional)

## Build / Start

- Build command: `npm install && npm run build`
- Start command: `npm run start`

## Migrations

Run after each deploy that changes schema:

```bash
npm run db:migrate
```

## Stripe Webhook

Configure Stripe to send webhook events to:

`https://<your-domain>/api/stripe/webhook`
