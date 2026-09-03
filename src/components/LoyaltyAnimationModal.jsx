import { motion } from "framer-motion";
import LoyaltyCard from "./LoyaltyCard";

export default function LoyaltyAnimationModal({ isOpen, onClose, stampIndex, totalStamps }) {
  if (!isOpen) return null;
  const completed = Number(stampIndex) >= 6;
  const rotationDelay = 0.28;
  const rotationDuration = 1.8;
  const stampDelay = rotationDelay + rotationDuration - 0.08;
  const completionDelay = stampDelay + Math.max(Number(stampIndex || 0) - 1, 0) * 0.34 + 0.52;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-cocoa/70 p-5" role="dialog" aria-modal="true">
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="w-full max-w-xl"
      >
        <div className="mb-3 flex items-center justify-between text-white">
          <p className="text-xs uppercase tracking-[.25em] text-gold">New stamp earned · {stampIndex}/6</p>
          <button type="button" onClick={onClose} className="text-xs uppercase tracking-widest">Close</button>
        </div>
        <motion.div
          initial={{ rotate: 0, scale: 1 }}
          animate={{ rotate: [0, 360, 720, 1080], scale: [1, 1.015, 1.045, 1.015, 1] }}
          transition={{ delay: rotationDelay, duration: rotationDuration, ease: "easeInOut" }}
          className="will-change-transform"
          style={{ willChange: "transform" }}
        >
          <motion.div
            animate={completed ? { scale: [1, 1.035, 1], filter: ["drop-shadow(0 0 0 rgba(185,143,78,0))", "drop-shadow(0 0 18px rgba(185,143,78,.48))", "drop-shadow(0 0 0 rgba(185,143,78,0))"] } : undefined}
            transition={completed ? { delay: completionDelay, duration: 0.65, ease: "easeOut" } : undefined}
          >
            <LoyaltyCard
              stampsCount={totalStamps}
              animateStamps
              stampAnimationDelay={stampDelay}
            />
          </motion.div>
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: completed ? completionDelay + 0.48 : stampDelay + Math.max(Number(stampIndex || 0) - 1, 0) * 0.34 + 0.25, duration: 0.35 }}
          className="mt-4 text-center text-sm text-white/80"
        >
          {completed ? "Card Complete — your PAARA Loyalty Card is ready." : "Your PAARA Loyalty Card has been updated."}
        </motion.p>
      </motion.div>
    </div>
  );
}
