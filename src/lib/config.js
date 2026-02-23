export function getAppName() {
  return process.env.APP_NAME || "Pay MVP";
}

export function getAppBaseUrl() {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }

  const domain = process.env.APP_DOMAIN;
  if (!domain) return "http://localhost:3000";

  const protocol = process.env.APP_PROTOCOL || "https";
  return `${protocol}://${domain}`.replace(/\/$/, "");
}
