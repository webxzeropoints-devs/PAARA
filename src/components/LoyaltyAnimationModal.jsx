import { motion } from "framer-motion";
import LoyaltyCard from "./LoyaltyCard";

export default function LoyaltyAnimationModal({ isOpen, onClose, onAnimationComplete, stampIndex, totalStamps }) {
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
        <div
          className="relative w-full"
          style={{ perspective: "1200px", transformStyle: "preserve-3d" }}
        >
          <motion.div
            initial={{ rotateY: 0, rotateX: 0, scale: 1, boxShadow: "0 18px 34px -14px rgba(67,42,27,.25)" }}
            animate={{
              rotateY: [0, 270, 540, 810, 1080],
              rotateX: [0, 8, -6, 5, 0],
              scale: [1, 1.012, 1.03, 1.012, 1],
              boxShadow: [
                "0 18px 34px -14px rgba(67,42,27,.25)",
                "8px 12px 22px -16px rgba(67,42,27,.12)",
                "0 28px 48px -12px rgba(67,42,27,.38)",
                "-8px 12px 22px -16px rgba(67,42,27,.12)",
                "0 18px 34px -14px rgba(67,42,27,.25)",
              ],
            }}
            transition={{
              delay: rotationDelay,
              duration: rotationDuration,
              ease: [0.45, 0, 0.55, 1],
              times: [0, 0.25, 0.5, 0.75, 1],
            }}
            onAnimationComplete={onAnimationComplete}
            className="relative will-change-transform"
            style={{ transformStyle: "preserve-3d", willChange: "transform" }}
          >
            <motion.div
              animate={completed ? { scale: [1, 1.035, 1], filter: ["drop-shadow(0 0 0 rgba(185,143,78,0))", "drop-shadow(0 0 18px rgba(185,143,78,.48))", "drop-shadow(0 0 0 rgba(185,143,78,0))"] } : undefined}
              transition={completed ? { delay: completionDelay, duration: 0.65, ease: "easeOut" } : undefined}
              className="relative"
              style={{ transformStyle: "preserve-3d" }}
            >
              <LoyaltyCard
                stampsCount={totalStamps}
                animateStamps
                stampAnimationDelay={stampDelay}
              />
              <motion.div
                aria-hidden="true"
                initial={{ x: "-130%" }}
                animate={{ x: ["-130%", "130%"] }}
                transition={{ delay: rotationDelay + 0.05, duration: rotationDuration, ease: "easeInOut" }}
                className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-2xl"
                style={{
                  willChange: "transform",
                  background: "linear-gradient(120deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)",
                }}
              />
            </motion.div>
          </motion.div>
        </div>
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
