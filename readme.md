# Pay MVP

Dokumen perencanaan MVP tersedia di:

- `MVP_PLAN.md`
- `OPENAPI_V1_DRAFT.md`
- `docs/openapi/v1.yaml`

## Milestone 1 Setup

1. Copy environment:
   - `cp .env.example .env`
2. Start MySQL (Docker Desktop):
   - `npm run db:up`
3. Generate prisma client:
   - `npm run prisma:generate`
4. Run migration:
   - `npm run prisma:migrate -- --name init`
5. Run app:
   - `npm run dev`

### Docker DB commands

- Start DB: `npm run db:up`
- Stop DB: `npm run db:down`
- Follow logs: `npm run db:logs`
- Seed data: `npm run db:seed`
- E2E flow test (create -> callback/sync -> webhook log): `npm run test:e2e:flow`
- E2E basic flow test: `npm run test:e2e:basic`

## Milestone 2 Notes

Set gateway env in `.env`:

- `APP_NAME`
- `APP_DOMAIN`
- `APP_PROTOCOL`
- `APP_URL` (optional override)
- `GATEWAY_PROJECT`
- `GATEWAY_API_KEY`
- `GATEWAY_CALLBACK_TOKEN`

API endpoints:

- `POST /api/v1/transactions`
- `GET /api/v1/transactions`
- `GET /api/v1/transactions/{transactionId}`
- `POST /api/v1/transactions/{transactionId}/sync`
- `POST /api/v1/internal/gateway/callback?token=...`

Public docs:

- Docs page: `/docs`
- OpenAPI YAML: `/openapi/v1.yaml`

Hardening baseline:

- `Idempotency-Key` wajib pada `POST /api/v1/transactions`.
- Rate limit per project pada endpoint merchant API.

### E2E Script Notes

`npm run test:e2e:flow` akan:

1. Menjalankan mock gateway server lokal.
2. Menjalankan mock merchant webhook receiver lokal.
3. Menjalankan build + Next.js `start` di port `3100`.
4. Menjalankan flow:
   - create transaction,
   - callback update,
   - sync update,
   - verifikasi webhook log tercatat.

Jika ingin pakai app yang sudah running sendiri, set:

- `E2E_USE_EXISTING_APP=true`
- `E2E_APP_PORT=<port_app_kamu>`
