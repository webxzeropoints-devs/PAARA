import React, { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

import { prefersReducedMotion } from "../lib/motion";

// Cursor sand-ripple (AI_BUILD_BRIEF §4.3):
// - Layered divs positioned BEHIND page content (z below text/buttons)
// - Soft trailing ripple via useMotionValue + useSpring (lag, not 1:1)
// - Disabled on touch devices and when prefers-reduced-motion is set
//
// All hooks run unconditionally on every render (Rules of Hooks). When the
// component is disabled we just return null AFTER all hooks have been called.

export default function CursorRipple({ className = "" }) {
  const [enabled, setEnabled] = useState(false);

  const x = useMotionValue(-200);
  const y = useMotionValue(-200);

  // Two springs for the lagging ripple effect — the outer ring trails more.
  const sxInner = useSpring(x, { stiffness: 50, damping: 20 });
  const syInner = useSpring(y, { stiffness: 50, damping: 20 });
  const sxOuter = useSpring(x, { stiffness: 35, damping: 25 });
  const syOuter = useSpring(y, { stiffness: 35, damping: 25 });

  useEffect(() => {
    if (prefersReducedMotion()) {
      setEnabled(false);
      return undefined;
    }
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const noHover = window.matchMedia("(hover: none)").matches;
    if (coarse || noHover) {
      setEnabled(false);
      return undefined;
    }
    setEnabled(true);
    return undefined;
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const handleMove = (e) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMove);
  }, [enabled, x, y]);

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-[1] overflow-hidden ${className}`}
    >
      <motion.div
        style={{ x: sxInner, y: syInner, translateX: "-50%", translateY: "-50%" }}
        className="absolute top-0 left-0 w-[420px] h-[420px] rounded-full opacity-40 mix-blend-multiply"
      >
        <div
          className="w-full h-full rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(195,166,122,0.35) 0%, rgba(195,166,122,0.18) 30%, rgba(195,166,122,0) 65%)",
          }}
        />
      </motion.div>
      <motion.div
        style={{ x: sxOuter, y: syOuter, translateX: "-50%", translateY: "-50%" }}
        className="absolute top-0 left-0 w-[700px] h-[700px] rounded-full opacity-30 mix-blend-multiply"
      >
        <div
          className="w-full h-full rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(218,197,161,0.25) 0%, rgba(218,197,161,0.1) 35%, rgba(218,197,161,0) 70%)",
          }}
        />
      </motion.div>
    </div>
  );
}
