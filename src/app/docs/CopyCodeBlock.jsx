"use client";

import { useState } from "react";

export default function CopyCodeBlock({ code, language = "bash" }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  return (
    <div className="docs-code-wrap">
      <div className="docs-code-head">
        <span>{language}</span>
        <button type="button" className="docs-copy-btn" onClick={onCopy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="docs-code">
        <code>{code}</code>
      </pre>
    </div>
  );
}
