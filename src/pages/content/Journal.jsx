import React from "react";
import { motion } from "framer-motion";

import { fadeUp, gridParent, childFadeUp } from "../../lib/motion";

const POSTS = [
  {
    title: "How to layer necklaces without the tangle",
    excerpt: "Three easy rules for building an everyday layered look that stays put.",
    tag: "Styling",
  },
  {
    title: "Caring for gold-plated jewellery",
    excerpt: "Simple habits that keep your Paara pieces glowing for years.",
    tag: "Care Guide",
  },
  {
    title: "The story behind our Ocean collection",
    excerpt: "A look at the coastal moments that inspired this season's drop.",
    tag: "Behind the Brand",
  },
];

export default function Journal() {
  return (
    <div className="min-h-[80vh] bg-sand text-cocoa font-body">
      <div className="max-w-5xl mx-auto px-6 md:px-10 py-20">
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="text-center mb-14">
          <p className="text-xs uppercase tracking-[.3em] text-gold">The Paara. Journal</p>
          <h1 className="font-display text-4xl md:text-5xl mt-3">Notes on jewellery &amp; everyday luxury</h1>
        </motion.div>

        <motion.div variants={gridParent} initial="hidden" animate="show" className="grid md:grid-cols-3 gap-8">
          {POSTS.map((post) => (
            <motion.article key={post.title} variants={childFadeUp} className="border border-cocoa/10 rounded-sm p-6 bg-white/40 hover:border-gold/50 transition-colors">
              <p className="text-[10px] uppercase tracking-widest text-gold mb-3">{post.tag}</p>
              <h2 className="font-display text-xl mb-2">{post.title}</h2>
              <p className="text-sm text-cocoa/60">{post.excerpt}</p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
