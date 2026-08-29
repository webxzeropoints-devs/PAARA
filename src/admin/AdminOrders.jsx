import { useCallback, useEffect, useState } from "react";
import { adminRequest } from "../lib/api";

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [granting, setGranting] = useState(null);

  const load = useCallback(async () => {
    try { setOrders(await adminRequest("/admin/orders")); }
    catch (err) { setError(err.message || "Could not load orders."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const grant = async (order) => {
    setGranting(order.id);
    setError("");
    try { await adminRequest(`/admin/orders/${order.id}/grant-gift-card`, { method: "POST" }); await load(); }
    catch (err) { setError(err.message || "Could not grant gift card."); }
    finally { setGranting(null); }
  };

  return (
    <div className="max-w-7xl">
      <div className="mb-8"><p className="text-[10px] uppercase tracking-[.28em] text-gold">Fulfilment</p><h1 className="mt-2 font-display text-4xl text-cocoa">Orders</h1><p className="mt-2 text-sm text-cocoa/60">Review purchases and approve qualifying gift card grants.</p></div>
      {error && <p className="mb-5 border border-gold/40 bg-shell px-4 py-3 text-sm text-cocoa">{error}</p>}
      <div className="overflow-x-auto border border-cocoa/10 bg-shell">
        <table className="w-full text-sm">
          <thead className="border-b border-gold/30 text-left font-display text-xs uppercase tracking-[.18em] text-cocoa"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Order</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Gift card</th></tr></thead>
          <tbody>
            {orders.map((order) => {
              const eligible = order.gift_card_eligible_amount !== null && order.gift_card_eligible_amount !== undefined;
              const granted = Boolean(order.gift_card_granted_at);
              return <tr key={order.id} className="border-b border-cocoa/10 align-top odd:bg-sand/35">
                <td className="px-4 py-3"><p className="text-cocoa">{order.customer_name}</p><p className="text-xs text-cocoa/50">{order.customer_email}</p></td>
                <td className="px-4 py-3 text-cocoa">#{order.id}</td>
                <td className="px-4 py-3 capitalize text-cocoa/75">{order.status}</td>
                <td className="px-4 py-3 capitalize text-cocoa/75">{order.payment_status}</td>
                <td className="px-4 py-3 text-cocoa">₹{Number(order.total_amount).toLocaleString("en-IN")}</td>
                <td className="whitespace-nowrap px-4 py-3 text-cocoa/70">{new Date(order.created_at.replace(" ", "T") + "Z").toLocaleString()}</td>
                <td className="min-w-[220px] px-4 py-3">{eligible ? granted ? <span className="text-xs uppercase tracking-widest text-gold">Gift card granted<br /><span className="normal-case tracking-normal text-cocoa/50">₹{Number(order.gift_card_eligible_amount).toLocaleString("en-IN")}</span></span> : <div><span className="inline-block bg-gold/20 px-2 py-1 text-[10px] uppercase tracking-widest text-cocoa">Eligible for gift card grant</span><p className="mt-1 text-xs text-cocoa/65">₹{Number(order.gift_card_eligible_amount).toLocaleString("en-IN")}</p><button type="button" onClick={() => grant(order)} disabled={granting === order.id} className="mt-2 bg-gold px-3 py-1.5 text-[10px] uppercase tracking-widest text-sand hover:bg-cocoa disabled:opacity-50">{granting === order.id ? "Granting..." : "Grant gift card"}</button></div> : <span className="text-xs text-cocoa/40">Not eligible</span>}</td>
              </tr>;
            })}
            {orders.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-cocoa/60">No orders yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
