import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { authRegister } from "../../lib/api";
import { fadeUp } from "../../lib/motion";
import { isStrongPassword, normalizePhone, PASSWORD_ERROR, PHONE_ERROR } from "../../lib/validation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const validate = () => {
    if (!form.name.trim()) return "Full name is required.";
    if (!form.phone.trim()) return "Phone number is required.";
    if (!normalizePhone(form.phone)) return PHONE_ERROR;
    if (!form.email.trim()) return "Email is required.";
    if (!EMAIL_RE.test(form.email.trim())) return "Enter a valid email address.";
    if (!form.password) return "Password is required.";
    if (!isStrongPassword(form.password)) return PASSWORD_ERROR;
    if (form.password !== form.confirmPassword) return "Passwords do not match.";
    return "";
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await authRegister({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase() || undefined,
        phone: normalizePhone(form.phone),
        password: form.password,
      });
      if (!res?.requires_otp || !res.email) throw new Error("No OTP challenge returned");
      navigate("/otp", { state: { email: res.email, redirectTo: "/account/orders", mode: "register" } });
    } catch (err) {
      setError(err?.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] bg-sand text-cocoa font-body flex items-center justify-center px-6 py-16">
      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeUp}
        className="w-full max-w-md bg-sand/60 border border-cocoa/10 rounded-sm p-8 md:p-10 shadow-sm"
      >
        <h1 className="font-display text-3xl md:text-4xl mb-1">Create your account</h1>
        <p className="text-sm text-cocoa/60 mb-8">A few small details and you're in.</p>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">
              Full name *
            </label>
            <input
              required
              value={form.name}
              onChange={update("name")}
              className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">
              Phone *
            </label>
            <input
              type="tel"
              required
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => update("phone")({ target: { value: e.target.value.replace(/\D/g, "").slice(0, 10) } })}
              maxLength={10}
              className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">
              Email *
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={update("email")}
              className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">
              Password *
            </label>
            <input
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              value={form.password}
              onChange={update("password")}
              className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">
              Confirm Password *
            </label>
            <input
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={update("confirmPassword")}
              className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors"
            />
          </div>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-sm">
              {error}
            </div>
          )}

          <motion.button
            type="submit"
            disabled={submitting}
            whileTap={{ scale: 0.97 }}
            className="w-full bg-gold text-white py-3 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create Account"}
          </motion.button>
        </form>

        <p className="text-xs text-cocoa/60 mt-6 text-center">
          Already with us?{" "}
          <Link to="/login" className="text-gold hover:text-cocoa transition-colors">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
