import { prisma } from "@/lib/prisma";
import { calculateTotalFeeByMethod } from "@/lib/fee";
import { fetchGatewayTransactionDetail, parseDetailResponse } from "@/lib/gateway";
import { setTimeout as sleep } from "node:timers/promises";

function buildMerchantEventType(status) {
  return `transaction.${status}`;
}

export async function deliverMerchantWebhook(transaction) {
  const targetUrl = transaction.project.webhookUrl;
  const eventType = buildMerchantEventType(transaction.status);
  const payload = {
    id: `evt_${transaction.id}`,
    type: eventType,
    created_at: new Date().toISOString(),
    data: {
      transaction_id: transaction.id,
      external_id: transaction.externalId,
      status: transaction.status,
      method: transaction.method,
      amounts: {
        amount: transaction.amount,
        total_payment: transaction.totalPayment || transaction.amount,
      },
      paid_at: transaction.paidAt?.toISOString() || null,
    },
  };

  const maxAttempt = 3;

  for (let attemptNo = 1; attemptNo <= maxAttempt; attemptNo += 1) {
    let responseCode = null;
    let responseBody = null;
    let isSuccess = false;

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      responseCode = response.status;
      responseBody = await response.text();
      isSuccess = response.ok;
    } catch (error) {
      responseBody = String(error?.message || error);
    }

    await prisma.webhookLog.create({
      data: {
        projectId: transaction.projectId,
        transactionId: transaction.id,
        eventType,
        attemptNo,
        isSuccess,
        targetUrl,
        requestBody: payload,
        responseCode,
        responseBody,
      },
    });

    if (isSuccess) break;
    if (attemptNo < maxAttempt) {
      await sleep(300 * 2 ** (attemptNo - 1));
    }
  }
}

export async function syncTransactionWithGateway(transactionId) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { project: true },
  });
  if (!transaction) return null;

  const detail = await fetchGatewayTransactionDetail({
    amount: transaction.amount,
    orderId: transaction.gatewayOrderId,
  });
  const parsed = parseDetailResponse(detail);
  const totalFee = calculateTotalFeeByMethod(transaction.method, transaction.amount);

  const previousStatus = transaction.status;
  const updated = await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      status: parsed.normalizedStatus,
      fee: totalFee,
      totalPayment: transaction.amount,
      paymentNumber: parsed.paymentNumber || transaction.paymentNumber,
      expiredAt: parsed.expiredAt,
      paidAt: parsed.paidAt,
      gatewayStatus: parsed.gatewayStatus,
      gatewayCompletedAt: parsed.gatewayCompletedAt,
      gatewayRaw: parsed.raw,
    },
    include: { project: true },
  });

  if (previousStatus !== updated.status && ["paid", "failed", "expired"].includes(updated.status)) {
    await deliverMerchantWebhook(updated);
  }

  return updated;
}
