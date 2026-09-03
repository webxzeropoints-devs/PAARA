import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, RotateCcw, Sparkles, X } from "lucide-react";
import LoyaltyCard from "./LoyaltyCard";

export default function LoyaltyAnimationModal({ isOpen, onClose, stampIndex, totalStamps }) {
  const navigate = useNavigate();
  const safeStampIndex = Math.min(Math.max(Number(stampIndex) || 1, 1), 6);
  const [animationStep, setAnimationStep] = useState("entering");
  const [showShine, setShowShine] = useState(false);
  const [spinKey, setSpinKey] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setAnimationStep("entering");
      setShowShine(false);
      return undefined;
    }

    setAnimationStep("entering");
    setShowShine(false);
  }, [isOpen, safeStampIndex, spinKey]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] isolate flex items-center justify-center overflow-hidden p-5" role="dialog" aria-modal="true">
        <motion.div
          initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
          animate={{ opacity: 1, backdropFilter: "blur(24px)" }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          onClick={onClose}
          className="fixed inset-0 bg-cocoa/70"
        />
        <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
          {Array.from({ length: 12 }, (_, index) => (
            <motion.div
              key={`${spinKey}-${index}`}
              initial={{ opacity: 0, y: "105vh", x: `${8 + (index * 7) % 84}vw`, scale: 0.45 + (index % 3) * 0.25 }}
              animate={{ opacity: [0, 0.8, 0], y: ["105vh", "-5vh"] }}
              transition={{ duration: 5 + (index % 3), repeat: Infinity, delay: index * 0.2, ease: "linear" }}
              className="absolute h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_10px_#d4af37]"
            />
          ))}
        </div>
        <div className="relative z-[1] w-full max-w-xl" style={{ perspective: 2000 }}>
          <div className="mb-3 flex items-center justify-between text-white">
            <p className="text-xs uppercase tracking-[.25em] text-gold">New stamp earned · {safeStampIndex}/6</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setSpinKey((value) => value + 1)} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-widest">
                <RotateCcw size={12} /> Replay Stamp
              </button>
              <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                <X size={15} strokeWidth={1.5} />
              </button>
            </div>
          </div>
          <motion.div
            key={spinKey}
            initial={{ scale: 0.94, opacity: 0, rotateX: 7, rotateY: -1440, rotateZ: -1.5, y: 28 }}
            animate={{ scale: [0.94, 1.01, 1], opacity: [0, 1, 1], rotateX: [7, -1, 0], rotateY: [-4, 1, 0], rotateZ: [-1.5, 0.5, 0], y: [28, -2, 0] }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            onAnimationComplete={() => setAnimationStep("sealing")}
            className="w-full"
            style={{ transformStyle: "preserve-3d", willChange: "transform" }}
          >
            <motion.div animate={animationStep === "revealed" ? { rotateY: [-2, 2, -2], rotateX: [1.2, -1.5, 1.2], y: [-3, 3, -3] } : {}} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} style={{ transformStyle: "preserve-3d" }}>
              <LoyaltyCard
                stampsCount={animationStep === "entering" ? Math.max(0, safeStampIndex - 1) : safeStampIndex}
                animatedStampIndex={animationStep === "sealing" ? safeStampIndex : null}
                showShine={showShine}
                onStampAnimationComplete={() => setShowShine(true)}
                onShineComplete={() => setAnimationStep("revealed")}
              />
            </motion.div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: animationStep === "revealed" ? 1 : 0.8, y: 0 }} transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }} className="mt-4 text-center text-white">
            <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/20 px-3.5 py-1 text-[11px] uppercase tracking-[.2em] text-[#f5e5c9]">
              <Sparkles size={12} /> Stamp {safeStampIndex} Sealed & Recorded
            </div>
            <h2 className="font-display text-xl uppercase tracking-[.06em] sm:text-2xl">You've earned a PAARA Loyalty Stamp</h2>
            <p className="mt-1 text-xs tracking-wider text-[#e6d5c3]">{safeStampIndex} of 6 stamps completed</p>
            <div className="mx-auto mt-4 flex max-w-sm flex-col justify-center gap-2.5 sm:flex-row">
              <button type="button" onClick={() => { onClose(); navigate("/account/loyalty"); }} className="flex-1 rounded-sm bg-gold px-5 py-2.5 text-xs uppercase tracking-[.2em] text-white">
                View Loyalty Card <ArrowRight size={13} className="ml-1 inline" />
              </button>
              <button type="button" onClick={() => { onClose(); navigate("/collections"); }} className="flex-1 rounded-sm border border-white/40 px-5 py-2.5 text-xs uppercase tracking-[.2em] text-white">
                Continue Shopping
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
