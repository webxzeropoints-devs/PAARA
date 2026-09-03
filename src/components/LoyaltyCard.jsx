import { Heart, Gift } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useId, useLayoutEffect, useRef, useState } from "react";

const HEART_PATH = "M22 37 C22 37 3 24 3 13 C3 7.5 7.5 3.5 12.5 3.5 C16 3.5 19 5.2 22 8.5 C25 5.2 28 3.5 31.5 3.5 C36.5 3.5 41 7.5 41 13 C41 24 22 37 22 37Z";

function InkHeartImpression({ number }) {
  const inkId = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 44 40" className="w-full h-full" aria-hidden="true">
      <defs>
        <clipPath id={`ink-clip-${inkId}`}><path d={HEART_PATH} /></clipPath>
        <filter id={`ink-soften-${inkId}`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.22" /></filter>
      </defs>
      <path d={HEART_PATH} fill="#A71427" />
      <path d={HEART_PATH} fill="none" stroke="#74101D" strokeWidth="1.1" opacity="0.62" />
      <g clipPath={`url(#ink-clip-${inkId})`}>
        <path d="M5 14 C12 10 15 17 22 13 C28 9 33 15 40 11" fill="none" stroke="#E66A72" strokeWidth="1.25" strokeLinecap="round" opacity="0.48" filter={`url(#ink-soften-${inkId})`} />
        <path d="M9 21 C15 16 19 26 27 19 C31 16 36 22 39 18" fill="none" stroke="#6E0C1A" strokeWidth="1.05" strokeLinecap="round" opacity="0.46" />
      </g>
      <text x="50%" y="59%" textAnchor="middle" dominantBaseline="middle" fontSize="12.5" fontWeight="700" fill="#FCE4C5" fontFamily="'Dancing Script', 'Pacifico', cursive">Paara.</text>
    </svg>
  );
}

function RubberStamp({ target }) {
  const stampId = useId().replace(/:/g, "");
  return (
    <div className="absolute z-50 pointer-events-none" style={{ left: `${target.x}px`, top: `${target.y}px`, transform: "translate(-50%, -100%)" }} aria-hidden="true">
      <motion.div
        initial={{ opacity: 0, x: 34, y: -285, rotate: -16, scaleX: 0.92, scaleY: 0.92 }}
        animate={{ opacity: [0, 1, 1, 1, 1, 1, 0], x: [34, 20, 6, 0, 0, -9, -24], y: [-285, -164, -38, 0, 8, -23, -300], rotate: [-16, -9, 2.5, 0, 0.8, -4, 7], scaleX: [0.92, 0.98, 1.02, 1.1, 1.12, 1, 0.96], scaleY: [0.92, 0.98, 1.02, 0.83, 0.8, 1, 0.98] }}
        transition={{ duration: 1.8, times: [0, 0.14, 0.56, 0.63, 0.75, 0.86, 1], ease: [0.22, 0.72, 0.24, 1] }}
        className="w-[clamp(82px,17vw,126px)] origin-bottom will-change-transform"
        style={{ filter: "drop-shadow(0 13px 10px rgba(54, 22, 11, 0.23))", transformOrigin: "50% 100%" }}
      >
        <svg viewBox="0 0 126 188" className="block h-auto w-full overflow-visible">
          <defs>
            <linearGradient id={`wood-${stampId}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F3C78D" /><stop offset="0.38" stopColor="#B87839" /><stop offset="0.7" stopColor="#7A3D1E" /><stop offset="1" stopColor="#4B2010" /></linearGradient>
            <linearGradient id={`brass-${stampId}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF0BC" /><stop offset="0.4" stopColor="#C5953E" /><stop offset="1" stopColor="#6C3E14" /></linearGradient>
            <linearGradient id={`rubber-${stampId}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9D1022" /><stop offset="1" stopColor="#4C0611" /></linearGradient>
          </defs>
          <ellipse cx="63" cy="182" rx="48" ry="5.8" fill="#3B150B" opacity="0.28" />
          <path d="M38 65 C35 49 38 27 47 15 C55 4 71 4 79 15 C88 27 91 49 88 65 Z" fill={`url(#wood-${stampId})`} stroke="#5E2F16" strokeWidth="2" />
          <path d="M45 61 H81 L88 121 H38 Z" fill={`url(#wood-${stampId})`} stroke="#5C2A13" strokeWidth="2" />
          <path d="M37 116 H89 L96 131 Q94 139 88 139 H38 Q32 139 30 131 Z" fill={`url(#brass-${stampId})`} stroke="#6D431D" strokeWidth="2" />
          <path d="M31 132 H95 L103 151 Q101 157 94 158 H32 Q25 157 23 151 Z" fill="#682417" stroke="#45120D" strokeWidth="2" />
          <path d="M27 151 H99 L103 170 Q100 177 93 177 H33 Q26 177 23 170 Z" fill={`url(#rubber-${stampId})`} stroke="#35070C" strokeWidth="2.4" />
          <path d="M53 165 C57 160 62 162 63 166 C64 162 69 160 73 165 C77 171 63 176 63 176 C63 176 49 171 53 165 Z" fill="#F3B6B3" opacity="0.76" />
        </svg>
      </motion.div>
    </div>
  );
}

export default function LoyaltyCard({ stampsCount = 0, animatedStampIndex = null, showShine = false, className = "" }) {
  const count = Math.min(Math.max(Number(stampsCount) || 0, 0), 6);
  const cardRef = useRef(null);
  const heartRefs = useRef({});
  const [stampTarget, setStampTarget] = useState(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (!animatedStampIndex || !cardRef.current || !heartRefs.current[animatedStampIndex]) {
      setStampTarget(null);
      return undefined;
    }
    const measureTarget = () => {
      const cardBox = cardRef.current?.getBoundingClientRect();
      const heartBox = heartRefs.current[animatedStampIndex]?.getBoundingClientRect();
      if (cardBox && heartBox) setStampTarget({ x: heartBox.left - cardBox.left + heartBox.width / 2, y: heartBox.top - cardBox.top + heartBox.height / 2 + 4 });
    };
    const frame = window.requestAnimationFrame(measureTarget);
    window.addEventListener("resize", measureTarget);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measureTarget);
    };
  }, [animatedStampIndex]);

  return (
    <div ref={cardRef} className={`relative w-full max-w-xl overflow-visible rounded-2xl border border-[#e8d9c8] bg-gradient-to-br from-[#fffaf6] via-[#faf2ea] to-[#f5e8dc] p-5 text-cocoa shadow-[0_12px_32px_-8px_rgba(107,74,51,.22)] ${className}`}>
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
          const stepNum = index + 1;
          const filled = stepNum <= count;
          const animating = animatedStampIndex === stepNum;
          return (
            <div key={stepNum} ref={(node) => { heartRefs.current[stepNum] = node; }} className="relative aspect-square">
              {animating ? (
                <motion.div className="relative flex h-full w-full items-center justify-center" animate={reducedMotion ? {} : { x: [0, 0, -1.5, 1.25, 0], y: [0, 0, 1.5, -1, 0], scale: [1, 1, 0.94, 1.04, 1] }} transition={{ duration: 1.8, times: [0, 0.56, 0.63, 0.75, 1] }}>
                  <Heart size={18} className="absolute h-full w-full text-cocoa/45" strokeWidth={1.4} />
                  <motion.div initial={{ clipPath: "inset(49% 49% 49% 49% round 45%)", scale: 0.72, rotate: -3 }} animate={reducedMotion ? { clipPath: "inset(0% 0% 0% 0% round 0%)", scale: 1, rotate: 0 } : { clipPath: ["inset(49% 49% 49% 49% round 45%)", "inset(49% 49% 49% 49% round 45%)", "inset(2% 2% 2% 2% round 12%)", "inset(0% 0% 0% 0% round 0%)", "inset(0% 0% 0% 0% round 0%)"], scale: [0.72, 0.72, 1.16, 0.97, 1], rotate: [-3, -3, 1.5, -0.7, 0] }} transition={{ duration: 1.8, times: [0, 0.56, 0.63, 0.75, 1], ease: "easeOut" }} className="absolute inset-0 z-10" style={{ transformOrigin: "center center", willChange: "clip-path, transform" }}>
                    <InkHeartImpression number={stepNum} />
                  </motion.div>
                </motion.div>
              ) : <Heart size={18} className={`h-full w-full ${filled ? "text-gold" : "text-cocoa/45"}`} fill={filled ? "currentColor" : "none"} strokeWidth={1.4} />}
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex items-center justify-between text-[10px] uppercase tracking-[.18em] text-cocoa/60">
        <span>{count}/6 stamps</span>
        <span>Valid 6 months from first stamp</span>
      </div>
      {showShine && <motion.div initial={{ x: "-130%", opacity: 0 }} animate={{ x: "230%", opacity: [0, 0.85, 0] }} transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.05 }} className="pointer-events-none absolute inset-y-0 z-30 w-2/5 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/55 to-transparent" />}
      {stampTarget && animatedStampIndex && !reducedMotion && <RubberStamp target={stampTarget} />}
    </div>
  );
}
