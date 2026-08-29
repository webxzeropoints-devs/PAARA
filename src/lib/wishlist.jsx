// Shared wishlist context — frontend-only state.
// Wishlist is a list of product ids, persisted to localStorage, and mirrors
// the CartProvider pattern already used in this project (see cart.jsx).
//
// Any component can call useWishlist() to read the current ids and to
// toggle/add/remove a product. State updates immediately (no page reload
// needed) and persists across navigation + refresh.

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

const WISHLIST_KEY = "paara_wishlist";
const WISHLIST_EVENT = "paara-wishlist-change";

const readWishlist = () => {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const [ids, setIds] = useState(() => readWishlist());

  // Keep localStorage in sync whenever ids change, and notify any listeners
  // (e.g. the standalone Wishlist page) that aren't using this context.
  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
    } catch {
      // ignore quota errors silently
    }
    window.dispatchEvent(new Event(WISHLIST_EVENT));
  }, [ids]);

  // Stay in sync if another tab (or another part of the app) changes it.
  useEffect(() => {
    const sync = () => setIds(readWishlist());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const isSaved = useCallback((productId) => ids.includes(String(productId)), [ids]);

  const add = useCallback((productId) => {
    const key = String(productId);
    setIds((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }, []);

  const remove = useCallback((productId) => {
    const key = String(productId);
    setIds((prev) => prev.filter((id) => id !== key));
  }, []);

  const toggle = useCallback((productId) => {
    const key = String(productId);
    setIds((prev) => (prev.includes(key) ? prev.filter((id) => id !== key) : [...prev, key]));
  }, []);

  const value = useMemo(
    () => ({ ids, count: ids.length, isSaved, add, remove, toggle }),
    [ids, isSaved, add, remove, toggle]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
  return ctx;
};
