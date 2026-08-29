import React, { useEffect, useState } from "react";
import { Check, Copy, Minus, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { apiGet } from "../lib/api";

export default function CouponPopup() {
  const [coupon, setCoupon] = useState(null);
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet("/coupons/active")
      .then((coupons) => {
        if (!cancelled && Array.isArray(coupons) && coupons.length > 0) {
          setCoupon(coupons[0]);
          setVisible(true);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!coupon) return undefined;
    const timer = window.setInterval(() => setMinimized(false), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [coupon]);

  const copyCode = async () => {
    if (!coupon?.code) return;
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && coupon && minimized && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          onClick={() => setMinimized(false)}
          className="fixed bottom-5 right-5 z-[90] border border-gold/50 bg-shell px-4 py-3 text-left shadow-[0_12px_30px_rgba(75,45,25,.2)] transition-colors hover:bg-sand"
          aria-label="Restore coupon offer"
        >
          <span className="block text-[10px] uppercase tracking-[.24em] text-gold">Paara offer</span>
          <span className="mt-1 block text-xs uppercase tracking-[.16em] text-cocoa">{coupon.code}</span>
        </motion.button>
      )}
      {visible && coupon && !minimized && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-cocoa/35 p-5"
          onClick={() => setVisible(false)}
        >
          <motion.section
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md border border-gold/45 bg-shell px-7 py-8 text-center shadow-[0_22px_60px_rgba(75,45,25,.24)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="coupon-popup-title"
          >
            <div className="absolute right-4 top-4 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMinimized(true)}
                className="p-1 text-cocoa/55 transition-colors hover:text-cocoa"
                aria-label="Minimize coupon offer"
                title="Minimize offer"
              >
                <Minus size={17} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => setMinimized(true)}
                className="p-1 text-cocoa/55 transition-colors hover:text-cocoa"
                aria-label="Minimize coupon offer"
                title="Minimize offer"
              >
                <X size={17} strokeWidth={1.5} />
              </button>
            </div>
            <p className="text-[10px] uppercase tracking-[.3em] text-gold">A little something for you</p>
            <h2 id="coupon-popup-title" className="mt-3 font-display text-3xl text-cocoa">{coupon.description || "A Paara offer"}</h2>
            <p className="mt-3 text-sm text-cocoa/70">
              {coupon.discount_type === "percent"
                ? `${coupon.discount_value}% off your next order`
                : `₹${Number(coupon.discount_value).toLocaleString("en-IN")} off your next order`}
            </p>
            <button
              type="button"
              onClick={copyCode}
              className="mx-auto mt-6 flex items-center gap-3 border border-gold/55 bg-sand px-4 py-2.5 text-xs uppercase tracking-[.2em] text-cocoa transition-colors hover:border-gold hover:bg-white"
            >
              <span>{coupon.code}</span>
              {copied ? <Check size={14} className="text-gold" /> : <Copy size={14} className="text-gold" />}
            </button>
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="mt-7 bg-gold px-6 py-2.5 text-xs uppercase tracking-widest text-white transition-colors hover:bg-cocoa"
            >
              Continue shopping
            </button>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
