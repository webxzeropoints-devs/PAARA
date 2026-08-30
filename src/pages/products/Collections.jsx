import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";

import ProductFlipCard from "../../components/ProductFlipCard";
import { getProducts } from "../../lib/api";
import { fadeUp, gridParent, childFadeUp } from "../../lib/motion";

const MATERIALS = ["sterling_silver", "stainless_steel", "brass", "titanium"];
const VIBES = ["everyday", "festive", "minimal"];
const GENDERS = ["women", "men", "unisex"];
const SORTS = [
  { value: "popularity", label: "Sort by: Popularity" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest" },
];

const COLLECTIONS = {
  "for-her": [],
  "for-him": [],
  necklaces: ["pendant-necklaces", "layered-necklaces", "charm-necklaces"],
  earrings: ["studs", "hoops", "drop-earrings", "statement-earrings"],
  bracelets: ["chain-bracelets", "charm-bracelets", "cuff-style-bracelets"],
  rings: ["minimal-rings", "statement-rings", "stackable-rings"],
  charms: ["shell-charms", "heart-charms", "pearl-charms", "letter-initial-charms"],
  pearls: ["pearl-necklaces", "pearl-earrings", "pearl-bracelets", "pearl-charms"],
  shells: ["shell-necklaces", "shell-earrings", "shell-bracelets", "shell-charms"],
};

const labelize = (value) => value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const normalizeList = (data) => (Array.isArray(data) ? data : data?.products || []);
const AUDIENCE_GENDERS = { "for-her": "women", "for-him": "men" };

export default function Collections() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filters = useMemo(() => {
    const category = params.get("category") || "";
    const requestedGender = params.get("gender") || "";
    const audience = AUDIENCE_GENDERS[category] ? category : AUDIENCE_GENDERS[requestedGender] ? requestedGender : "";
    return {
      gender: audience ? AUDIENCE_GENDERS[audience] : requestedGender,
      material: params.get("material") || "",
      vibe: params.get("vibe") || "",
      category,
      subcategory: params.get("subcategory") || "",
      sort: params.get("sort") || "popularity",
      audience,
    };
  }, [params]);

  const apiFilters = useMemo(() => ({
    ...filters,
    category: filters.audience ? "" : filters.category,
  }), [filters]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getProducts(apiFilters)
      .then((data) => {
        if (cancelled) return;
        setProducts(normalizeList(data));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "Could not load products");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiFilters]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const setCategory = (category) => {
    const next = new URLSearchParams(params);
    if (category) next.set("category", category);
    else next.delete("category");
    next.delete("subcategory");
    setParams(next, { replace: true });
  };

  return (
    <div className="min-h-[80vh] bg-sand text-cocoa font-body">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 py-14">
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp}
          className="text-center mb-10"
        >
          <h1 className="font-display text-3xl md:text-4xl">Shop the collection</h1>
          <div className="w-16 h-px bg-gold mx-auto mt-3" />
        </motion.div>

        <div className="grid md:grid-cols-[220px_1fr] gap-10">
          {/* Filter rail */}
          <aside className="md:sticky md:top-24 h-fit border border-cocoa/10 rounded-sm p-5 bg-sand/60">
            <h2 className="text-xs uppercase tracking-widest text-cocoa/60 mb-3">Filters</h2>

            <FilterGroup
              label="Gender"
              value={filters.gender}
              options={GENDERS}
              onChange={(v) => setFilter("gender", v)}
            />
            <FilterGroup
              label="Material"
              value={filters.material}
              options={MATERIALS}
              onChange={(v) => setFilter("material", v)}
            />
            <FilterGroup
              label="Vibe"
              value={filters.vibe}
              options={VIBES}
              onChange={(v) => setFilter("vibe", v)}
            />
            <FilterGroup
              label="Collection"
              value={filters.category}
              options={Object.keys(COLLECTIONS)}
              onChange={setCategory}
            />
            {filters.category && COLLECTIONS[filters.category]?.length > 0 && (
              <FilterGroup
                label={`${labelize(filters.category)} styles`}
                value={filters.subcategory}
                options={COLLECTIONS[filters.category] || []}
                onChange={(value) => setFilter("subcategory", value)}
              />
            )}

            <div className="mt-4">
              <p className="text-xs uppercase tracking-widest text-cocoa/60 mb-2">Sort</p>
              <select
                value={filters.sort}
                onChange={(e) => setFilter("sort", e.target.value)}
                className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-1 text-sm"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setParams({}, { replace: true })}
              className="mt-5 text-xs uppercase tracking-widest text-cocoa/50 hover:text-cocoa transition-colors"
            >
              Clear all
            </button>
          </aside>

          <section>
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-sm mb-6">
                {error}
              </div>
            )}

            {loading ? (
              <p className="text-sm text-cocoa/60">Loading pieces…</p>
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-cocoa/60 mb-4">
                  Curating luxury pieces for this collection. Check back soon.
                </p>
                <button
                  onClick={() => setParams({}, { replace: true })}
                  className="text-xs uppercase tracking-widest text-gold hover:text-cocoa transition-colors"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <motion.div
                variants={gridParent}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8"
              >
                {products.map((p, i) => (
                  <motion.div key={p.id || p.slug} variants={childFadeUp}>
                    <ProductFlipCard product={p} index={i} navigateOnClick />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ label, value, options, onChange }) {
  return (
    <div className="mt-4">
      <p className="text-xs uppercase tracking-widest text-cocoa/60 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(value === opt ? "" : opt)}
            className={`text-xs uppercase tracking-widest px-3 py-1 rounded-sm border transition-colors ${
              value === opt
                ? "bg-cocoa text-sand border-cocoa"
                : "border-cocoa/20 text-cocoa/70 hover:border-cocoa/40"
            }`}
          >
            {opt.replace(/_/g, " ")}
          </button>
        ))}
      </div>
    </div>
  );
}
