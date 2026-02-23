"use client";

import { useMemo, useState } from "react";
import { SUPPORTED_PAYMENT_METHODS } from "@/lib/payment-methods";

export default function TryItPanel() {
  const [apiKey, setApiKey] = useState("");
  const [amount, setAmount] = useState("150000");
  const [method, setMethod] = useState("qris");
  const [externalId, setExternalId] = useState(`INV-${Date.now()}`);
  const [transactionId, setTransactionId] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const idempotencyKey = useMemo(() => `idem-${externalId}`, [externalId]);

  async function runRequest(label, fn) {
    setLoading(true);
    try {
      const data = await fn();
      setResult(`${label}\n${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      setResult(`${label} ERROR\n${String(error?.message || error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function requestJson(path, init = {}) {
    const response = await fetch(path, init);
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }

  return (
    <div className="card stack">
      <h3>Try It</h3>
      <p className="muted">
        Test endpoints directly from your browser. Enter your project API key, then run create/detail/sync.
      </p>
      <div className="grid grid-2">
        <input
          placeholder="API Key (bq_live_...)"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <input
          placeholder="External ID"
          value={externalId}
          onChange={(e) => setExternalId(e.target.value)}
        />
      </div>
      <div className="grid grid-2">
        <input placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          {SUPPORTED_PAYMENT_METHODS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-2">
        <input
          placeholder="Transaction ID (for detail/sync)"
          value={transactionId}
          onChange={(e) => setTransactionId(e.target.value)}
        />
      </div>

      <div className="grid grid-2">
        <button
          type="button"
          disabled={loading || !apiKey}
          onClick={() =>
            runRequest("CREATE", async () => {
              const json = await requestJson("/api/v1/transactions", {
                method: "POST",
                headers: {
                  authorization: `Bearer ${apiKey}`,
                  "content-type": "application/json",
                  "idempotency-key": idempotencyKey,
                },
                body: JSON.stringify({
                  external_id: externalId,
                  method,
                  amount: Number(amount),
                  customer_name: "Try It User",
                }),
              });
              if (json?.data?.id) setTransactionId(json.data.id);
              return json;
            })
          }
        >
          {loading ? "Loading..." : "Create Transaction"}
        </button>
        <button
          type="button"
          disabled={loading || !apiKey || !transactionId}
          onClick={() =>
            runRequest("DETAIL", () =>
              requestJson(`/api/v1/transactions/${encodeURIComponent(transactionId)}`, {
                method: "GET",
                headers: { authorization: `Bearer ${apiKey}` },
              }),
            )
          }
        >
          Get Detail
        </button>
      </div>

      <button
        type="button"
        disabled={loading || !apiKey || !transactionId}
        onClick={() =>
          runRequest("SYNC", () =>
            requestJson(`/api/v1/transactions/${encodeURIComponent(transactionId)}/sync`, {
              method: "POST",
              headers: { authorization: `Bearer ${apiKey}` },
            }),
          )
        }
      >
        Sync Transaction
      </button>

      <pre className="docs-mini-code" style={{ minHeight: 140 }}>
        {result || "Result will appear here..."}
      </pre>
    </div>
  );
}
