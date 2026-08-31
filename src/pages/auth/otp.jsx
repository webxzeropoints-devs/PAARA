import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import OTPVerification from "../../components/OTPVerification";
import { apiPost } from "../../lib/api";

// Frontend-only OTP step used after registration.
// Expects location.state = { email, mode: "register" }
export default function OTP() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location?.state || {};

  useEffect(() => {
    if (!state.email) {
      // Nothing to verify — bounce back to login.
      navigate("/login", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onVerified = async (code) => {
    await apiPost("/auth/email/verify-otp", { email: state.email, code });
    navigate("/login", { replace: true, state: { redirectTo: state.redirectTo || "/account/orders" } });
  };

  const onResend = () => apiPost("/auth/email/request-otp", { email: state.email });

  return (
    <div className="min-h-[80vh] bg-sand text-cocoa font-body flex items-center justify-center px-6 py-16">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <OTPVerification
          title="Verify it's you"
          subtitle={`One quick step to finish creating your account. Sent to ${state.email}.`}
          onVerified={onVerified}
          onResend={onResend}
          onBack={() => navigate(-1)}
        />
      </motion.div>
    </div>
  );
}
