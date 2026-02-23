# Pay MVP OpenAPI v1 Draft

Dokumen ini diselaraskan dengan implementasi Milestone 2 yang sudah ada di codebase.

## 1. API Metadata

- Version: `v1`
- Base URL (relative): `/api/v1`
- Content-Type: `application/json`

Contoh base URL production:

- `https://paymvp.com/api/v1`

## 2. Authentication

Merchant API memakai API key project.

Header:

```http
Authorization: Bearer bq_live_xxxxxxxxx
```

Jika token invalid atau revoked, API akan return `401 UNAUTHORIZED`.

## 3. Response Envelope

### Success

```json
{
  "success": true,
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid payload",
    "details": []
  }
}
```

## 4. Transaction Status

Status normalized di sistem:

- `pending`
- `paid`
- `failed`
- `expired`

## 5. Merchant API Endpoints (Implemented)

## 5.1 Create Transaction

- Method: `POST`
- Path: `/transactions`
- Auth: required (`Bearer`)
- Header wajib: `Idempotency-Key`

Request body:

```json
{
  "external_id": "INV-2026-0001",
  "method": "bni_va",
  "amount": 150000,
  "customer_name": "Budi"
}
```

Supported `method` values:

- `cimb_niaga_va`
- `bni_va`
- `qris`
- `sampoerna_va`
- `bnc_va`
- `maybank_va`
- `permata_va`
- `atm_bersama_va`
- `artha_graha_va`
- `bri_va`
- `paypal`

Integration rule:

- Payload tetap sama, cukup ganti parameter `method`.

Response (201):

```json
{
  "success": true,
  "data": {
    "id": "cm9...",
    "external_id": "INV-2026-0001",
    "gateway_order_id": "paymvp-abc123",
    "method": "qris",
    "status": "pending",
    "amount": 150000,
    "total_payment": 150000,
    "payment_number": "VA-00112233",
    "expired_at": "2026-02-24T10:00:00.000Z"
  }
}
```

Fee rules:

- QRIS below Rp 110,000: `2% + Rp 500`
- QRIS from Rp 110,000 and above: `2.5%`
- Virtual Account (all methods): `Rp 4,500`
- PayPal: `3%`

Catatan implementasi saat ini:

- Field wajib: `external_id`, `method`, `amount`.
- `Idempotency-Key` wajib untuk create transaction.
- Retry dengan key yang sama dan payload sama akan replay response sukses sebelumnya.
- Retry dengan key yang sama tapi payload berbeda akan return `409 IDEMPOTENCY_CONFLICT`.

## 5.2 List Transactions

- Method: `GET`
- Path: `/transactions`
- Auth: required (`Bearer`)
- Query:
- `status` (optional)
- `page` (default `1`)
- `per_page` (default `20`, max `100`)

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "cm9...",
        "external_id": "INV-2026-0001",
        "method": "qris",
        "status": "paid",
        "amount": 150000,
        "total_payment": 150000,
        "created_at": "2026-02-24T09:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 1
    }
  }
}
```

## 5.3 Get Transaction Detail

- Method: `GET`
- Path: `/transactions/{transactionId}`
- Auth: required (`Bearer`)

Response:

```json
{
  "success": true,
  "data": {
    "id": "cm9...",
    "external_id": "INV-2026-0001",
    "gateway_order_id": "paymvp-abc123",
    "method": "qris",
    "status": "paid",
    "amount": 150000,
    "total_payment": 150000,
    "payment_number": "VA-00112233",
    "expired_at": "2026-02-24T10:00:00.000Z",
    "paid_at": "2026-02-24T09:05:00.000Z",
    "created_at": "2026-02-24T09:00:00.000Z"
  }
}
```

## 5.4 Sync Transaction Status (Polling Detail)

- Method: `POST`
- Path: `/transactions/{transactionId}/sync`
- Auth: required (`Bearer`)

Fungsi:

- Ambil detail status terbaru dari Gateway.
- Update status transaction di database.
- Jika status berubah ke final (`paid`, `failed`, `expired`), sistem akan kirim webhook ke `project.webhookUrl` dan simpan `webhook_logs`.

Response:

```json
{
  "success": true,
  "data": {
    "id": "cm9...",
    "status": "paid",
    "gateway_status": "completed",
    "paid_at": "2026-02-24T09:05:00.000Z"
  }
}
```

## 6. Internal Callback Endpoint (Implemented)

## 6.1 Gateway Callback Receiver

- Method: `POST`
- Path: `/internal/gateway/callback?token={GATEWAY_CALLBACK_TOKEN}`
- Auth: token query param (opsional, aktif jika `GATEWAY_CALLBACK_TOKEN` diset)

Payload minimum:

```json
{
  "order_id": "paymvp-abc123",
  "status": "completed"
}
```

Catatan:

- Endpoint ini tetap melakukan verifikasi detail ke API Gateway berdasarkan `order_id`, lalu update status internal.
- Jika status final, sistem kirim webhook ke merchant dan simpan `webhook_logs`.

Response:

```json
{
  "success": true,
  "data": {
    "transaction_id": "cm9...",
    "status": "paid"
  }
}
```

## 7. Merchant Webhook Delivery (Implemented)

Saat status transaksi masuk final state, sistem mengirim webhook ke `project.webhookUrl`.

Method:

- `POST`

Payload:

```json
{
  "id": "evt_cm9...",
  "type": "transaction.paid",
  "created_at": "2026-02-24T09:05:00.000Z",
  "data": {
    "transaction_id": "cm9...",
    "external_id": "INV-2026-0001",
    "status": "paid",
    "method": "qris",
    "amounts": {
      "amount": 150000,
      "total_payment": 150000
    },
    "paid_at": "2026-02-24T09:05:00.000Z"
  }
}
```

Semua delivery attempt dicatat di tabel `WebhookLog`.

## 8. Error Codes (Current)

- `INVALID_REQUEST` -> body/query invalid (`400`)
- `UNAUTHORIZED` -> API key atau callback token invalid (`401`)
- `NOT_FOUND` -> resource tidak ditemukan (`404`)
- `IDEMPOTENCY_CONFLICT` -> key idempotency reuse dengan payload berbeda (`409`)
- `IDEMPOTENCY_IN_PROGRESS` -> key idempotency sedang diproses (`409`)
- `RATE_LIMITED` -> limit request per minute terlewati (`429`)
- `GATEWAY_ERROR` -> error saat komunikasi ke Gateway (`502`)
- `GATEWAY_NOT_CONFIGURED` -> env Gateway belum diset (`500`)

## 9. cURL Examples

Create transaction:

```bash
curl -X POST "https://paymvp.com/api/v1/transactions" \
  -H "Authorization: Bearer bq_live_xxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "INV-2026-0001",
    "method": "qris",
    "amount": 150000,
    "customer_name": "Budi"
  }'
```

Sync status:

```bash
curl -X POST "https://paymvp.com/api/v1/transactions/{transactionId}/sync" \
  -H "Authorization: Bearer bq_live_xxxxxxxxx"
```

Callback endpoint:

```bash
curl -X POST "https://paymvp.com/api/v1/internal/gateway/callback?token=change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "paymvp-abc123",
    "status": "completed"
  }'
```

## 10. Next Step

- Tambahkan API docs untuk endpoint dashboard internal (`/dashboard/*`) jika akan dibuka sebagai public API.
- Tambahkan signature verification untuk webhook delivery outbound ke merchant.
- Tambahkan retry policy dengan backoff + dead-letter strategy.
