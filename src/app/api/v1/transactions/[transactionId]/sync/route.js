import { authenticateMerchantRequest } from "@/lib/merchant-auth";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { syncTransactionWithGateway } from "@/lib/transaction-sync";

export async function POST(request, { params }) {
  const auth = await authenticateMerchantRequest(request);
  if (!auth) return jsonError("UNAUTHORIZED", "Invalid API key", 401);
  const rate = await enforceRateLimit({
    projectId: auth.project.id,
    routeKey: "transactions:sync",
    limit: 60,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return jsonError("RATE_LIMITED", "Too many requests", 429, [], rate.headers);
  }

  const { transactionId } = await params;
  const own = await prisma.transaction.findFirst({
    where: { id: transactionId, projectId: auth.project.id },
    select: { id: true },
  });
  if (!own) return jsonError("NOT_FOUND", "Transaction not found", 404, [], rate.headers);

  try {
    const updated = await syncTransactionWithGateway(transactionId);
    return jsonOk(
      {
        id: updated.id,
        status: updated.status,
        gateway_status: updated.gatewayStatus,
        total_payment: updated.totalPayment || updated.amount,
        payment_number: updated.paymentNumber || null,
        qr_string:
          typeof updated.gatewayRaw?.qr_string === "string"
            ? updated.gatewayRaw.qr_string
            : typeof updated.gatewayRaw?.qris_string === "string"
              ? updated.gatewayRaw.qris_string
              : null,
        paid_at: updated.paidAt?.toISOString() || null,
      },
      200,
      rate.headers,
    );
  } catch (error) {
    return jsonError("GATEWAY_ERROR", String(error?.message || error), 502, [], rate.headers);
  }
}
