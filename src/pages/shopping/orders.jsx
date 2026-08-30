import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { getOrders, getToken } from "../../lib/api";
import { fadeUp } from "../../lib/motion";

const formatPrice = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) {
      navigate("/login", { state: { redirectTo: "/account/orders" }, replace: true });
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    getOrders()
      .then((data) => {
        if (cancelled) return;
        setOrders(Array.isArray(data) ? data : data?.orders || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "Could not load orders");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-[80vh] bg-sand text-cocoa font-body">
      <div className="max-w-[1000px] mx-auto px-6 md:px-10 py-14">
        <motion.h1
          initial="hidden"
          animate="show"
          variants={fadeUp}
          className="font-display text-3xl md:text-4xl mb-2"
        >
          Your Orders
        </motion.h1>
        <p className="text-sm text-cocoa/60 mb-10">History of every Paara piece you've taken home.</p>

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-sm mb-6">
            {error}
          </div>
        )}

        {loading && <p className="text-sm text-cocoa/60">Loading…</p>}

        {!loading && !error && orders.length === 0 && (
          <div className="bg-sand/60 border border-cocoa/10 rounded-sm p-10 text-center">
            <h2 className="font-display text-2xl mb-2">No orders yet</h2>
            <p className="text-sm text-cocoa/60 mb-6">
              When you place an order, it will appear here.
            </p>
            <Link
              to="/shop"
              className="inline-block bg-gold text-white px-8 py-3 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors"
            >
              Shop now
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id || order.order_id}
              className="border border-cocoa/10 rounded-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            >
              <div>
                <p className="text-xs uppercase tracking-widest text-cocoa/60">
                  Order #{(order.id || order.order_id)?.toString().slice(0, 8)}
                </p>
                <p className="text-lg mt-1">
                  <span className="font-numeric">{formatPrice(order.total_amount)}</span>
                </p>
                <p className="text-xs text-cocoa/60 mt-1">
                  {order.created_at
                    ? new Date(order.created_at).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-widest text-cocoa/60">
                  {order.status || "confirmed"}
                </span>
                <Link
                  to={`/order-confirmation?order_id=${order.id || order.order_id}`}
                  className="text-xs uppercase tracking-widest text-gold hover:text-cocoa transition-colors"
                >
                  View →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
