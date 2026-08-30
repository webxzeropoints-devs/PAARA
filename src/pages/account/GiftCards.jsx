import React, { useEffect, useState } from "react";
import { Gift } from "lucide-react";

import AccountPageLayout from "./AccountPageLayout";
import { apiGet, apiPost } from "../../lib/api";

export default function GiftCards() {
  const [balance, setBalance] = useState(0);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiGet("/coupons/balance")
      .then(({ balance: currentBalance }) => setBalance(Number(currentBalance)))
      .catch((err) => setMessage(err.message || "Could not load your loyalty card balance."));
  }, []);

  const redeem = async (e) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setMessage("");
    try {
      const { amount, balance: updatedBalance } = await apiPost("/coupons/redeem-gift-card", { code: trimmed });
      setBalance(Number(updatedBalance));
      setMessage(`₹${Number(amount).toLocaleString("en-IN")} added to your balance.`);
      setCode("");
    } catch (err) {
      setMessage(err.message || "Could not redeem this loyalty card code.");
    }
  };

  return (
    <AccountPageLayout title="Loyalty Card" subtitle="Your Paara loyalty card balance and redemption.">
      <div className="rounded-lg p-8 bg-gradient-to-br from-cocoa to-[#4A3626] text-sand shadow-[0_20px_48px_rgba(75,45,25,.25)] max-w-md mb-10">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[.3em] text-sand/70">Paara Loyalty Card</span>
          <Gift size={20} strokeWidth={1.4} />
        </div>
        <p className="font-display text-4xl mt-8">₹{balance.toLocaleString("en-IN")}</p>
        <p className="text-xs uppercase tracking-widest text-sand/60 mt-2">Available balance</p>
      </div>

      <form onSubmit={redeem} className="max-w-md border border-cocoa/10 rounded-sm p-6 bg-white/50 space-y-4">
        <h2 className="font-display text-xl mb-1">Redeem a loyalty card</h2>
        <div>
          <label className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">Loyalty card code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="PAARA-XXXXXX"
            className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors"
          />
        </div>
        {message && <p className="text-xs text-cocoa/70">{message}</p>}
        <button type="submit" className="bg-gold text-white px-6 py-2.5 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors">
          Redeem
        </button>
      </form>
    </AccountPageLayout>
  );
}
