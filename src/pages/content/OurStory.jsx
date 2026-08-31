import React from "react";
import { motion } from "framer-motion";

import { fadeUp } from "../../lib/motion";

export default function OurStory() {
  return (
    <div className="min-h-[80vh] bg-sand text-cocoa font-body">
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-20">
        <motion.p initial="hidden" animate="show" variants={fadeUp} className="text-xs uppercase tracking-[.32em] text-gold text-center">
          Paara. Our Story
        </motion.p>
        <motion.h1 initial="hidden" animate="show" variants={fadeUp} className="font-display text-4xl md:text-6xl leading-tight mt-5 text-center">
          A dream shaped by fashion.<br />A brand built with purpose.
        </motion.h1>

        <div className="mt-12 max-w-2xl mx-auto space-y-6 text-cocoa/75 leading-relaxed text-[1.05rem]">
          <motion.p initial="hidden" animate="show" variants={fadeUp}>
            Paara Jewellery was founded by Dharshini, born from her lifelong love for fashion, styling, and beautiful details.
          </motion.p>
          <motion.p initial="hidden" animate="show" variants={fadeUp}>
            Fashion designing was once a dream I wanted to pursue, but when life took me in a different direction, I decided to create my own path. That journey led me to jewellery — and what began as a small online venture slowly grew into Paara.
          </motion.p>
          <motion.p initial="hidden" animate="show" variants={fadeUp}>
            Today, Paara is built on three things I truly believe in: <strong className="text-cocoa font-medium">style, quality, and trust</strong>.
          </motion.p>
          <motion.p initial="hidden" animate="show" variants={fadeUp}>
            From carefully selected anti-tarnish pieces to meeting customers personally through our weekend stalls in Thiruvallur, every step has been about creating jewellery you can love and trust.
          </motion.p>
          <motion.p initial="hidden" animate="show" variants={fadeUp}>
            Our vision is simple: beautiful, quality jewellery at accessible prices.
          </motion.p>
        </div>

        <motion.blockquote
          initial="hidden"
          animate="show"
          variants={fadeUp}
          className="text-2xl md:text-[1.9rem] leading-[1.3] text-cocoa/85 italic font-medium mt-14 max-w-xl mx-auto text-center"
          style={{ fontFamily: "Cormorant Garamond, serif" }}
        >
          "Paara is more than a jewellery brand — it's a dream I'm building, one piece at a time."
        </motion.blockquote>
        <p className="font-script mt-6 text-3xl text-cocoa text-center">— Dharshini</p>
        <p className="mt-1 text-[10px] uppercase tracking-[.24em] text-cocoa/60 text-center">Founder</p>
      </div>
    </div>
  );
}
