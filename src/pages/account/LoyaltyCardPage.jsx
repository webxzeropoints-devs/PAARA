import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AccountPageLayout from "./AccountPageLayout";
import LoyaltyCard from "../../components/LoyaltyCard";
import Seo from "../../components/Seo";
import { getLoyaltyStatus, getToken } from "../../lib/api";

export default function LoyaltyCardPage() {
  const [loyalty, setLoyalty] = useState(null);
  const [error, setError] = useState("");
  const authed = Boolean(getToken());

  useEffect(() => {
    if (!authed) return;
    getLoyaltyStatus().then(setLoyalty).catch((err) => setError(err?.message || "Could not load your PAARA Loyalty Card."));
  }, [authed]);

  if (!authed) {
    return <AccountPageLayout title="PAARA Rewards" subtitle="Your server-synced digital rewards card."><Link to="/login" className="inline-block bg-gold px-7 py-3 text-xs uppercase tracking-widest text-white">Sign in to view your card</Link></AccountPageLayout>;
  }

  const count = loyalty?.stampCount || 0;
  return (
    <AccountPageLayout title="PAARA Rewards" subtitle="Earn one stamp on each qualifying delivered order of ₹599 or more.">
      <Seo title="PAARA Loyalty" description="View your PAARA Jewellery Loyalty Card and server-synced stamps." />
      {error && <p className="mb-5 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}
      {!loyalty ? <p className="text-sm text-cocoa/60">Loading your rewards card…</p> : (
        <div className="space-y-6">
          <LoyaltyCard stampsCount={count} />
          <div className="max-w-xl border border-cocoa/10 bg-white/50 p-5 text-sm">
            <p className="font-display text-xl">{loyalty.rewardEligible ? "Reward unlocked" : `${6 - count} more stamp${6 - count === 1 ? "" : "s"} to unlock your reward`}</p>
            <p className="mt-2 text-cocoa/65">After six stamps, choose any jewellery from the store. Rewards cannot be exchanged for cash or combined with other offers.</p>
            {loyalty.expiresAt && <p className="mt-3 text-xs text-cocoa/55">Current card valid until {new Date(loyalty.expiresAt).toLocaleDateString("en-IN")}.</p>}
          </div>
        </div>
      )}
    </AccountPageLayout>
  );
}
