import { Heart, Gift } from "lucide-react";
import { motion } from "framer-motion";

export default function LoyaltyCard({ stampsCount = 0, animateStamps = false, stampAnimationDelay = 0, stampAnimationStagger = 0.34 }) {
  const count = Math.min(Math.max(Number(stampsCount) || 0, 0), 6);
  return (
    <div className="w-full max-w-xl rounded-2xl border border-[#e8d9c8] bg-gradient-to-br from-[#fffaf6] via-[#faf2ea] to-[#f5e8dc] p-5 text-cocoa shadow-[0_12px_32px_-8px_rgba(107,74,51,.22)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.3em] text-gold">Paara Loyalty Card</p>
          <p className="font-display text-2xl mt-2">Collect your shine</p>
          <p className="text-xs text-cocoa/65 mt-1">Spend ₹599 or more and earn 1 stamp.</p>
        </div>
        <Gift className="text-gold" size={22} strokeWidth={1.4} />
      </div>
      <div className="mt-7 grid grid-cols-6 gap-2 sm:gap-4">
        {Array.from({ length: 6 }, (_, index) => {
          const filled = index < count;
          return (
            <motion.div
              key={index}
              initial={animateStamps && filled ? { scale: 0.82 } : false}
              animate={animateStamps && filled ? {
                scale: [0.82, 1.15, 1],
                boxShadow: ["0 0 0 rgba(185,143,78,0)", "0 0 16px rgba(185,143,78,.5)", "0 0 0 rgba(185,143,78,0)"],
              } : undefined}
              transition={animateStamps && filled ? {
                delay: stampAnimationDelay + index * stampAnimationStagger,
                duration: 0.42,
                ease: [0.22, 1.2, 0.36, 1],
              } : undefined}
              className={`aspect-square rounded-full border flex items-center justify-center ${filled ? "border-gold bg-gold text-white" : "border-cocoa/20 bg-white/50 text-cocoa/45"}`}
              style={{ willChange: animateStamps && filled ? "transform, box-shadow" : undefined }}
            >
              <Heart size={18} fill={filled ? "currentColor" : "none"} strokeWidth={1.4} />
            </motion.div>
          );
        })}
      </div>
      <div className="mt-5 flex items-center justify-between text-[10px] uppercase tracking-[.18em] text-cocoa/60">
        <span>{count}/6 stamps</span>
        <span>Valid 6 months from first stamp</span>
      </div>
    </div>
  );
}
