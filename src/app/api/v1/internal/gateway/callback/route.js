import { handleGatewayCallback } from "@/lib/gateway-callback";

export async function POST(request) {
  return handleGatewayCallback(request);
}
