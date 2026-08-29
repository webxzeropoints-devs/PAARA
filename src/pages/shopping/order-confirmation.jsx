import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";

import { downloadInvoice, getOrderById } from "../../lib/api";
import { fadeUp } from "../../lib/motion";

const formatPrice = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;

export default function OrderConfirmation() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get("order_id");
  const paymentSuccess = params.get("payment") === "success";
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [downloadState, setDownloadState] = useState("idle");

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
            {paymentSuccess ? "Payment successful" : "Your order is confirmed"}
          </h1>
          <p className="text-sm text-cocoa/60 mb-8">
            Order #{orderId}
          </p>

          {paymentSuccess && (
            <div className="mb-6 rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Your payment has been confirmed. You can download the invoice below.
            </div>
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
                    <span>{formatPrice(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cocoa/70">Shipping</span>
                    <span>{formatPrice(order.shipping_amount)}</span>
                  </div>
                  <div className="flex justify-between border-t border-cocoa/15 pt-2 mt-2 font-medium">
                    <span>Total</span>
                    <span>{formatPrice(order.total_amount)}</span>
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
                      <span>
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
