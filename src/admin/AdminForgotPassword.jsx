import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { apiPost } from "../lib/api";
import { fadeUp } from "../lib/motion";
import { isStrongPassword, PASSWORD_ERROR } from "../lib/validation";
import PasswordRequirements from "../components/PasswordRequirements";
import PasswordInput from "../components/PasswordInput";

export default function AdminForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("request");

  const submitRequest = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiPost("/admin-auth/forgot-password/request", { email });
      setStep("reset");
    } catch (err) {
      setError(err.message || "Unable to send reset code.");
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (event) => {
    event.preventDefault();
    setError("");

    if (!isStrongPassword(password)) {
      setError(PASSWORD_ERROR);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit reset code.");
      return;
    }

    setLoading(true);

    try {
      await apiPost("/admin-auth/forgot-password/reset", {
        email,
        code,
        password,
      });
      navigate("/admin/login", { state: { message: "Password reset successful, please log in." } });
    } catch (err) {
      setError(err.message || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand text-cocoa font-body flex items-center justify-center px-5 py-12">
      <motion.div initial="hidden" animate="show" variants={fadeUp} className="w-full max-w-md rounded-sm border border-cocoa/10 bg-shell p-8 md:p-10 shadow-sm">
        <h1 className="font-display text-3xl md:text-4xl mb-1">Reset admin password</h1>
        <p className="text-sm text-cocoa/60 mb-8">
          {step === "request" ? "Enter your admin email to receive a reset code." : "Verify the code and choose a new password."}
        </p>

        {step === "request" ? (
          <form onSubmit={submitRequest} className="space-y-5">
            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">Admin email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm text-cocoa placeholder-cocoa/35 transition-colors"
              />
            </label>

            {error && <div className="text-xs text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-sm">{error}</div>}

            <button type="submit" disabled={loading} className="w-full bg-gold text-sand py-3 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors disabled:opacity-60">
              {loading ? "Sending code…" : "Send reset code"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitReset} className="space-y-5">
            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm text-cocoa placeholder-cocoa/35 transition-colors"
              />
            </label>

            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">Reset code</span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm text-cocoa placeholder-cocoa/35 transition-colors"
              />
            </label>

            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">New password</span>
              <PasswordInput
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm text-cocoa placeholder-cocoa/35 transition-colors"
              />
              <PasswordRequirements password={password} />
            </label>

            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">Confirm new password</span>
              <PasswordInput
                minLength={8}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm text-cocoa placeholder-cocoa/35 transition-colors"
              />
            </label>

            {error && <div className="text-xs text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-sm">{error}</div>}

            <button type="submit" disabled={loading} className="w-full bg-gold text-sand py-3 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors disabled:opacity-60">
              {loading ? "Resetting…" : "Reset password"}
            </button>
          </form>
        )}

        <p className="text-xs text-cocoa/60 mt-6 text-center">
          <Link to="/admin/login" className="text-gold hover:text-cocoa transition-colors">← Back to admin sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
