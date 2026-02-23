"use client";

import { useMemo, useState } from "react";

function maskKey(value) {
  if (!value) return "****************";
  const keep = Math.min(6, value.length);
  return `${value.slice(0, keep)}${"*".repeat(Math.max(8, value.length - keep))}`;
}

export default function ApiKeyField({ rawKey, prefix }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasRawKey = Boolean(rawKey);

  const shownValue = useMemo(() => {
    if (revealed && hasRawKey) return rawKey;
    if (hasRawKey) return maskKey(rawKey);
    return `${prefix || "bq_live"}************`;
  }, [hasRawKey, prefix, rawKey, revealed]);

  async function onCopy() {
    if (!hasRawKey) return;
    await navigator.clipboard.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="settings-api-row">
      <input readOnly type={revealed && hasRawKey ? "text" : "password"} value={shownValue} />
      <button type="button" onClick={() => setRevealed((v) => !v)}>
        {revealed ? "Hide" : "Show"}
      </button>
      <button type="button" onClick={onCopy} disabled={!hasRawKey}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

