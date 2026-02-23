function getConfig() {
  const baseUrl = process.env.GATEWAY_BASE_URL;
  const project = process.env.GATEWAY_PROJECT;
  const apiKey = process.env.GATEWAY_API_KEY;
  const callbackToken = process.env.GATEWAY_CALLBACK_TOKEN || "";
  return { baseUrl, project, apiKey, callbackToken };
}

export function isGatewayConfigured() {
  const { project, apiKey } = getConfig();
  return Boolean(project && apiKey);
}

function unwrapGatewayPayload(json) {
  if (!json || typeof json !== "object") return {};
  if (json.data && typeof json.data === "object") return json.data;
  if (json.payment && typeof json.payment === "object") return json.payment;
  if (json.transaction && typeof json.transaction === "object") return json.transaction;
  if (json.result && typeof json.result === "object") return json.result;
  if (json.response && typeof json.response === "object") return json.response;
  return json;
}

function mapMethodToPath(method) {
  const normalized = (method || "").toLowerCase();
  if (!normalized) return "qris";
  return normalized;
}

export function mapGatewayStatus(status) {
  const s = (status || "").toLowerCase();
  if (s === "completed" || s === "paid" || s === "success") return "paid";
  if (s === "expired") return "expired";
  if (s === "failed" || s === "cancelled" || s === "canceled") return "failed";
  return "pending";
}

function toDateMaybe(input) {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function pickFirst(data, keys) {
  for (const key of keys) {
    const value = data?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function extractPaymentInstrument(data) {
  const paymentNumber = pickFirst(data, [
    "payment_number",
    "va_number",
    "virtual_account",
    "virtual_account_number",
    "nomor_va",
    "va",
  ]);

  const qrString = pickFirst(data, [
    "qr_string",
    "qris_string",
    "qr_content",
    "qr_code",
    "qr_text",
    "qris_payload",
    "payload",
  ]);

  const qrImageUrl = pickFirst(data, ["qr_url", "qris_url", "qr_image", "qr_image_url", "qrcode_url"]);

  return {
    paymentNumber,
    qrString,
    qrImageUrl,
  };
}

export function parseDetailResponse(data) {
  const gatewayStatus = data?.status || null;
  const instrument = extractPaymentInstrument(data);
  return {
    gatewayStatus,
    normalizedStatus: mapGatewayStatus(gatewayStatus),
    fee: Number(data?.fee ?? 0) || 0,
    amount: Number(data?.amount ?? 0) || 0,
    totalPayment: Number(data?.total_payment ?? 0) || 0,
    paymentNumber: instrument.paymentNumber,
    qrString: instrument.qrString,
    qrImageUrl: instrument.qrImageUrl,
    expiredAt: toDateMaybe(data?.expired_at),
    paidAt: toDateMaybe(data?.completed_at),
    gatewayCompletedAt: toDateMaybe(data?.completed_at),
    raw: data || {},
  };
}

export async function createGatewayTransaction({
  method,
  amount,
  orderId,
  payerName,
  callbackUrl,
}) {
  const { baseUrl, project, apiKey } = getConfig();
  if (!project || !apiKey) {
    throw new Error("Gateway credentials are not configured");
  }

  const pathMethod = mapMethodToPath(method);
  const url = `${baseUrl}/api/transactioncreate/${encodeURIComponent(pathMethod)}`;
  const payload = {
    project,
    amount,
    order_id: orderId,
    api_key: apiKey,
    payer_name: payerName || "Customer",
  };
  if (callbackUrl) payload.callback_url = callbackUrl;

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok || json?.status === "failed") {
    const reason = json?.msg || json?.message || "Gateway create transaction failed";
    throw new Error(reason);
  }

  return unwrapGatewayPayload(json);
}

export async function fetchGatewayTransactionDetail({ amount, orderId }) {
  const { baseUrl, project, apiKey } = getConfig();
  if (!project || !apiKey) {
    throw new Error("Gateway credentials are not configured");
  }

  const params = new URLSearchParams({
    project,
    amount: String(amount),
    order_id: String(orderId),
    api_key: apiKey,
  });
  const url = `${baseUrl}/api/transactiondetail?${params.toString()}`;
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.status === "failed") {
    const reason = json?.msg || json?.message || "Gateway detail fetch failed";
    throw new Error(reason);
  }
  return unwrapGatewayPayload(json);
}

export function getGatewayCallbackToken() {
  return getConfig().callbackToken;
}
