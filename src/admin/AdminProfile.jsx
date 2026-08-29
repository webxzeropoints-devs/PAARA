// /admin/profile — view avatar/name/email, change avatar URL, change email,
// change password, logout.

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { adminChangeEmail, adminChangePassword, adminChangeProfilePicture } from "../lib/api";
import { useAdmin } from "../lib/adminAuth.jsx";

export default function AdminProfile() {
  const { admin, updateProfile, logout } = useAdmin();
  const navigate = useNavigate();

  const [imageUrl, setImageUrl] = useState(admin?.profile_image_url || "");
  const [imageSaving, setImageSaving] = useState(false);
  const [imageMsg, setImageMsg] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [emailPw, setEmailPw] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  useEffect(() => {
    setImageUrl(admin?.profile_image_url || "");
  }, [admin?.profile_image_url]);

  const saveAvatar = async (e) => {
    e.preventDefault();
    setImageMsg("");
    setImageSaving(true);
    try {
      await adminChangeProfilePicture(imageUrl.trim());
      await updateProfile({});
      setImageMsg("Saved.");
    } catch (err) {
      setImageMsg(err.message);
    } finally {
      setImageSaving(false);
    }
  };

  const submitEmail = async (e) => {
    e.preventDefault();
    setEmailMsg("");
    setEmailSaving(true);
    try {
      await adminChangeEmail(newEmail.trim(), emailPw);
      await updateProfile({});
      setEmailMsg("Email updated.");
      setNewEmail("");
      setEmailPw("");
    } catch (err) {
      setEmailMsg(err.message);
    } finally {
      setEmailSaving(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setPwMsg("");
    if (newPw.length < 8) {
      setPwMsg("New password must be at least 8 characters.");
      return;
    }
    setPwSaving(true);
    try {
      await adminChangePassword(currentPw, newPw);
      await updateProfile({});
      setPwMsg("Password updated.");
      setCurrentPw("");
      setNewPw("");
    } catch (err) {
      setPwMsg(err.message);
    } finally {
      setPwSaving(false);
    }
  };

  const onLogout = () => {
    logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-[.28em] text-gold">Account</p>
        <h1 className="font-display text-4xl text-cocoa mt-2">Profile & Security</h1>
      </div>

      {/* Profile card */}
      <div className="rounded-sm border border-cocoa/10 bg-shell p-6 mb-8 flex items-center gap-5">
        <div className="h-20 w-20 rounded-full overflow-hidden border border-gold/40 bg-sand grid place-items-center text-2xl text-gold">
          {admin?.profile_image_url ? (
            <img src={admin.profile_image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span>{(admin?.name || admin?.email || "A").slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="leading-tight">
          <p className="font-display text-2xl text-cocoa">{admin?.name || "Admin"}</p>
          <p className="text-sm text-cocoa/65">{admin?.email}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[.22em] text-gold">Role: Admin</p>
        </div>
      </div>

      {/* Change avatar */}
      <Card title="Change profile picture" subtitle="Paste a public image URL.">
        <form onSubmit={saveAvatar} className="space-y-3">
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
            className="w-full bg-transparent border-b border-cocoa/30 px-0 py-2 text-sm focus:outline-none focus:border-gold"
          />
          <Row>
            <button
              type="submit"
              disabled={imageSaving}
              className="px-5 py-2 text-xs uppercase tracking-widest bg-gold text-sand hover:bg-cocoa disabled:opacity-60"
            >
              {imageSaving ? "Saving…" : "Save"}
            </button>
            {imageMsg && <p className="text-sm text-cocoa self-center">{imageMsg}</p>}
          </Row>
        </form>
      </Card>

      {/* Change email */}
      <Card title="Change email">
        <form onSubmit={submitEmail} className="space-y-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="new-email@example.com"
            required
            className="w-full bg-transparent border-b border-cocoa/30 px-0 py-2 text-sm focus:outline-none focus:border-gold"
          />
          <input
            type="password"
            value={emailPw}
            onChange={(e) => setEmailPw(e.target.value)}
            placeholder="Current password"
            required
            autoComplete="current-password"
            className="w-full bg-transparent border-b border-cocoa/30 px-0 py-2 text-sm focus:outline-none focus:border-gold"
          />
          <Row>
            <button
              type="submit"
              disabled={emailSaving}
              className="px-5 py-2 text-xs uppercase tracking-widest bg-gold text-sand hover:bg-cocoa disabled:opacity-60"
            >
              {emailSaving ? "Saving…" : "Update email"}
            </button>
            {emailMsg && <p className="text-sm text-cocoa self-center">{emailMsg}</p>}
          </Row>
        </form>
      </Card>

      {/* Change password */}
      <Card title="Change password" subtitle="Minimum 8 characters.">
        <form onSubmit={submitPassword} className="space-y-3">
          <input
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            placeholder="Current password"
            required
            autoComplete="current-password"
            className="w-full bg-transparent border-b border-cocoa/30 px-0 py-2 text-sm focus:outline-none focus:border-gold"
          />
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="New password"
            required
            autoComplete="new-password"
            className="w-full bg-transparent border-b border-cocoa/30 px-0 py-2 text-sm focus:outline-none focus:border-gold"
          />
          <Row>
            <button
              type="submit"
              disabled={pwSaving}
              className="px-5 py-2 text-xs uppercase tracking-widest bg-gold text-sand hover:bg-cocoa disabled:opacity-60"
            >
              {pwSaving ? "Saving…" : "Update password"}
            </button>
            {pwMsg && <p className="text-sm text-cocoa self-center">{pwMsg}</p>}
          </Row>
        </form>
      </Card>

      {/* Logout */}
      <Card title="Session">
        <button
          type="button"
          onClick={onLogout}
          className="px-5 py-2 text-xs uppercase tracking-widest border border-gold text-cocoa hover:bg-sand"
        >
          Log out
        </button>
      </Card>
    </div>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div className="rounded-sm border border-cocoa/10 bg-shell p-6 mb-6">
      <h2 className="font-display text-lg tracking-[.14em] text-cocoa mb-1">{title}</h2>
      {subtitle && <p className="text-xs text-cocoa/60 mb-4">{subtitle}</p>}
      {children}
    </div>
  );
}

function Row({ children }) {
  return <div className="flex items-center gap-4 flex-wrap">{children}</div>;
}