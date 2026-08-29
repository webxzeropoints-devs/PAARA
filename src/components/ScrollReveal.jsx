import { useEffect } from "react";

const REVEAL_SELECTOR = "section, [data-scroll-reveal], [class*='min-h-'], .paara-products-page";

export default function ScrollReveal({ routeKey }) {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const registered = new WeakSet();

    const reveal = (element) => {
      element.classList.remove("scroll-reveal-pending");
      element.classList.add("scroll-reveal-visible");
    };

    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        observer.unobserve(entry.target);
      }),
      { threshold: 0.12 }
    );

    const register = (element) => {
      if (!(element instanceof HTMLElement) || registered.has(element)) return;
      if (window.getComputedStyle(element).position === "sticky") return;
      registered.add(element);

      const siblings = Array.from(element.parentElement?.children || []).filter((child) => child.matches?.(REVEAL_SELECTOR));
      const staggerIndex = Math.min(Math.max(siblings.indexOf(element), 0), 3);
      element.style.setProperty("--scroll-reveal-delay", `${staggerIndex * 100}ms`);

      if (reduceMotion) {
        reveal(element);
        return;
      }
      element.classList.add("scroll-reveal-pending");
      observer.observe(element);
    };

    const scan = (root = document) => {
      if (root instanceof Element && root.matches(REVEAL_SELECTOR)) register(root);
      root.querySelectorAll?.(REVEAL_SELECTOR).forEach(register);
    };

    scan();
    const mutations = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach(scan));
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer.disconnect();
    };
  }, [routeKey]);

  return null;
}
