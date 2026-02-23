import crypto from "node:crypto";
import http from "node:http";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APP_PORT = Number(process.env.E2E_APP_PORT || 3100);
const GATEWAY_PORT = Number(process.env.E2E_GATEWAY_PORT || 4010);
const WEBHOOK_PORT = Number(process.env.E2E_WEBHOOK_PORT || 4020);
const GATEWAY_URL = `http://127.0.0.1:${GATEWAY_PORT}`;
const CALLBACK_TOKEN = "e2e-callback-token";
const GATEWAY_PROJECT = "e2e-project";
const GATEWAY_API_KEY = "e2e-api-key";
const API_KEY = "bq_live_e2e_paymvp_key";
const API_KEY_HASH = crypto.createHash("sha256").update(API_KEY).digest("hex");

const gatewayState = new Map();
const merchantWebhookEvents = [];

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let chunks = "";
    req.on("data", (chunk) => {
      chunks += chunk;
    });
    req.on("end", () => {
      if (!chunks) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(chunks));
      } catch {
        resolve({});
      }
    });
  });
}

function createGatewayMockServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", GATEWAY_URL);

    if (req.method === "POST" && url.pathname.startsWith("/api/transactioncreate/")) {
      const body = await parseJsonBody(req);
      if (body.project !== GATEWAY_PROJECT || body.api_key !== GATEWAY_API_KEY) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "failed", msg: "invalid credentials" }));
        return;
      }

      const orderId = String(body.order_id || "");
      const amount = Number(body.amount || 0);
      gatewayState.set(orderId, {
        status: "pending",
        amount,
        fee: 500,
        total_payment: amount + 500,
        payment_number: `VA-${orderId.slice(-8)}`,
        completed_at: null,
      });

      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          status: "success",
          data: {
            status: "pending",
            amount,
            fee: 500,
            total_payment: amount + 500,
            payment_number: `VA-${orderId.slice(-8)}`,
            expired_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          },
        }),
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/transactiondetail") {
      const orderId = url.searchParams.get("order_id") || "";
      const item = gatewayState.get(orderId);
      if (!item) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "failed", msg: "order not found" }));
        return;
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          status: "success",
          data: {
            status: item.status,
            amount: item.amount,
            fee: item.fee,
            total_payment: item.total_payment,
            payment_number: item.payment_number,
            expired_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            completed_at: item.completed_at,
          },
        }),
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/__set-status") {
      const body = await parseJsonBody(req);
      const orderId = String(body.order_id || "");
      const status = String(body.status || "pending");
      const item = gatewayState.get(orderId);
      if (!item) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false }));
        return;
      }
      item.status = status;
      item.completed_at = status === "completed" ? new Date().toISOString() : null;
      gatewayState.set(orderId, item);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "failed", msg: "not found" }));
  });
}

function createWebhookReceiverServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${WEBHOOK_PORT}`);
    if (req.method === "POST" && url.pathname === "/webhook") {
      const body = await parseJsonBody(req);
      merchantWebhookEvents.push(body);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false }));
  });
}

async function waitForHttp(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.status < 500) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function isHttpReady(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findFreePort(startPort, maxOffset = 20) {
  for (let offset = 0; offset <= maxOffset; offset += 1) {
    const port = startPort + offset;
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found from ${startPort} to ${startPort + maxOffset}`);
}

async function seedE2EData() {
  const email = "e2e@paymvp.com";
  const passwordHash = await bcrypt.hash("password123", 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: "E2E User", passwordHash },
    create: { name: "E2E User", email, passwordHash },
  });

  const project = await prisma.project.upsert({
    where: { appSlug: "e2e-project-main" },
    update: {
      userId: user.id,
      name: "E2E Main",
      webhookUrl: `http://127.0.0.1:${WEBHOOK_PORT}/webhook`,
      isActive: true,
    },
    create: {
      userId: user.id,
      name: "E2E Main",
      appSlug: "e2e-project-main",
      webhookUrl: `http://127.0.0.1:${WEBHOOK_PORT}/webhook`,
      isActive: true,
    },
  });

  await prisma.apiKey.updateMany({
    where: { projectId: project.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await prisma.apiKey.upsert({
    where: { keyHash: API_KEY_HASH },
    update: {
      projectId: project.id,
      keyPrefix: API_KEY.slice(0, 15),
      revokedAt: null,
    },
    create: {
      projectId: project.id,
      keyHash: API_KEY_HASH,
      keyPrefix: API_KEY.slice(0, 15),
    },
  });

  return { projectId: project.id };
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${url}: ${JSON.stringify(json)}`);
  }
  return json;
}

function closeServer(server) {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

async function stopChildProcess(child) {
  if (!child) return;
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    sleep(3000).then(() => false),
  ]);
  if (!exited) {
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("exit", () => resolve()));
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const gatewayServer = createGatewayMockServer();
  const webhookServer = createWebhookReceiverServer();

  await new Promise((resolve) => gatewayServer.listen(GATEWAY_PORT, "127.0.0.1", resolve));
  await new Promise((resolve) => webhookServer.listen(WEBHOOK_PORT, "127.0.0.1", resolve));

  const { projectId } = await seedE2EData();

  let nextDev = null;
  const useExistingApp = String(process.env.E2E_USE_EXISTING_APP || "").toLowerCase() === "true";
  const appPort = useExistingApp ? APP_PORT : await findFreePort(APP_PORT);
  const appUrl = `http://127.0.0.1:${appPort}`;
  const alreadyRunning = await isHttpReady(`${appUrl}/login`);
  if (!useExistingApp && !alreadyRunning) {
    const buildResult = spawnSync(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "build"],
      {
        stdio: "inherit",
        env: process.env,
      },
    );
    if (buildResult.status !== 0) {
      throw new Error("Build failed before e2e flow test");
    }

    nextDev = spawn(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "start", "--", "--port", String(appPort)],
      {
        stdio: "pipe",
        env: {
          ...process.env,
          APP_NAME: "Pay MVP",
          APP_URL: appUrl,
          GATEWAY_BASE_URL: GATEWAY_URL,
          GATEWAY_PROJECT,
          GATEWAY_API_KEY,
          GATEWAY_CALLBACK_TOKEN: CALLBACK_TOKEN,
        },
      },
    );

    nextDev.stdout.on("data", (chunk) => process.stdout.write(`[next] ${chunk}`));
    nextDev.stderr.on("data", (chunk) => process.stderr.write(`[next] ${chunk}`));
  }
  if (useExistingApp && !alreadyRunning) {
    throw new Error(
      `App is not running at ${appUrl}. Start app first or omit E2E_USE_EXISTING_APP.`,
    );
  }

  try {
    await waitForHttp(`${appUrl}/login`);

    const create1 = await requestJson(`${appUrl}/api/v1/transactions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${API_KEY}`,
        "content-type": "application/json",
        "idempotency-key": `idem-cb-${Date.now()}`,
      },
      body: JSON.stringify({
        external_id: `E2E-CB-${Date.now()}`,
        method: "qris",
        amount: 120000,
        customer_name: "E2E Customer",
      }),
    });

    const tx1 = create1.data;
    await requestJson(`${GATEWAY_URL}/__set-status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order_id: tx1.gateway_order_id, status: "completed" }),
    });

    await requestJson(`${appUrl}/api/v1/internal/gateway/callback?token=${CALLBACK_TOKEN}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order_id: tx1.gateway_order_id, status: "completed" }),
    });

    const create2 = await requestJson(`${appUrl}/api/v1/transactions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${API_KEY}`,
        "content-type": "application/json",
        "idempotency-key": `idem-sync-${Date.now()}`,
      },
      body: JSON.stringify({
        external_id: `E2E-SYNC-${Date.now()}`,
        method: "qris",
        amount: 130000,
      }),
    });

    const tx2 = create2.data;
    await requestJson(`${GATEWAY_URL}/__set-status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order_id: tx2.gateway_order_id, status: "completed" }),
    });
    await requestJson(`${appUrl}/api/v1/transactions/${tx2.id}/sync`, {
      method: "POST",
      headers: { authorization: `Bearer ${API_KEY}` },
    });

    await sleep(300);

    const [stored1, stored2, logs] = await Promise.all([
      prisma.transaction.findUnique({ where: { id: tx1.id } }),
      prisma.transaction.findUnique({ where: { id: tx2.id } }),
      prisma.webhookLog.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    if (stored1?.status !== "paid") {
      throw new Error(`Callback flow failed: tx1 status is ${stored1?.status}`);
    }
    if (stored2?.status !== "paid") {
      throw new Error(`Sync flow failed: tx2 status is ${stored2?.status}`);
    }
    if (logs.length < 2) {
      throw new Error(`Expected at least 2 webhook logs, got ${logs.length}`);
    }
    if (merchantWebhookEvents.length < 2) {
      throw new Error(
        `Expected merchant webhook receiver to get >=2 events, got ${merchantWebhookEvents.length}`,
      );
    }

    console.log("E2E flow success.");
    console.log(
      JSON.stringify(
        {
          tx_callback: { id: tx1.id, status: stored1.status },
          tx_sync: { id: tx2.id, status: stored2.status },
          webhook_log_count: logs.length,
          merchant_event_count: merchantWebhookEvents.length,
        },
        null,
        2,
      ),
    );
  } finally {
    await stopChildProcess(nextDev);
    await closeServer(gatewayServer);
    await closeServer(webhookServer);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
