import { motion } from "framer-motion";
import LoyaltyCard from "./LoyaltyCard";

export default function LoyaltyAnimationModal({ isOpen, onClose, stampIndex, totalStamps }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-cocoa/70 p-5" role="dialog" aria-modal="true">
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-xl">
        <div className="mb-3 flex items-center justify-between text-white">
          <p className="text-xs uppercase tracking-[.25em] text-gold">New stamp earned · {stampIndex}/6</p>
          <button type="button" onClick={onClose} className="text-xs uppercase tracking-widest">Close</button>
        </div>
        <LoyaltyCard stampsCount={totalStamps} />
        <p className="mt-4 text-center text-sm text-white/80">Your PAARA Rewards Card has been updated.</p>
      </motion.div>
    </div>
  );
}
