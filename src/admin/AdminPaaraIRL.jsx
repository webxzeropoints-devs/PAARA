import { useCallback, useEffect, useState } from "react";
import { adminRequest } from "../lib/api";
const readImage = (file, setImage, setError) => {
  if (!file) return;
  if (!file.type.startsWith("image/")) return setError("Please choose an image file.");
  const reader = new FileReader();
  reader.onload = () => setImage({ file, preview: String(reader.result) });
  reader.onerror = () => setError("Could not read that image.");
  reader.readAsDataURL(file);
};
export default function AdminPaaraIRL() {
  const [form, setForm] = useState({ image_url: "", owner_image_url: "", caption: "", image_file: null, owner_image_file: null });
  const [error, setError] = useState(""), [saved, setSaved] = useState("");
  const load = useCallback(async () => { try { const row = await adminRequest("/admin/paara-irl"); setForm({ image_url: row?.image_url || "", owner_image_url: row?.owner_image_url || "", caption: row?.caption || "", image_file: null, owner_image_file: null }); } catch (err) { setError(err.message); } }, []);
  useEffect(() => { load(); }, [load]);
  const save = async (event) => { event.preventDefault(); setError(""); try { const body = new FormData(); body.append("image_url", form.image_url); body.append("owner_image_url", form.owner_image_url); body.append("caption", form.caption); if (form.image_file) { body.append("images", form.image_file); body.append("upload_slots", "image"); } if (form.owner_image_file) { body.append("images", form.owner_image_file); body.append("upload_slots", "owner"); } await adminRequest("/admin/paara-irl", { method: "PUT", body }); await load(); setSaved("Saved."); } catch (err) { setError(err.message); } };
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-4xl text-cocoa mb-2">Paara IRL</h1>
      <p className="mb-6 text-sm text-cocoa/65">Manage the homepage image and the photo shown beside the Meet the Owner video.</p>
      {error && <p className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <form onSubmit={save} className="border border-cocoa/10 bg-shell p-5 space-y-7">
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-2xl text-cocoa">Paara IRL Image</h2>
            <p className="mt-1 text-sm text-cocoa/60">This image appears in the Paara IRL section on the homepage.</p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="h-36 w-36 shrink-0 overflow-hidden border border-gold/35 bg-sand">
              {form.image_url ? <img src={form.image_url} alt="Current Paara IRL image" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-4 text-center text-xs text-cocoa/50">No image set</div>}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <label className="block text-xs uppercase tracking-widest text-cocoa">Image URL<input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="mt-2 block w-full border border-cocoa/25 bg-sand px-3 py-2 text-sm normal-case outline-none focus:border-gold" /></label>
              <label className="block text-xs uppercase tracking-widest text-cocoa">Upload replacement<input type="file" accept="image/*" onChange={(e) => readImage(e.target.files?.[0], ({ file, preview }) => setForm({ ...form, image_url: preview, image_file: file }), setError)} className="mt-2 block w-full text-sm normal-case" /></label>
            </div>
          </div>
        </section>
        <section className="space-y-3 border-t border-cocoa/10 pt-6">
          <div>
            <h2 className="font-display text-2xl text-cocoa">Meet the Owner Photo</h2>
            <p className="mt-1 text-sm text-cocoa/60">This photo appears beside the Meet the Owner video in a pearl-shaped frame.</p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="h-36 w-28 shrink-0 overflow-hidden border border-gold/35 bg-sand rounded-[48%_52%_45%_55%/55%_44%_56%_45%]">
              {form.owner_image_url ? <img src={form.owner_image_url} alt="Current Meet the Owner photo" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-3 text-center text-xs text-cocoa/50">No photo set</div>}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <label className="block text-xs uppercase tracking-widest text-cocoa">Photo URL<input value={form.owner_image_url} onChange={(e) => setForm({ ...form, owner_image_url: e.target.value })} className="mt-2 block w-full border border-cocoa/25 bg-sand px-3 py-2 text-sm normal-case outline-none focus:border-gold" /></label>
              <label className="block text-xs uppercase tracking-widest text-cocoa">Upload replacement<input type="file" accept="image/*" onChange={(e) => readImage(e.target.files?.[0], ({ file, preview }) => setForm({ ...form, owner_image_url: preview, owner_image_file: file }), setError)} className="mt-2 block w-full text-sm normal-case" /></label>
            </div>
          </div>
        </section>
        <label className="block border-t border-cocoa/10 pt-6 text-xs uppercase tracking-widest text-cocoa">Caption<p className="mt-1 text-sm normal-case tracking-normal text-cocoa/60">Shown with the Paara IRL image content.</p><input value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} className="mt-2 block w-full border border-cocoa/25 bg-sand px-3 py-2 text-sm normal-case tracking-normal outline-none focus:border-gold" /></label>
        <div className="flex items-center gap-3"><button className="px-4 py-2 text-xs uppercase tracking-widest bg-gold text-sand">Save changes</button>{saved && <span className="text-sm text-cocoa">{saved}</span>}</div>
      </form>
    </div>
  );
}