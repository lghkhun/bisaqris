import { adminUpdatePlatformFeeAction } from "@/lib/actions";
import { getPlatformConfig, isPlatformConfigReady } from "@/lib/platform-config";

function formatMoney(value) {
  return `Rp ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0)}`;
}

export default async function AdminFeesPage({ searchParams }) {
  const query = (await searchParams) || {};
  const modelReady = isPlatformConfigReady();
  const config = await getPlatformConfig();

  return (
    <div className="stack">
      <h1>Fee Settings</h1>
      {query?.success ? <div className="alert">Success: {query.success}</div> : null}
      {query?.error ? <div className="alert">Error: {query.error}</div> : null}
      {!modelReady ? (
        <div className="alert">
          Platform fee model is not ready in this runtime. Run migration and regenerate Prisma client.
        </div>
      ) : null}

      <div className="grid grid-2">
        <div className="card">
          <strong>{formatMoney(config.platformFee)}</strong>
          <div className="muted">Current Platform Fee (per transaction)</div>
        </div>
        <div className="card">
          <strong>Dynamic</strong>
          <div className="muted">Provider Fee (by method and amount)</div>
        </div>
      </div>

      <div className="card stack">
        <h3>Update Fee Configuration</h3>
        <p className="muted">
          Platform fee is your internal revenue share per transaction. It is deducted from total fee
          and does not change the merchant API contract.
        </p>
        <form action={adminUpdatePlatformFeeAction} className="stack">
          <div className="stack">
            <label htmlFor="platformFee">Platform Fee (IDR)</label>
            <input
              id="platformFee"
              name="platformFee"
              type="number"
              min={0}
              step={1}
              defaultValue={config.platformFee}
              required
            />
          </div>
          <button type="submit">Save Fee Settings</button>
        </form>
      </div>

      <div className="card stack">
        <h3>Provider Fee Rules (Current)</h3>
        <ul>
          <li>QRIS below Rp 110,000: 2% + Rp 500</li>
          <li>QRIS from Rp 110,000 and above: 2.5%</li>
          <li>All Virtual Account methods: Rp 4,500</li>
          <li>PayPal: 3%</li>
        </ul>
      </div>
    </div>
  );
}
