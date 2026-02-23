# BisaQris MVP Plan

## 1. Tujuan Produk

BisaQris adalah platform payment aggregator yang simple, mudah, dan murah untuk semua orang, dengan onboarding cepat tanpa proses KYC rumit di awal.

Fokus MVP:

- Merchant bisa langsung membuat akun dan project.
- Merchant bisa membuat transaksi via API.
- Sistem memproses status pembayaran dari gateway (Gateway).
- Sistem mengirim webhook ke merchant.
- Merchant dapat memantau transaksi dan log webhook dari dashboard.

## 2. Scope MVP

### Fitur Inti

- Auth: register, login, logout.
- Multi project: satu user bisa punya banyak project.
- Create project onboarding modal: `project_name`, `webhook_url`.
- Dashboard: ringkasan total transaksi, total sukses, pending, gagal, volume harian.
- Transactions: daftar transaksi + filter status + detail transaksi.
- Webhook logs: riwayat pengiriman webhook per transaksi.
- Settings project: `webhook_url`, `app_slug` (unik), `api_key` (generate/regenerate).

### Di luar MVP (ditunda)

- KYC flow lengkap.
- Refund/dispute.
- Team & role management.
- Advanced analytics.
- Settlement automation kompleks.

## 3. Stack Teknis

- Frontend + Backend app: Next.js (App Router).
- ORM: Prisma.
- Database: MySQL.
- Auth: Auth.js (credential/email awal).
- Integrasi pembayaran: Gateway API.
- Optional setelah v1: Redis + queue worker untuk retry webhook lebih stabil.

## 4. Arsitektur Integrasi Gateway

### Prinsip

- API-first untuk seluruh metode pembayaran.
- Webhook dari gateway dipakai sebagai trigger, tetapi status akhir transaksi tetap diverifikasi ke endpoint detail API gateway.

### Alur transaksi

1. Merchant memanggil endpoint create transaction BisaQris dengan API key project.
2. BisaQris menghitung fee, simpan transaksi status `pending`.
3. BisaQris memanggil Gateway create transaction sesuai method.
4. Customer melakukan pembayaran.
5. Gateway mengirim callback/webhook.
6. BisaQris verifikasi status ke endpoint detail Gateway.
7. Status transaksi diupdate (`paid` / `failed` / `expired`).
8. BisaQris mengirim webhook ke merchant.
9. Setiap attempt webhook dicatat di webhook logs.

## 5. Revenue Model (Fee)

Fee dikenakan per transaksi merchant.

Komponen nominal yang disimpan per transaksi:

- `base_amount`: nominal asli dari merchant.
- `platform_fee`: fee untuk BisaQris.
- `gateway_fee_estimate`: estimasi biaya channel/payment method.
- `customer_payable`: total yang dibayar customer.
- `merchant_settlement`: nominal bersih merchant.

Aturan penting:

- Nilai fee harus di-snapshot saat transaksi dibuat agar histori konsisten.
- Rule fee bisa default global dan override per project.

## 6. Data Model (Prisma - konsep awal)

### Entitas utama

- `User`
- `Project`
- `ApiKey`
- `Transaction`
- `WebhookLog`
- `FeeRule`

### Struktur minimum per entitas

- `User`: id, name, email(unique), password_hash, created_at.
- `Project`: id, user_id, name, app_slug(unique), webhook_url, is_active, created_at.
- `ApiKey`: id, project_id, key_hash, key_prefix, last_used_at, revoked_at, created_at.
- `Transaction`: id, project_id, external_id, gateway_ref, method, status, base_amount, platform_fee, gateway_fee_estimate, customer_payable, merchant_settlement, payload_json, paid_at, created_at, updated_at.
- `WebhookLog`: id, project_id, transaction_id, target_url, event_type, request_body, response_code, response_body, attempt_no, delivered_at, created_at.
- `FeeRule`: id, project_id(nullable for default), method, fee_type(flat|percent|hybrid), value_flat, value_percent, min_fee, max_fee, is_active, created_at, updated_at.

## 7. API Design v1

Base path: `/api/v1`

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`

### Projects

- `GET /projects`
- `POST /projects`
- `GET /projects/{projectId}`
- `PATCH /projects/{projectId}`

### API Keys

- `POST /projects/{projectId}/api-keys` (generate)
- `POST /projects/{projectId}/api-keys/regenerate` (rotate + revoke lama)

### Transactions (merchant API)

- `POST /transactions` (create transaksi, method dinamis)
- `GET /transactions/{transactionId}`
- `GET /transactions?status=&method=&from=&to=&page=`

### Webhook Logs

- `GET /projects/{projectId}/webhook-logs`
- `GET /projects/{projectId}/webhook-logs/{logId}`

### Internal callback endpoint

- `POST /internal/gateway/gateway/callback`

## 8. Security & Reliability Baseline

- API key ditampilkan hanya saat generate/regenerate, yang disimpan hanya hash.
- Gunakan header auth yang konsisten, contoh: `Authorization: Bearer bq_live_xxx`.
- Rate limit endpoint transaksi per API key.
- Idempotency key untuk create transaksi agar tidak double charge.
- Verifikasi callback gateway + reconcile ke detail API.
- Retry webhook merchant dengan exponential backoff.
- Simpan jejak request/response penting untuk audit.

## 9. Developer Documentation (Wajib di MVP)

Gunakan OpenAPI 3.1 sebagai sumber tunggal dokumentasi.

Struktur docs publik:

1. Overview + Quickstart (5 menit).
2. Authentication (API key, format header).
3. Create Transaction (contoh semua method utama).
4. Check Transaction Status.
5. Webhook (payload, signature, retry, idempotency).
6. Error codes dan solusi umum.
7. Changelog `/v1`.

Contoh kode minimal:

- cURL
- JavaScript/TypeScript
- PHP

## 10. Milestone Implementasi MVP

### Milestone 1

- Setup Next.js + Prisma + MySQL.
- Auth + basic dashboard shell.
- CRUD project + generate API key.

### Milestone 2

- Integrasi create transaction ke Gateway.
- Sinkron status transaksi (polling/detail + callback).
- List transaksi + detail.

### Milestone 3

- Webhook delivery ke merchant + webhook logs.
- Settings project lengkap (webhook URL, slug, rotate API key).
- Hardening baseline (rate limit, idempotency).

### Milestone 4

- OpenAPI spec v1.
- API docs page publik.
- End-to-end testing basic flow.

## 11. Catatan Produk & Compliance

- Positioning awal: onboarding cepat tanpa KYC rumit.
- Tetap siapkan guardrail risiko: limit nominal/volume akun baru, monitoring abuse, kebijakan upgrade verifikasi saat volume meningkat.

Langkah ini menjaga pertumbuhan awal tanpa mengorbankan kontrol risiko.
