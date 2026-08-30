import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { apiPost } from "../../lib/api";
import { fadeUp } from "../../lib/motion";
import { isStrongPassword, PASSWORD_ERROR } from "../../lib/validation";
import PasswordRequirements from "../../components/PasswordRequirements";

export default function ForgotPassword() {
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
      await apiPost("/auth/forgot-password/request", { email });
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
      await apiPost("/auth/forgot-password/reset", {
        email,
        code,
        password,
      });
      navigate("/login", { state: { message: "Password reset successful. Please sign in." } });
    } catch (err) {
      setError(err.message || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] bg-sand text-cocoa font-body flex items-center justify-center px-6 py-16">
      {step === "request" ? (
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="w-full max-w-md bg-sand/60 border border-cocoa/10 rounded-sm p-8 md:p-10 shadow-sm">
          <h1 className="font-display text-3xl md:text-4xl mb-1">Forgot Password</h1>
          <p className="text-sm text-cocoa/60 mb-8">Enter your email to receive a full reset code.</p>
          <form onSubmit={submitRequest} className="space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors"
              />
            </div>
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-sm">{error}</div>
            )}
            <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.97 }} className="w-full bg-gold text-white py-3 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors disabled:opacity-60">
              {loading ? "Sending…" : "Send code"}
            </motion.button>
          </form>
          <p className="text-xs text-cocoa/60 mt-6 text-center">
            <Link to="/login" className="text-gold hover:text-cocoa transition-colors">← Back to sign in</Link>
          </p>
        </motion.div>
      ) : (
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="w-full max-w-md bg-sand/60 border border-cocoa/10 rounded-sm p-8 md:p-10 shadow-sm">
          <h1 className="font-display text-3xl md:text-4xl mb-1">New Password</h1>
          <p className="text-sm text-cocoa/60 mb-8">Use the code sent to {email} and choose a new password.</p>
          <form onSubmit={submitReset} className="space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">Reset code</label>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors"
              />
              <PasswordRequirements password={password} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">Confirm password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors"
              />
            </div>
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-sm">{error}</div>
            )}
            <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.97 }} className="w-full bg-gold text-white py-3 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors disabled:opacity-60">
              {loading ? "Resetting…" : "Reset password"}
            </motion.button>
          </form>
        </motion.div>
      )}
    </div>
  );
}
