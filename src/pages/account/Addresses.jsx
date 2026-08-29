import React, { useEffect, useState } from "react";
import { Pencil, Trash2, Star, Plus } from "lucide-react";

import AccountPageLayout from "./AccountPageLayout";

const KEY = "paara_addresses";

const readAddresses = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeAddresses = (list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // ignore quota errors
  }
};

const emptyForm = { name: "", line1: "", line2: "", city: "", state: "", pincode: "", phone: "" };

export default function Addresses() {
  const [addresses, setAddresses] = useState(() => readAddresses());
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    writeAddresses(addresses);
  }, [addresses]);

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (address) => {
    setForm(address);
    setEditingId(address.id);
    setShowForm(true);
  };

  const remove = (id) => {
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  };

  const setDefault = (id) => {
    setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (editingId) {
      setAddresses((prev) => prev.map((a) => (a.id === editingId ? { ...form, id: editingId, isDefault: a.isDefault } : a)));
    } else {
      const isDefault = addresses.length === 0;
      setAddresses((prev) => [...prev, { ...form, id: `addr-${Date.now()}`, isDefault }]);
    }
    setShowForm(false);
    setForm(emptyForm);
    setEditingId(null);
  };

  return (
    <AccountPageLayout title="Saved Addresses" subtitle="Manage where your Paara pieces get delivered.">
      <div className="flex justify-end mb-6">
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 bg-gold text-white px-5 py-2.5 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors"
        >
          <Plus size={14} /> Add address
        </button>
      </div>

      {addresses.length === 0 && !showForm && (
        <div className="bg-sand/60 border border-cocoa/10 rounded-sm p-10 text-center">
          <h2 className="font-display text-2xl mb-2">No saved addresses</h2>
          <p className="text-sm text-cocoa/60">Add an address so checkout is faster next time.</p>
        </div>
      )}

      {showForm && (
        <form onSubmit={onSubmit} className="border border-cocoa/10 rounded-sm p-6 mb-6 bg-white/50 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Full name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required />
          </div>
          <Field label="Address line 1" value={form.line1} onChange={(v) => setForm({ ...form, line1: v })} required />
          <Field label="Address line 2" value={form.line2} onChange={(v) => setForm({ ...form, line2: v })} />
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required />
            <Field label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} required />
            <Field label="Pincode" value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v })} required />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="bg-gold text-white px-6 py-2.5 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors">
              {editingId ? "Save changes" : "Save address"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="px-6 py-2.5 text-xs uppercase tracking-widest text-cocoa/60 hover:text-cocoa transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {addresses.map((address) => (
          <div key={address.id} className="border border-cocoa/10 rounded-sm p-5 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-display text-lg">{address.name}</p>
                {address.isDefault && (
                  <span className="text-[10px] uppercase tracking-widest bg-cocoa text-sand px-2 py-0.5 rounded-sm">Default</span>
                )}
              </div>
              <p className="text-sm text-cocoa/70 mt-1">
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state} - {address.pincode}
              </p>
              <p className="text-sm text-cocoa/60 mt-1">{address.phone}</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              {!address.isDefault && (
                <button type="button" onClick={() => setDefault(address.id)} aria-label="Set as default" className="text-cocoa/60 hover:text-gold transition-colors" title="Set as default">
                  <Star size={16} strokeWidth={1.4} />
                </button>
              )}
              <button type="button" onClick={() => openEdit(address)} aria-label="Edit address" className="text-cocoa/60 hover:text-gold transition-colors">
                <Pencil size={16} strokeWidth={1.4} />
              </button>
              <button type="button" onClick={() => remove(address.id)} aria-label="Delete address" className="text-cocoa/60 hover:text-red-600 transition-colors">
                <Trash2 size={16} strokeWidth={1.4} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </AccountPageLayout>
  );
}

function Field({ label, value, onChange, required = false }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">{label}</label>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors"
      />
    </div>
  );
}
