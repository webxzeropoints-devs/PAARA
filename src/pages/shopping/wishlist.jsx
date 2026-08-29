import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import ProductFlipCard from "../../components/ProductFlipCard";
import { getProducts } from "../../lib/api";
import { fadeUp } from "../../lib/motion";
import { useWishlist } from "../../lib/wishlist.jsx";

export default function Wishlist() {
  const { ids: wishlistIds } = useWishlist();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProducts()
      .then((list) => {
        if (cancelled) return;
        const ids = new Set(wishlistIds.map(String));
        setProducts(list.filter((p) => ids.has(String(p.id)) || ids.has(p.slug)));
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wishlistIds]);

  if (!loading && wishlistIds.length === 0) {
    return (
      <div className="min-h-[70vh] bg-sand text-cocoa font-body flex items-center justify-center px-6">
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="text-center max-w-md">
          <h1 className="font-display text-3xl md:text-4xl mb-3">Your wishlist is empty</h1>
          <p className="text-sm text-cocoa/60 mb-6">
            Save the pieces that catch your eye — they're waiting for you here.
          </p>
          <Link
            to="/shop"
            className="inline-block bg-gold text-white px-8 py-3 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors"
          >
            Browse the shop
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] bg-sand text-cocoa font-body">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-14">
        <motion.h1
          initial="hidden"
          animate="show"
          variants={fadeUp}
          className="font-display text-3xl md:text-4xl mb-2"
        >
          Your Wishlist
        </motion.h1>
        <p className="text-sm text-cocoa/60 mb-10">
          {wishlistIds.length} {wishlistIds.length === 1 ? "piece" : "pieces"} saved
        </p>

        {loading ? (
          <p className="text-sm text-cocoa/60">Loading…</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-cocoa/60">
            Your saved items aren't available right now.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {products.map((p, i) => (
              <ProductFlipCard key={p.id || p.slug} product={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
