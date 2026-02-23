import { authenticateMerchantRequest } from "@/lib/merchant-auth";
import { extractPaymentInstrument } from "@/lib/gateway";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function GET(_request, { params }) {
  const auth = await authenticateMerchantRequest(_request);
  if (!auth) return jsonError("UNAUTHORIZED", "Invalid API key", 401);
  const rate = await enforceRateLimit({
    projectId: auth.project.id,
    routeKey: "transactions:detail",
    limit: 120,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return jsonError("RATE_LIMITED", "Too many requests", 429, [], rate.headers);
  }

  const { transactionId } = await params;
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      projectId: auth.project.id,
    },
  });
  if (!transaction) return jsonError("NOT_FOUND", "Transaction not found", 404, [], rate.headers);
  const instrument = extractPaymentInstrument(transaction.gatewayRaw || {});

  return jsonOk(
    {
      id: transaction.id,
      external_id: transaction.externalId,
      gateway_order_id: transaction.gatewayOrderId,
      method: transaction.method,
      status: transaction.status,
      amount: transaction.amount,
      total_payment: transaction.totalPayment || transaction.amount,
      payment_number: transaction.paymentNumber || instrument.paymentNumber || null,
      qr_string: instrument.qrString || null,
      qr_image_url: instrument.qrImageUrl || null,
      expired_at: transaction.expiredAt?.toISOString() || null,
      paid_at: transaction.paidAt?.toISOString() || null,
      created_at: transaction.createdAt.toISOString(),
    },
    200,
    rate.headers,
  );
}
