import { z } from "zod";
import { authenticateMerchantRequest } from "@/lib/merchant-auth";
import { getAppBaseUrl } from "@/lib/config";
import { calculateTotalFeeByMethod } from "@/lib/fee";
import { jsonError, jsonOk } from "@/lib/http";
import { hashPayload, initIdempotency, storeIdempotencyResponse } from "@/lib/idempotency";
import { SUPPORTED_PAYMENT_METHODS } from "@/lib/payment-methods";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  createGatewayTransaction,
  getGatewayCallbackToken,
  isGatewayConfigured,
  parseDetailResponse,
} from "@/lib/gateway";

const createSchema = z.object({
  external_id: z.string().min(3),
  method: z.enum(SUPPORTED_PAYMENT_METHODS),
  amount: z.number().int().positive(),
  customer_name: z.string().optional(),
});

function generateGatewayOrderId(project) {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${project.appSlug}-${stamp}-${rand}`;
}

export async function POST(request) {
  if (!isGatewayConfigured()) {
    return jsonError("GATEWAY_NOT_CONFIGURED", "Gateway credentials are missing", 500);
  }

  const auth = await authenticateMerchantRequest(request);
  if (!auth) return jsonError("UNAUTHORIZED", "Invalid API key", 401);
  const rate = await enforceRateLimit({
    projectId: auth.project.id,
    routeKey: "transactions:create",
    limit: 60,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return jsonError("RATE_LIMITED", "Too many requests", 429, [], rate.headers);
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("INVALID_REQUEST", "Invalid payload", 400, parsed.error.issues, rate.headers);
  }

  const idemKey = request.headers.get("idempotency-key");
  if (!idemKey) {
    return jsonError("INVALID_REQUEST", "Idempotency-Key header is required", 400, [], rate.headers);
  }

  const idem = await initIdempotency({
    projectId: auth.project.id,
    key: idemKey,
    requestHash: hashPayload(parsed.data),
  });
  if (idem.kind === "conflict") {
    return jsonError(
      "IDEMPOTENCY_CONFLICT",
      "Idempotency key already used with different payload",
      409,
      [],
      rate.headers,
    );
  }
  if (idem.kind === "replay") {
    return jsonOk(idem.record.responseBody, idem.record.responseStatus, rate.headers);
  }
  if (idem.kind === "in_progress") {
    return jsonError(
      "IDEMPOTENCY_IN_PROGRESS",
      "Request with this idempotency key is still processing",
      409,
      [],
      rate.headers,
    );
  }
  if (idem.kind === "retry_unknown") {
    return jsonError("INTERNAL_ERROR", "Unable to resolve idempotency state", 500, [], rate.headers);
  }

  const gatewayOrderId = generateGatewayOrderId(auth.project);
  let gateway;
  const baseAppUrl = getAppBaseUrl();
  const callbackToken = getGatewayCallbackToken();
  const callbackUrl = callbackToken
    ? `${baseAppUrl}/api/v1/internal/gateway/callback?token=${encodeURIComponent(callbackToken)}`
    : `${baseAppUrl}/api/v1/internal/gateway/callback`;

  try {
    gateway = await createGatewayTransaction({
      method: parsed.data.method,
      amount: parsed.data.amount,
      orderId: gatewayOrderId,
      payerName: parsed.data.customer_name || "Customer",
      callbackUrl,
    });
  } catch (error) {
    return jsonError("GATEWAY_ERROR", String(error?.message || error), 502, [], rate.headers);
  }

  const detail = parseDetailResponse(gateway);
  const totalFee = calculateTotalFeeByMethod(parsed.data.method, parsed.data.amount);
  const grossAmount = parsed.data.amount;
  const transaction = await prisma.transaction.create({
    data: {
      projectId: auth.project.id,
      externalId: parsed.data.external_id,
      gatewayOrderId,
      method: parsed.data.method,
      status: detail.normalizedStatus,
      amount: grossAmount,
      fee: totalFee,
      totalPayment: grossAmount,
      paymentNumber: detail.paymentNumber,
      expiredAt: detail.expiredAt,
      paidAt: detail.paidAt,
      gatewayStatus: detail.gatewayStatus,
      gatewayCompletedAt: detail.gatewayCompletedAt,
      gatewayRaw: detail.raw,
    },
  });

  const responseData = {
    id: transaction.id,
    external_id: transaction.externalId,
    gateway_order_id: transaction.gatewayOrderId,
    method: transaction.method,
    status: transaction.status,
    amount: transaction.amount,
    total_payment: transaction.totalPayment || transaction.amount,
    payment_number: transaction.paymentNumber,
    qr_string: detail.qrString || null,
    qr_image_url: detail.qrImageUrl || null,
    expired_at: transaction.expiredAt?.toISOString() || null,
  };
  if (idem.kind === "new") {
    await storeIdempotencyResponse({
      recordId: idem.record.id,
      status: 201,
      body: responseData,
    });
  }
  return jsonOk(responseData, 201, rate.headers);
}

export async function GET(request) {
  const auth = await authenticateMerchantRequest(request);
  if (!auth) return jsonError("UNAUTHORIZED", "Invalid API key", 401);
  const rate = await enforceRateLimit({
    projectId: auth.project.id,
    routeKey: "transactions:list",
    limit: 120,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return jsonError("RATE_LIMITED", "Too many requests", 429, [], rate.headers);
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const page = Number(searchParams.get("page") || 1);
  const perPage = Math.min(Number(searchParams.get("per_page") || 20), 100);

  const where = {
    projectId: auth.project.id,
    ...(status ? { status } : {}),
  };

  const [total, data] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        externalId: true,
        method: true,
        status: true,
        amount: true,
        fee: true,
        totalPayment: true,
        createdAt: true,
      },
    }),
  ]);

  return jsonOk(
    {
      items: data.map((item) => ({
        id: item.id,
        external_id: item.externalId,
        method: item.method,
        status: item.status,
        amount: item.amount,
        total_payment: item.totalPayment || item.amount,
        created_at: item.createdAt.toISOString(),
      })),
      pagination: { page, per_page: perPage, total },
    },
    200,
    rate.headers,
  );
}
