import React, { useState } from "react";
import { Check } from "lucide-react";

import AccountPageLayout from "./AccountPageLayout";

const STAGES = ["Order Placed", "Confirmed", "Packed", "Shipped", "Delivered"];

// Deterministic mock progress derived from the order number, so the same
// order number always shows the same stage (frontend-only, no backend).
const mockStageFor = (orderNumber) => {
  const digitsSum = orderNumber
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return digitsSum % STAGES.length;
};

export default function TrackOrder() {
  const [orderNumber, setOrderNumber] = useState("");
  const [result, setResult] = useState(null);

  const onSubmit = (e) => {
    e.preventDefault();
    const trimmed = orderNumber.trim();
    if (!trimmed) return;
    setResult({ orderNumber: trimmed, stage: mockStageFor(trimmed) });
  };

  return (
    <AccountPageLayout title="Track Order" subtitle="Enter your order number to see its delivery status.">
      <form onSubmit={onSubmit} className="max-w-md flex gap-3 mb-12">
        <input
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="Order Number"
          className="flex-1 bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors"
        />
        <button type="submit" className="bg-gold text-white px-6 py-2.5 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors">
          Track Order
        </button>
      </form>

      {result && (
        <div className="border border-cocoa/10 rounded-sm p-8 bg-white/40 max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-cocoa/60 mb-8">Order #{result.orderNumber}</p>
          <div className="flex items-start">
            {STAGES.map((stage, index) => (
              <div key={stage} className="flex-1 flex flex-col items-center text-center relative">
                {index > 0 && (
                  <div
                    className={`absolute top-4 -left-1/2 w-full h-px ${index <= result.stage ? "bg-gold" : "bg-cocoa/15"}`}
                    aria-hidden="true"
                  />
                )}
                <div
                  className={`relative z-10 w-8 h-8 rounded-full grid place-items-center border ${
                    index <= result.stage ? "bg-gold border-gold text-white" : "bg-sand border-cocoa/20 text-cocoa/40"
                  }`}
                >
                  {index <= result.stage ? <Check size={14} /> : <span className="text-xs">{index + 1}</span>}
                </div>
                <p className={`mt-3 text-xs uppercase tracking-widest ${index <= result.stage ? "text-cocoa" : "text-cocoa/40"}`}>
                  {stage}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </AccountPageLayout>
  );
}
