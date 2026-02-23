import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getAppName } from "@/lib/config";
import { SUPPORTED_PAYMENT_METHODS } from "@/lib/payment-methods";
import { prisma } from "@/lib/prisma";
import CopyCodeBlock from "./CopyCodeBlock";
import DocsSidebar from "./DocsSidebar";
import TryItPanel from "./TryItPanel";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "quickstart", label: "Quickstart" },
  { id: "auth", label: "Authentication" },
  { id: "endpoints", label: "Endpoints" },
  { id: "examples", label: "Examples" },
  { id: "errors", label: "Errors" },
  { id: "testing", label: "E2E Testing" },
];

const endpoints = [
  {
    method: "POST",
    anchor: "create-transaction",
    path: "/api/v1/transactions",
    summary: "Create transaction",
    req: `{
  "external_id": "INV-2026-0001",
  "method": "bni_va",
  "amount": 150000,
  "customer_name": "Budi"
}`,
    res: `{
  "success": true,
  "data": {
    "id": "cm...",
    "external_id": "INV-2026-0001",
    "gateway_order_id": "paymvp-abc123",
    "status": "pending"
  }
}`,
  },
  {
    method: "GET",
    anchor: "list-transactions",
    path: "/api/v1/transactions",
    summary: "List transactions",
    req: "Query: status, page, per_page",
    res: `{
  "success": true,
  "data": {
    "items": [],
    "pagination": { "page": 1, "per_page": 20, "total": 0 }
  }
}`,
  },
  {
    method: "GET",
    anchor: "transaction-detail",
    path: "/api/v1/transactions/{transactionId}",
    summary: "Transaction detail",
    req: "Path: transactionId",
    res: `{
  "success": true,
  "data": {
    "id": "cm...",
    "status": "paid"
  }
}`,
  },
  {
    method: "POST",
    anchor: "sync-transaction",
    path: "/api/v1/transactions/{transactionId}/sync",
    summary: "Sync status from gateway",
    req: "Path: transactionId",
    res: `{
  "success": true,
  "data": {
    "id": "cm...",
    "status": "paid",
    "gateway_status": "completed"
  }
}`,
  },
  {
    method: "POST",
    anchor: "gateway-callback",
    path: "/api/v1/internal/gateway/callback?token=...",
    summary: "Gateway callback endpoint",
    req: `{
  "order_id": "paymvp-abc123",
  "status": "completed"
}`,
    res: `{
  "success": true,
  "data": {
    "transaction_id": "cm...",
    "status": "paid"
  }
}`,
  },
];

const curlCreate = `curl -X POST "https://paymvp.com/api/v1/transactions" \\
  -H "Authorization: Bearer bq_live_xxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: inv-2026-0001" \\
  -d '{
    "external_id": "INV-2026-0001",
    "method": "bni_va",
    "amount": 150000,
    "customer_name": "Budi"
  }'`;

const curlSync = `curl -X POST "https://paymvp.com/api/v1/transactions/{transactionId}/sync" \\
  -H "Authorization: Bearer bq_live_xxxxxxxxx"`;

export default async function DocsPage() {
  const appName = getAppName();
  const session = await getSession();
  const account = session?.userId
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: { name: true, email: true },
      })
    : null;

  return (
    <main className="docs-shell">
      <DocsSidebar appName={appName} sections={sections} account={account} />

      <section className="docs-main">
        <section id="overview" className="card stack">
          <h1>{appName} Developer Portal</h1>
          <p className="muted">
            Public API docs for merchant integrations. The official spec is available at{" "}
            <Link href="/openapi/v1.yaml">/openapi/v1.yaml</Link>.
          </p>
          <p className="muted">
            This page is designed for quick execution: copy snippets, test endpoints, and ship your
            first integration without heavy setup.
          </p>
        </section>

        <section id="quickstart" className="card stack">
          <h3>Quickstart (10 minutes)</h3>
          <ol>
            <li>Create a project from the dashboard and generate an API key.</li>
            <li>Set the project webhook URL in the Settings menu.</li>
            <li>Call create transaction with `Idempotency-Key`.</li>
            <li>Use callback/sync to reconcile final status.</li>
            <li>If still running locally, use sync endpoint to get the latest status.</li>
          </ol>
        </section>

        <section className="card stack">
          <h3>Fee Transparency</h3>
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Rule</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>QRIS (&lt; 110,000)</td>
                <td>2% + Rp 500</td>
              </tr>
              <tr>
                <td>QRIS (&gt;= 110,000)</td>
                <td>2.5%</td>
              </tr>
              <tr>
                <td>Virtual Account (all methods)</td>
                <td>Rp 4,500</td>
              </tr>
              <tr>
                <td>PayPal</td>
                <td>3%</td>
              </tr>
            </tbody>
          </table>
          <div className="alert">
            This pricing model is designed to stay proportional and worth the operational convenience
            offered by the platform.
          </div>
        </section>

        <section id="auth" className="card stack">
          <h3>Authentication</h3>
          <CopyCodeBlock language="http" code={`Authorization: Bearer bq_live_xxxxxxxxx`} />
          <p className="muted">
            Create transaction requires an additional header: <code>Idempotency-Key</code>.
          </p>
          <div className="alert">
            Tip: store API keys on your backend. Do not expose API keys to frontend/browser clients.
          </div>
          <div>
            <strong>Supported payment methods</strong>
            <p className="muted">
              Use the same create transaction payload and only change the `method` parameter.
            </p>
            <pre className="docs-mini-code">{SUPPORTED_PAYMENT_METHODS.join("\n")}</pre>
          </div>
        </section>

        <section id="endpoints" className="stack">
          {endpoints.map((ep) => (
            <article
              id={`endpoint-${ep.anchor}`}
              key={`${ep.method}-${ep.path}`}
              className="card stack docs-endpoint"
            >
              <div className="docs-endpoint-head">
                <span className={`docs-method docs-method-${ep.method.toLowerCase()}`}>{ep.method}</span>
                <code>{ep.path}</code>
              </div>
              <strong>{ep.summary}</strong>
              <div className="grid grid-2">
                <div>
                  <div className="muted">Request</div>
                  <pre className="docs-mini-code">{ep.req}</pre>
                </div>
                <div>
                  <div className="muted">Response</div>
                  <pre className="docs-mini-code">{ep.res}</pre>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section id="examples" className="card stack">
          <h3>Copy-Paste Examples</h3>
          <CopyCodeBlock code={curlCreate} language="bash" />
          <CopyCodeBlock code={curlSync} language="bash" />
          <p className="muted">
            Run the examples above first to validate connectivity, then wrap them into your SDK or
            service layer.
          </p>
        </section>

        <section id="errors" className="card stack">
          <h3>Error Codes</h3>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>HTTP</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>INVALID_REQUEST</td>
                <td>400</td>
                <td>Payload/query is invalid.</td>
              </tr>
              <tr>
                <td>UNAUTHORIZED</td>
                <td>401</td>
                <td>API key or callback token is invalid.</td>
              </tr>
              <tr>
                <td>IDEMPOTENCY_CONFLICT</td>
                <td>409</td>
                <td>Idempotency key reused with a different payload.</td>
              </tr>
              <tr>
                <td>RATE_LIMITED</td>
                <td>429</td>
                <td>Exceeded requests per minute limit.</td>
              </tr>
              <tr>
                <td>GATEWAY_ERROR</td>
                <td>502</td>
                <td>Gateway communication failure.</td>
              </tr>
            </tbody>
          </table>
          <div className="alert">
            Fastest debugging flow: check API response body, then compare with webhook logs in dashboard.
          </div>
        </section>

        <section id="testing" className="card stack">
          <h3>End-to-End Testing</h3>
          <p className="muted">
            Verify basic flow for create, callback/sync, and webhook logs:
          </p>
          <CopyCodeBlock
            language="bash"
            code={`npm run db:seed
npm run test:e2e:basic`}
          />
        </section>

        <TryItPanel />
      </section>
    </main>
  );
}
