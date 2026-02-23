export function calculateTotalFeeByMethod(method, amount) {
  const normalizedMethod = String(method || "").toLowerCase();
  const nominal = Number(amount || 0);

  if (normalizedMethod === "qris") {
    if (nominal >= 110000) {
      return Math.round(nominal * 0.025);
    }
    return Math.round(nominal * 0.02) + 500;
  }

  if (normalizedMethod.endsWith("_va")) {
    return 4500;
  }

  if (normalizedMethod === "paypal") {
    return Math.round(nominal * 0.03);
  }

  return 0;
}

export function splitFeeRevenue(totalFee, platformFeeSetting) {
  const fee = Math.max(0, Number(totalFee || 0));
  const platformShare = Math.min(fee, Math.max(0, Number(platformFeeSetting || 0)));
  const providerShare = Math.max(0, fee - platformShare);

  return {
    providerShare,
    platformShare,
  };
}

export function calculateReceivedAmount(amount, totalFee) {
  const nominal = Math.max(0, Number(amount || 0));
  const fee = Math.max(0, Number(totalFee || 0));
  return Math.max(0, nominal - fee);
}
