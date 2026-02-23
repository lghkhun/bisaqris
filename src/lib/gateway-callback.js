import { jsonError, jsonOk } from "@/lib/http";
import { getGatewayCallbackToken, isGatewayConfigured } from "@/lib/gateway";
import { prisma } from "@/lib/prisma";
import { syncTransactionWithGateway } from "@/lib/transaction-sync";

export async function handleGatewayCallback(request) {
  if (!isGatewayConfigured()) {
    return jsonError("GATEWAY_NOT_CONFIGURED", "Gateway credentials are missing", 500);
  }

  const token = getGatewayCallbackToken();
  const { searchParams } = new URL(request.url);
  if (token && searchParams.get("token") !== token) {
    return jsonError("UNAUTHORIZED", "Invalid callback token", 401);
  }

  const payload = await request.json().catch(() => null);
  const orderId = payload?.order_id;
  if (!orderId) return jsonError("INVALID_REQUEST", "order_id is required", 400);

  const transaction = await prisma.transaction.findUnique({
    where: { gatewayOrderId: orderId },
    select: { id: true },
  });
  if (!transaction) return jsonError("NOT_FOUND", "Transaction not found", 404);

  try {
    const updated = await syncTransactionWithGateway(transaction.id);
    return jsonOk({ transaction_id: updated.id, status: updated.status });
  } catch (error) {
    return jsonError("GATEWAY_ERROR", String(error?.message || error), 502);
  }
}
