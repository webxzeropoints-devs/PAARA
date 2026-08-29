import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import OTPVerification from "../../components/OTPVerification";
import { fadeUp } from "../../lib/motion";

// Entirely frontend/demo flow: Email or Phone -> OTP -> New Password -> Success.
// The backend password is never actually changed.
const STEPS = ["identify", "otp", "reset", "success"];

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(STEPS[0]);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const onIdentifySubmit = (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("Enter your email or phone number.");
      return;
    }
    setError("");
    setStep("otp");
  };

  const onResetSubmit = (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    // Demo-only: no backend call is made, the account password is unchanged.
    setStep("success");
  };

  return (
    <div className="min-h-[80vh] bg-sand text-cocoa font-body flex items-center justify-center px-6 py-16">
      {step === "identify" && (
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="w-full max-w-md bg-sand/60 border border-cocoa/10 rounded-sm p-8 md:p-10 shadow-sm">
          <h1 className="font-display text-3xl md:text-4xl mb-1">Forgot Password</h1>
          <p className="text-sm text-cocoa/60 mb-8">Enter your email or phone and we'll send a verification code (demo).</p>
          <form onSubmit={onIdentifySubmit} className="space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">Email or Phone</label>
              <input
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors"
              />
            </div>
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-sm">{error}</div>
            )}
            <motion.button type="submit" whileTap={{ scale: 0.97 }} className="w-full bg-gold text-white py-3 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors">
              Send code
            </motion.button>
          </form>
          <p className="text-xs text-cocoa/60 mt-6 text-center">
            <Link to="/login" className="text-gold hover:text-cocoa transition-colors">← Back to sign in</Link>
          </p>
        </motion.div>
      )}

      {step === "otp" && (
        <OTPVerification
          title="Verify it's you"
          subtitle={`Enter the code sent to ${identifier} (demo).`}
          onVerified={() => setStep("reset")}
          onBack={() => setStep("identify")}
        />
      )}

      {step === "reset" && (
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="w-full max-w-md bg-sand/60 border border-cocoa/10 rounded-sm p-8 md:p-10 shadow-sm">
          <h1 className="font-display text-3xl md:text-4xl mb-1">New Password</h1>
          <p className="text-sm text-cocoa/60 mb-8">Choose a new password for your account.</p>
          <form onSubmit={onResetSubmit} className="space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">New password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">Confirm password</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors"
              />
            </div>
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-sm">{error}</div>
            )}
            <motion.button type="submit" whileTap={{ scale: 0.97 }} className="w-full bg-gold text-white py-3 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors">
              Reset password
            </motion.button>
          </form>
        </motion.div>
      )}

      {step === "success" && (
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="w-full max-w-md bg-sand/60 border border-cocoa/10 rounded-sm p-8 md:p-10 shadow-sm text-center">
          <h1 className="font-display text-3xl md:text-4xl mb-3">Password updated</h1>
          <p className="text-sm text-cocoa/60 mb-8">This was a frontend demo — no backend password was changed. You can sign in below.</p>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="w-full bg-gold text-white py-3 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors"
          >
            Back to sign in
          </button>
        </motion.div>
      )}
    </div>
  );
}
