import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { authLogin, setToken } from "../../lib/api";
import { fadeUp } from "../../lib/motion";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.redirectTo || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await authLogin(email.trim(), password);
      if (!res?.token) throw new Error("No login token returned");
      const customerName = res?.customer?.name || res?.user?.name || res?.name || email.trim().split("@")[0].replace(/[._-]+/g, " ");
      localStorage.setItem("paara_customer_name", customerName);
      setToken(res.token);
      window.dispatchEvent(new Event("paara-auth-change"));
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err?.message || "Login failed");
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
        <h1 className="font-display text-3xl md:text-4xl mb-1">Welcome back</h1>
        <p className="text-sm text-cocoa/60 mb-8">Sign in to your Paara account.</p>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors"
            />
            <Link to="/forgot-password" className="inline-block mt-2 text-xs text-gold hover:text-cocoa transition-colors">
              Forgot Password?
            </Link>
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
            {submitting ? "Signing in…" : "Sign In"}
          </motion.button>
        </form>

        <p className="text-xs text-cocoa/60 mt-6 text-center">
          New to Paara?{" "}
          <Link to="/register" className="text-gold hover:text-cocoa transition-colors">
            Create an account
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
