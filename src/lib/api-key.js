import crypto from "node:crypto";

export function generateRawApiKey() {
  return `bq_live_${crypto.randomBytes(24).toString("hex")}`;
}

export function hashApiKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function getApiKeyPrefix(key) {
  return key.slice(0, 15);
}
