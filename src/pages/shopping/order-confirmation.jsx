import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Gift } from "lucide-react";

import { downloadInvoice, getOrderById } from "../../lib/api";
import { fadeUp } from "../../lib/motion";

const formatPrice = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;

const TOTAL_LOYALTY_STEPS = 7;
const LOYALTY_STORAGE_KEY = "paara_loyalty_progress";
const LOYALTY_LAST_ORDER_KEY = "paara_loyalty_last_order";

const getStoredLoyaltyProgress = () => {
  try {
    const rawValue = Number(window.localStorage.getItem(LOYALTY_STORAGE_KEY) || 0);
    return Number.isFinite(rawValue) ? Math.min(Math.max(rawValue, 0), TOTAL_LOYALTY_STEPS) : 0;
  } catch (error) {
    return 0;
  }
};

export default function OrderConfirmation() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get("order_id");
  const paymentSuccess = params.get("payment") === "success";
  const isManualUpi = params.get("payment_method") === "manual_upi";
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [downloadState, setDownloadState] = useState("idle");
  const [loyaltyProgress, setLoyaltyProgress] = useState(0);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    setError("");
    setOrder(null);
    getOrderById(orderId)
      .then((data) => {
        if (!cancelled) setOrder(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Could not load order");
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    if (!paymentSuccess || !orderId) {
      setLoyaltyProgress(getStoredLoyaltyProgress());
      return;
    }

    try {
      const currentProgress = getStoredLoyaltyProgress();
      const lastOrder = window.localStorage.getItem(LOYALTY_LAST_ORDER_KEY);
      const nextProgress = lastOrder === orderId ? currentProgress : Math.min(currentProgress + 1, TOTAL_LOYALTY_STEPS);

      window.localStorage.setItem(LOYALTY_STORAGE_KEY, String(nextProgress));
      window.localStorage.setItem(LOYALTY_LAST_ORDER_KEY, orderId);
      setLoyaltyProgress(nextProgress);
    } catch (error) {
      setLoyaltyProgress(getStoredLoyaltyProgress());
    }
  }, [paymentSuccess, orderId]);

  const loyaltyOfferText = useMemo(() => {
    if (loyaltyProgress >= TOTAL_LOYALTY_STEPS) return "Offer complete — 50% off unlocked for your final loyalty reward.";
    if (loyaltyProgress >= 5) return "40% off unlocked. Complete 7 purchases for the final 50% reward.";
    if (loyaltyProgress >= 3) return "30% off unlocked. Complete 5 purchases for 40% off.";
    return "Complete 3 purchases to unlock 30% off.";
  }, [loyaltyProgress]);

  if (!orderId) {
    return (
      <div className="min-h-[70vh] bg-sand text-cocoa font-body flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="font-display text-3xl mb-3">No order found</h1>
          <p className="text-sm text-cocoa/60 mb-6">
            The order confirmation link is missing or invalid.
          </p>
          <Link
            to="/"
            className="inline-block bg-gold text-white px-8 py-3 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors"
          >
            Back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] bg-sand text-cocoa font-body">
      <div className="max-w-[820px] mx-auto px-6 md:px-10 py-14">
        <motion.div initial="hidden" animate="show" variants={fadeUp}>
          <p className="text-xs uppercase tracking-[0.3em] text-gold mb-3">
            Thank you
          </p>
          <h1 className="font-display text-3xl md:text-4xl mb-2">
            {paymentSuccess && isManualUpi ? "Payment Successful — Order Confirmed" : paymentSuccess ? "Payment successful" : "Your order is confirmed"}
          </h1>
          <p className="text-sm text-cocoa/60 mb-8">
            Order {order?.order_number || orderId}
          </p>

          {paymentSuccess && (
            <>
              <div className="mb-6 rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Your payment has been confirmed. You can download the invoice below.
              </div>

              <div className="mb-8 rounded-[28px] border border-cocoa/10 bg-gradient-to-br from-[#2f241d] via-[#443525] to-[#1c130f] p-5 text-sand shadow-[0_18px_40px_rgba(38,25,16,0.25)]">
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/10">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-sand/65">Paara loyalty card</p>
                    <p className="font-display text-2xl mt-2">Member Rewards</p>
                  </div>
                  <div className="rounded-full border border-white/20 bg-white/5 p-2">
                    <Gift size={18} className="text-gold" strokeWidth={1.8} />
                  </div>
                </div>

                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.32em] text-sand/60">Status</p>
                    <p className="font-display text-3xl mt-2">{loyaltyProgress}/7</p>
                  </div>
                  <div className="rounded-full border border-gold/35 bg-gold/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-gold">
                    {loyaltyProgress >= 7 ? "Complete" : "In progress"}
                  </div>
                </div>

                <div className="mt-6 text-sm text-sand/80">{loyaltyOfferText}</div>
              </div>

              <div className="mb-8">
                <div className="grid grid-cols-7 gap-2 sm:gap-3">
                  {Array.from({ length: TOTAL_LOYALTY_STEPS }, (_, index) => {
                    const step = index + 1;
                    const isSealed = step <= loyaltyProgress;
                    const isNext = step === loyaltyProgress + 1 && loyaltyProgress < TOTAL_LOYALTY_STEPS;

                    return (
                      <motion.div
                        key={step}
                        initial={{ opacity: 0, scale: 0.8, rotate: isSealed ? 10 : 0 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{ duration: 0.38, delay: index * 0.08 }}
                        className="relative flex items-center justify-center"
                      >
                        <div
                          className={[
                            "relative flex h-12 w-12 items-center justify-center rounded-full border text-sm font-medium transition-all duration-300 sm:h-14 sm:w-14",
                            isSealed
                              ? "border-gold bg-gold text-[#201610] shadow-[0_10px_24px_rgba(184,135,74,0.42)]"
                              : isNext
                                ? "border-gold/60 bg-[#f6ebdc] text-cocoa ring-2 ring-gold/20"
                                : "border-cocoa/15 bg-[#f5efe8] text-cocoa/40",
                          ].join(" ")}
                        >
                          {isSealed ? (
                            <motion.span
                              initial={{ scale: 0.4, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ duration: 0.25, ease: "easeOut" }}
                              className="text-base font-bold"
                            >
                              ✓
                            </motion.span>
                          ) : (
                            step
                          )}
                          {isSealed && (
                            <motion.span
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1.2, opacity: 1 }}
                              transition={{ duration: 0.25 }}
                              className="absolute inset-0 rounded-full border-2 border-[#f2d7a7]"
                            />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-sm mb-6">
              {error}
            </div>
          )}

          {!order && !error && (
            <p className="text-sm text-cocoa/60">Loading your order…</p>
          )}

          {order && (
            <>
              <div className="bg-sand/60 border border-cocoa/10 rounded-sm p-6 mb-6">
                <h2 className="font-display text-xl mb-4">Order Summary</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-cocoa/70">Subtotal</span>
                    <span className="font-numeric">{formatPrice(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cocoa/70">Shipping</span>
                    <span className="font-numeric">{formatPrice(order.shipping_amount)}</span>
                  </div>
                  <div className="flex justify-between border-t border-cocoa/15 pt-2 mt-2 font-medium">
                    <span>Total</span>
                    <span className="font-numeric">{formatPrice(order.total_amount)}</span>
                  </div>
                  <p className="text-[11px] text-cocoa/50 pt-1">Taxes included in product prices.</p>
                </div>
              </div>

              {Array.isArray(order.items) && order.items.length > 0 && (
                <div className="space-y-3">
                  <h2 className="font-display text-xl mb-2">Items</h2>
                  {order.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between border-b border-cocoa/10 pb-3 text-sm"
                    >
                      <span className="font-product-name">
                        {item.name || `Product ${item.product_id}`}{" "}
                        <span className="text-cocoa/50">× {item.quantity}</span>
                      </span>
                      <span>{formatPrice(item.line_total)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-3 mt-10">
                <button
                  type="button"
                  onClick={async () => {
                    setDownloadState("loading");
                    try {
                      await downloadInvoice(order.id);
                      setDownloadState("done");
                    } catch (downloadError) {
                      setError(downloadError?.message || "Could not download invoice");
                      setDownloadState("idle");
                    }
                  }}
                  disabled={downloadState === "loading"}
                  className="inline-block bg-gold text-white px-8 py-3 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors disabled:opacity-60"
                >
                  {downloadState === "loading" ? "Preparing invoice…" : "Download invoice"}
                </button>
                <Link
                  to="/account/orders"
                  className="inline-block bg-gold text-white px-8 py-3 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors"
                >
                  View orders
                </Link>
                <button
                  onClick={() => navigate("/")}
                  className="inline-block border border-cocoa/30 px-8 py-3 text-xs uppercase tracking-widest hover:bg-cocoa hover:text-white hover:border-cocoa transition-colors"
                >
                  Continue shopping
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
