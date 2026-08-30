import React, { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";

import { prefersReducedMotion } from "../lib/motion";
import { useWishlist } from "../lib/wishlist.jsx";

// Product shape (from §3 GET /products):
//   { id, slug, name, price, images: [url,...], is_exclusive, rating?, reviews_count? }

const fallbackProductImage = "/images/products/☆★.jpg";

const formatPrice = (n) =>
  typeof n === "number"
    ? `₹${n.toLocaleString("en-IN")}`
    : n || "";

export default function ProductFlipCard({ product, index = 0, compact = false, boutique = false, bestseller = false, disableReveal = false, navigateOnClick = false, disableFlip = false }) {
  const [flipped, setFlipped] = useState(false);
  const navigate = useNavigate();
  const reducedMotion = prefersReducedMotion();
  const { isSaved, toggle } = useWishlist();
  const productId = product?.id ?? product?.slug;
  const saved = productId != null && isSaved(productId);

  const images = Array.isArray(product?.images) && product.images.length
    ? product.images.filter(Boolean)
    : product?.image
      ? [product.image]
      : [fallbackProductImage];

  // Only one image is ever shown on the front face — no hover image swap.
  const frontImg = images[0];
  const marqueeImgs =
    images.length > 1
      ? images
      : [images[0], images[0], images[0], images[0]];

  // Marquee duration scales with image count, 6–10s linear per §7.
  const marqueeDuration = Math.min(
    10,
    Math.max(6, marqueeImgs.length * 1.8)
  );

  // Click/tap (not hover) per §4.1 — works on mobile.
  const onActivate = () => {
    if (navigateOnClick) {
      navigate(`/product/${product?.slug || product?.id}`);
      return;
    }
    if (reducedMotion) {
      setFlipped((v) => !v);
      return;
    }
    setFlipped((v) => !v);
  };

  return (
    <motion.div
      initial={disableReveal ? false : bestseller ? { opacity: 0, y: 20, scale: 0.9 } : { opacity: 0, y: 18 }}
      animate={disableReveal ? { opacity: 1, y: 0 } : undefined}
      whileInView={disableReveal ? undefined : bestseller ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0 }}
      viewport={disableReveal ? undefined : { once: true }}
      whileHover={bestseller ? { y: -8, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)", transition: { duration: 0.3, ease: "easeOut" } } : undefined}
      transition={disableReveal ? { duration: 0 } : { duration: 0.6, delay: bestseller ? (index + 1) * 0.1 : index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative ${compact ? "w-56 md:w-64 shrink-0" : "w-full"} ${boutique ? "max-w-[280px] mx-auto" : ""}`}
    >
      <div
        className={`relative w-full aspect-[4/5] ${disableFlip ? "" : "[perspective:1200px] cursor-pointer"}`}
        {...(!disableFlip && {
          onClick: onActivate,
          role: "button",
          tabIndex: 0,
          "aria-pressed": flipped,
          "aria-label": `${product?.name || "Product"} — tap to flip`,
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onActivate();
            }
          },
        })}
      >
        <motion.div
          className={`absolute inset-0 ${disableFlip ? "" : "[transform-style:preserve-3d]"}`}
          animate={disableFlip ? undefined : {
            rotateY: flipped ? 180 : 0,
            scale: flipped ? 1.02 : 1,
          }}
          transition={{
            rotateY: { duration: 0.7, ease: [0.45, 0, 0.55, 1] },
            scale: { duration: 0.35, ease: "easeOut" },
          }}
          style={disableFlip ? undefined : { transformStyle: "preserve-3d" }}
        >
          {/* FRONT FACE */}
          <div
            className="absolute inset-0 [backface-visibility:hidden] bg-shell rounded-sm overflow-hidden"
            style={{ backfaceVisibility: "hidden" }}
          >
            <img
              src={frontImg}
              alt={product?.name}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {product?.is_exclusive && (
              <span className="absolute top-3 left-3 px-3 py-1 bg-espresso-ink/85 text-pearl font-script italic text-sm rounded-sm tracking-wide">
                Exclusive
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (productId != null) toggle(productId);
              }}
              aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
              aria-pressed={saved}
              className="absolute top-3 right-3 bg-sand/80 backdrop-blur-sm rounded-full p-2 hover:bg-sand transition-colors"
            >
              <Heart
                size={16}
                strokeWidth={1.4}
                className={saved ? "text-gold" : "text-cocoa"}
                fill={saved ? "currentColor" : "none"}
              />
            </button>
          </div>

          {!disableFlip && (
            <div
              className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-shell rounded-sm overflow-hidden"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <div className="w-full h-full overflow-hidden">
                <div
                  className="flex h-full will-change-transform"
                  style={{
                    width: "200%",
                    animation: flipped
                      ? `paara-marquee ${marqueeDuration}s linear infinite`
                      : "none",
                    animationPlayState: flipped ? "running" : "paused",
                  }}
                >
                  {[...marqueeImgs, ...marqueeImgs].map((src, i) => (
                    <img
                      key={`${src}-${i}`}
                      src={src}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="h-full w-1/3 object-cover shrink-0"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <div className="mt-3">
        <Link
          to={`/product/${product?.slug || product?.id}`}
          onClick={(e) => e.stopPropagation()}
          className={`font-display text-base text-cocoa hover:text-gold transition-colors block`}
        >
          {product?.name}
        </Link>
        <div className={`text-gold mt-1 text-sm ${boutique ? "font-medium" : ""}`}>{formatPrice(product?.price)}</div>
      </div>

      <style>{`
        @keyframes paara-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

      `}</style>
    </motion.div>
  );
}
