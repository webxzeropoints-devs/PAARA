import { useEffect, useState } from "react";
import { adminDeleteCustomer, adminRequest } from "../lib/api";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    try { setCustomers(await adminRequest("/admin/customers")); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadCustomers(); }, []);

  const openCustomer = async (id) => {
    try { setSelected(await adminRequest(`/admin/customers/${id}`)); }
    catch (err) { setError(err.message); }
  };

  const deleteCustomer = async (customer) => {
    if (!window.confirm("Are you sure you want to delete this customer? This cannot be undone.")) return;
    setError("");
    try {
      await adminDeleteCustomer(customer.id);
      if (selected?.id === customer.id) setSelected(null);
      await loadCustomers();
    } catch (err) { setError(err.message || "Could not delete customer."); }
  };

  return (
    <div className="max-w-7xl">
      <div className="mb-8"><p className="text-[10px] uppercase tracking-[.28em] text-gold">Relationships</p><h1 className="mt-2 font-display text-4xl text-cocoa">Customers</h1><p className="mt-2 text-sm text-cocoa/60">Every submitted checkout detail and order history.</p></div>
      {error && <p className="mb-5 border border-gold/40 bg-shell px-4 py-3 text-sm text-cocoa">{error}</p>}
      <div className="overflow-x-auto border border-cocoa/10 bg-shell">
        <table className="w-full text-sm"><thead className="border-b border-gold/30 text-left font-display text-xs uppercase tracking-[.18em]"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Paid total</th><th className="px-4 py-3">Action</th></tr></thead>
          <tbody>{customers.map((customer) => <tr key={customer.id} onClick={() => openCustomer(customer.id)} className="cursor-pointer border-b border-cocoa/10 odd:bg-sand/35 hover:bg-gold/10"><td className="px-4 py-3"><p>{customer.name}</p><p className="text-xs text-cocoa/50">{customer.email}</p></td><td className="px-4 py-3">{customer.phone || "-"}</td><td className="px-4 py-3">{customer.order_count}</td><td className="px-4 py-3">₹{Number(customer.paid_total).toLocaleString("en-IN")}</td><td className="px-4 py-3"><button type="button" onClick={(event) => { event.stopPropagation(); deleteCustomer(customer); }} className="text-xs uppercase tracking-widest text-red-700 hover:text-cocoa">Delete</button></td></tr>)}{customers.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-cocoa/60">No customers yet.</td></tr>}</tbody>
        </table>
      </div>
      {selected && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-cocoa/40 p-4 md:items-center"><section role="dialog" aria-modal="true" aria-label={`Details for ${selected.name}`} className="my-6 max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-cocoa/10 bg-shell p-5 shadow-2xl md:p-7"><div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-2xl">{selected.name}</h2><p className="text-sm text-cocoa/60">{selected.email} · {selected.phone || "No phone"}</p></div><button type="button" onClick={() => setSelected(null)} className="border border-gold px-3 py-2 text-xs uppercase tracking-widest">Close</button></div><div className="mt-6 space-y-5"><div className="border-t border-cocoa/10 pt-4"><p className="text-xs uppercase tracking-widest text-gold">Saved addresses</p>{selected.addresses?.length ? <div className="mt-3 space-y-3">{selected.addresses.map((address) => <div key={address.id} className="rounded-sm border border-cocoa/10 bg-sand/40 p-3 text-sm text-cocoa/80"><p>{address.line1}{address.line2 ? `, ${address.line2}` : ""}</p><p>{address.city}, {address.state} - {address.pincode}</p><p>{address.country || "India"}</p>{address.is_default ? <span className="mt-2 inline-block text-[10px] uppercase tracking-[.18em] text-gold">Default</span> : null}</div>)}</div> : <p className="mt-2 text-sm text-cocoa/60">No saved addresses.</p>}</div>{selected.submissions.map((detail) => <article key={detail.id} className="border-t border-cocoa/10 pt-4"><p className="text-xs uppercase tracking-widest text-gold">Order #{detail.order_id} · {detail.payment_status}</p><p className="mt-2 text-sm">{detail.shipping_line1}{detail.shipping_line2 ? `, ${detail.shipping_line2}` : ""}, {detail.shipping_city}, {detail.shipping_state} - {detail.shipping_pincode}, {detail.shipping_country}</p><p className="mt-1 text-xs text-cocoa/60">Submitted: {new Date(detail.created_at.replace(" ", "T") + "Z").toLocaleString()}</p></article>)}{selected.submissions.length === 0 && <p className="text-sm text-cocoa/60">No checkout submissions yet.</p>}</div></section></div>}
    </div>
  );
}
