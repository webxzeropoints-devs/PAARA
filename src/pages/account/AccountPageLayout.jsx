import React from "react";
import { motion } from "framer-motion";

import { fadeUp } from "../../lib/motion";

export default function AccountPageLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-[80vh] bg-sand text-cocoa font-body">
      <div className="max-w-[1000px] mx-auto px-6 md:px-10 py-14">
        <motion.h1 initial="hidden" animate="show" variants={fadeUp} className="font-display text-3xl md:text-4xl mb-2">
          {title}
        </motion.h1>
        {subtitle && <p className="text-sm text-cocoa/60 mb-10">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
