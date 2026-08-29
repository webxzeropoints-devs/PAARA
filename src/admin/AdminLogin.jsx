import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

import { useAdmin } from "../lib/adminAuth.jsx";

export default function AdminLogin() {
  const { requestLogin, error, loading, token } = useAdmin();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (token) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const submitCredentials = async (e) => {
    e.preventDefault();
    try {
      const res = await requestLogin(email.trim(), password);
      if (res?.token) {
        navigate("/admin/dashboard", { replace: true });
      }
    } catch {
      // error surfaced via context.error
    }
  };

  return (
    <div className="min-h-screen bg-sand text-cocoa font-body flex items-center justify-center px-5 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 h-14 w-14 grid place-items-center rounded-full border border-gold text-gold">
            <ShieldCheck size={22} />
          </div>
          <h1 className="font-display text-3xl tracking-[.16em] text-cocoa">Admin Sign In</h1>
          <p className="mt-2 text-xs uppercase tracking-[.28em] text-cocoa/60">Sign in to the dashboard</p>
        </div>

        <div className="rounded-sm border border-cocoa/10 bg-shell p-8 md:p-10 shadow-sm">
          <form onSubmit={submitCredentials} className="space-y-5">
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="paara@gmail.com"
              autoComplete="email"
              required
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Paara@123"
              autoComplete="current-password"
              required
            />
            {error && <p className="text-sm text-cocoa">{error}</p>}
            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gold text-sand py-3 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/admin/forgot-password")}
                className="w-full text-xs uppercase tracking-widest text-cocoa/60 hover:text-gold transition-colors"
              >
                Forgot password?
              </button>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-[10px] uppercase tracking-[.22em] text-cocoa/45">
          Staff only · All activity is logged
        </p>
      </motion.div>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, placeholder, ...rest }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm text-cocoa placeholder-cocoa/35 transition-colors"
        {...rest}
      />
    </label>
  );
}