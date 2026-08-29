import { Children } from "react";
import { motion, useReducedMotion } from "framer-motion";

export default function VaultScrollStage({ children }) {
  const cards = Children.toArray(children);
  const reduceMotion = useReducedMotion();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto px-4 py-5">
      {cards.map((card, index) => (
        <motion.div
          key={card.key ?? index}
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: reduceMotion ? 0 : index * 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {card}
        </motion.div>
      ))}
    </div>
  );
}
