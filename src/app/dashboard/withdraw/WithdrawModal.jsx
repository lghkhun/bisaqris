"use client";

import { useState } from "react";
import { createWithdrawalAction } from "@/lib/actions";

export default function WithdrawModal({ projectId, withdrawableBalance }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(withdrawableBalance || 100000));

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="withdraw-open-btn">
        Withdraw
      </button>

      {open ? (
        <div className="withdraw-modal-overlay" role="dialog" aria-modal="true">
          <div className="withdraw-modal card stack">
            <h3 style={{ margin: 0 }}>Confirm Withdrawal</h3>
            <p className="muted" style={{ margin: 0 }}>
              Processing time is up to 1x24 hours. Minimum withdrawal amount is Rp 100,000.
              Withdrawal fee is Rp 2,500.
            </p>
            <p className="muted" style={{ margin: 0 }}>
              Withdrawable balance: <strong>Rp {new Intl.NumberFormat("en-US").format(withdrawableBalance || 0)}</strong>
            </p>
            <form action={createWithdrawalAction} className="stack">
              <input type="hidden" name="projectId" value={projectId} />
              <input
                name="amount"
                type="number"
                min={100000}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <div className="withdraw-modal-actions">
                <button type="button" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="submit">Confirm Withdrawal</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

