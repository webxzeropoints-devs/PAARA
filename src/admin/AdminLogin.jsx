// /admin/login — two-step form. Step 1 = email + password; Step 2 = 6-digit OTP.
// Transitions are in-component (no reload). Pre-fills the seeded test
// credentials as placeholders so reviewers can click straight through.

import React, { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { useAdmin } from "../lib/adminAuth.jsx";

export default function AdminLogin() {
  const { requestLogin, verifyOtp, loginStep, pendingAdminId, error, loading, token } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/admin/dashboard";

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  // If we're already authenticated (e.g. someone bookmarked /admin/dashboard
  // and bounced here), skip the form.
  if (token && loginStep === "authenticated") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Backend has acknowledged credentials — flip to OTP step. We watch the
  // context's loginStep rather than tracking it locally so other UI (e.g.
  // a re-rendered topbar) also stays in sync.
  useEffect(() => {
    if (loginStep === "otp" && step === 1) setStep(2);
    if (loginStep === "credentials" && step === 2) setStep(1);
  }, [loginStep, step]);

  const submitCredentials = async (e) => {
    e.preventDefault();
    try {
      await requestLogin(email.trim(), password);
    } catch {
      // error is surfaced via context.error
    }
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    try {
      await verifyOtp(pendingAdminId, otp.trim());
      navigate(from, { replace: true });
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
          <p className="mt-2 text-xs uppercase tracking-[.28em] text-cocoa/60">
            {step === 1 ? "Sign in to the dashboard" : "Enter the 6-digit code"}
          </p>
        </div>

        <div className="rounded-sm border border-cocoa/10 bg-shell p-8 md:p-10 shadow-sm">
          {step === 1 ? (
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
                  {loading ? "Sending OTP…" : "Continue"}
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
          ) : (
            <form onSubmit={submitOtp} className="space-y-5">
              <p className="text-sm text-cocoa/70">
                We sent a 6-digit code to <span className="text-gold">{email || "your email"}</span>.
              </p>
              <Field
                label="6-digit OTP"
                value={otp}
                onChange={(v) => setOtp(v.replace(/[^0-9]/g, "").slice(0, 6))}
                placeholder="••••••"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoFocus
                required
              />
              {error && <p className="text-sm text-cocoa">{error}</p>}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 text-xs uppercase tracking-widest text-cocoa/60 hover:text-cocoa"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="px-6 py-3 bg-gold text-sand uppercase tracking-widest text-xs hover:bg-cocoa disabled:opacity-60 transition-colors"
                >
                  {loading ? "Verifying…" : "Sign in"}
                </button>
              </div>
            </form>
          )}
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