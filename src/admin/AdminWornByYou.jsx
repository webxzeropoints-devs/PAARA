import { useCallback, useEffect, useState } from "react";
import { adminRequest } from "../lib/api";

const blank = () => ({ id: null, image_url: "", caption: "", instagram_post_url: "", likes: 0 });

const readImage = (file, onRead, onError) => {
  if (!file) return;
  if (!file.type.startsWith("image/")) return onError("Please choose an image file.");
  const reader = new FileReader();
  reader.onload = () => onRead(String(reader.result));
  reader.onerror = () => onError("Could not read that image.");
  reader.readAsDataURL(file);
};

export default function AdminWornByYou() {
  const [slots, setSlots] = useState([blank(), blank(), blank()]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await adminRequest("/admin/worn-by-you");
      setSlots([0, 1, 2].map((index) => ({ ...blank(), ...(rows[index] || {}) })));
    } catch (err) {
      setError(err.message || "Could not load Worn By You images.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (index, values) => {
    setSaved("");
    setSlots((current) => current.map((slot, slotIndex) => slotIndex === index ? { ...slot, ...values } : slot));
  };

  const save = async (event) => {
    event.preventDefault();
    setError("");
    setSaved("");
    setSaving(true);
    try {
      const response = await adminRequest("/admin/worn-by-you", { method: "PUT", body: JSON.stringify({ slots }) });
      setSlots(response.slots || slots);
      setSaved("All three images saved.");
    } catch (err) {
      setError(err.message || "Could not save Worn By You images.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-7">
        <p className="text-[10px] uppercase tracking-[.28em] text-gold">Community</p>
        <h1 className="mt-2 font-display text-4xl text-cocoa">Worn by You</h1>
        <p className="mt-2 text-sm text-cocoa/60">Update the three homepage moments together.</p>
      </div>
      {error && <p className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <form onSubmit={save} className="border border-cocoa/10 bg-shell p-5 md:p-6">
        <div className="grid gap-5 md:grid-cols-3">
          {slots.map((slot, index) => (
            <section key={slot.id || index} className="min-w-0 space-y-3 border border-cocoa/10 bg-sand/35 p-4">
              <h2 className="font-display text-xl text-cocoa">Slot {index + 1}</h2>
              <input required placeholder="Image link" value={slot.image_url} onChange={(event) => update(index, { image_url: event.target.value })} className="w-full min-w-0 border-b border-cocoa/25 bg-transparent py-2 text-sm outline-none focus:border-gold" />
              <label className="block text-xs uppercase tracking-widest text-cocoa/70">Or upload a photo<input type="file" accept="image/*" onChange={(event) => readImage(event.target.files?.[0], (image_url) => update(index, { image_url }), setError)} className="mt-2 block w-full min-w-0 text-sm normal-case" /></label>
              <input placeholder="Caption" value={slot.caption || ""} onChange={(event) => update(index, { caption: event.target.value })} className="w-full min-w-0 border-b border-cocoa/25 bg-transparent py-2 text-sm outline-none focus:border-gold" />
              {slot.image_url && <img src={slot.image_url} alt={`Worn By You slot ${index + 1} preview`} className="aspect-[3/4] w-full object-cover" />}
            </section>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-3 border-t border-cocoa/10 pt-5">
          <button type="submit" disabled={saving || slots.some((slot) => !slot.image_url)} className="bg-gold px-5 py-2.5 text-xs uppercase tracking-widest text-sand hover:bg-cocoa disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving all images..." : "Save all three images"}</button>
          {saved && <span className="text-sm text-cocoa">{saved}</span>}
        </div>
      </form>
    </div>
  );
}