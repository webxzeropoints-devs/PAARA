import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Heart,
  ShoppingBag,
  User,
  Menu,
  X,
  Package,
  MapPin,
  Gift,
  Bell,
  Headphones,
  Truck,
  LogOut,
} from "lucide-react";

import { useCart } from "../lib/cart.jsx";
import { getToken } from "../lib/api";
import { clearToken } from "../lib/api";

/**
 * Navbar
 * - Main nav: Home | Shopping | Our Story | Journal
 * - "Shopping" opens the existing Collections page at /collections
 * - Cart icon shows live item count
 * - Account icon routes to /login or /account/orders
 * - Hamburger icon opens a solid/opaque account drawer (Orders, Saved
 *   Addresses, Gift Cards, Notifications, Customer Care, Track Order)
 */

const NAV_ITEMS = [
  { label: "Home", to: "/" },
  { label: "Shopping", to: "/collections" },
  { label: "Our Story", to: "/our-story" },
  { label: "Journal", to: "/journal" },
];

const ACCOUNT_ITEMS = [
  { label: "Orders", to: "/account/orders", icon: Package },
  { label: "Saved Addresses", to: "/account/addresses", icon: MapPin },
  { label: "Loyalty Card", to: "/account/gift-cards", icon: Gift },
  { label: "Notifications", to: "/account/notifications", icon: Bell },
  { label: "Customer Care", to: "/account/customer-care", icon: Headphones },
  { label: "Track Order", to: "/account/track-order", icon: Truck },
];

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const location = useLocation();
  const { count, clear: clearCart } = useCart();
  const [authed, setAuthed] = useState(() => Boolean(getToken()));

  // Hide navbar on scroll-down, reveal on scroll-up
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 80) {
        // Always show near the top
        setNavVisible(true);
      } else if (currentY < lastY) {
        // Scrolling up → show
        setNavVisible(true);
      } else if (currentY > lastY + 4) {
        // Scrolling down (with small dead-zone) → hide
        setNavVisible(false);
        // Also close open menus when navbar hides
        setIsMobileMenuOpen(false);
        setIsAccountMenuOpen(false);
      }
      lastY = currentY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sync = () => setAuthed(Boolean(getToken()));
    window.addEventListener("storage", sync);
    window.addEventListener("paara-auth-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("paara-auth-change", sync);
    };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
        setIsAccountMenuOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  // Close menus on route change.
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsAccountMenuOpen(false);
  }, [location.pathname]);

  const logout = () => {
    clearToken();
    clearCart();
    setAuthed(false);
    setIsMobileMenuOpen(false);
    setIsAccountMenuOpen(false);
    window.dispatchEvent(new Event("paara-auth-change"));
    window.location.assign("/");
  };

  return (
    <>
    <header
      className={`w-full bg-sand/95 backdrop-blur-sm border-b border-cocoa/10 sticky top-0 z-50 transition-transform duration-300 ease-in-out ${
        navVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="max-w-[1600px] mx-auto flex items-center justify-between px-6 md:px-10 py-4">
        {/* Logo */}
        <Link to="/" className="flex items-center shrink-0" aria-label="Paara home">
          <img src="/assets/paara-logo.png" alt="Paara Jewellery" className="h-16 md:h-20 w-auto" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-10 text-[15px] tracking-wide text-cocoa">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} active={location.pathname === item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Icons */}
        <div className="hidden md:flex items-center gap-6 text-cocoa">
          <Link to="/wishlist" aria-label="Wishlist" className="hover:text-gold transition-colors">
            <Heart size={20} strokeWidth={1.4} />
          </Link>
          <Link to="/cart" aria-label="Cart" className="relative hover:text-gold transition-colors">
            <ShoppingBag size={20} strokeWidth={1.4} />
            {count > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-white text-[10px] leading-[18px] text-center font-medium">
                {count}
              </span>
            )}
          </Link>
          <Link
            to={authed ? "/account/orders" : "/login"}
            aria-label="Account"
            className="hover:text-gold transition-colors"
          >
            <User size={20} strokeWidth={1.4} />
          </Link>
          <button
            type="button"
            aria-label="Account menu"
            aria-haspopup="true"
            aria-expanded={isAccountMenuOpen}
            className="hover:text-gold transition-colors"
            onClick={() => setIsAccountMenuOpen(true)}
          >
            <Menu size={20} strokeWidth={1.4} />
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="md:hidden text-cocoa"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-navigation-drawer"
        >
          <Menu size={24} strokeWidth={1.4} />
        </button>
      </div>
    </header>

      {/* Mobile navigation drawer — outside header to avoid backdrop-blur interference */}
      <div
        className={`md:hidden fixed inset-0 z-[60] transition-opacity duration-300 ${isMobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden={!isMobileMenuOpen}
      >
        <button
          type="button"
          aria-label="Close menu"
          className="absolute inset-0 bg-cocoa/40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
        <nav
          id="mobile-navigation-drawer"
          className={`absolute right-0 top-0 flex h-full w-[min(22rem,85vw)] flex-col gap-1 px-6 pb-6 pt-6 text-cocoa text-[15px] shadow-2xl overflow-y-auto transition-transform duration-300 ease-out ${isMobileMenuOpen ? "translate-x-0" : "translate-x-full"}`}
          style={{ backgroundColor: "#F7F1E6" }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="font-display text-xl">Menu</span>
            <button
              type="button"
              aria-label="Close menu"
              className="hover:text-gold transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X size={24} strokeWidth={1.4} />
            </button>
          </div>

          {NAV_ITEMS.map((item) => (
            <Link key={item.to} to={item.to} className="py-2.5 border-b border-cocoa/10">
              {item.label}
            </Link>
          ))}

          <div className="flex items-center gap-6 py-4 border-b border-cocoa/10">
            <Link to="/wishlist" aria-label="Wishlist">
              <Heart size={20} strokeWidth={1.4} />
            </Link>
            <Link to="/cart" aria-label="Cart" className="relative">
              <ShoppingBag size={20} strokeWidth={1.4} />
              {count > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-white text-[10px] leading-[18px] text-center">
                  {count}
                </span>
              )}
            </Link>
            <Link to={authed ? "/account/orders" : "/login"} aria-label="Account">
              <User size={20} strokeWidth={1.4} />
            </Link>
          </div>

          <p className="pt-4 pb-1 text-[10px] uppercase tracking-[.24em] text-cocoa/50">My Account</p>
          {ACCOUNT_ITEMS.map((item) => (
            <Link key={item.to} to={item.to} className="flex items-center gap-3 py-2.5 border-b border-cocoa/10 hover:text-gold transition-colors">
              <item.icon size={17} strokeWidth={1.4} />
              {item.label}
            </Link>
          ))}
          {authed && <button type="button" onClick={logout} className="flex items-center gap-3 py-2.5 border-b border-cocoa/10 text-left hover:text-gold transition-colors"><LogOut size={17} strokeWidth={1.4} />Logout</button>}
        </nav>
      </div>

      {/* Desktop account drawer — outside header to avoid backdrop-blur interference */}
      <div
        className={`hidden md:block fixed inset-0 z-[60] transition-opacity duration-300 ${isAccountMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden={!isAccountMenuOpen}
      >
        <button
          type="button"
          aria-label="Close account menu"
          className="absolute inset-0 bg-cocoa/40"
          onClick={() => setIsAccountMenuOpen(false)}
        />
        <div
          className={`absolute right-0 top-0 flex h-full w-[22rem] flex-col px-7 pb-8 pt-7 text-cocoa shadow-2xl border-l border-cocoa/10 transition-transform duration-300 ease-out ${isAccountMenuOpen ? "translate-x-0" : "translate-x-full"}`}
          style={{ backgroundColor: "#F7F1E6" }}
        >
          <div className="flex items-center justify-between mb-8">
            <span className="font-display text-2xl">My Account</span>
            <button
              type="button"
              aria-label="Close account menu"
              className="hover:text-gold transition-colors"
              onClick={() => setIsAccountMenuOpen(false)}
            >
              <X size={22} strokeWidth={1.4} />
            </button>
          </div>

          <nav className="flex flex-col gap-1">
            {ACCOUNT_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 px-3 py-3.5 rounded-sm text-[15px] tracking-wide hover:bg-cocoa/5 hover:text-gold transition-colors"
              >
                <item.icon size={18} strokeWidth={1.4} />
                {item.label}
              </Link>
            ))}
            {authed && <button type="button" onClick={logout} className="flex items-center gap-3 px-3 py-3.5 rounded-sm text-left text-[15px] tracking-wide hover:bg-cocoa/5 hover:text-gold transition-colors"><LogOut size={18} strokeWidth={1.4} />Logout</button>}
          </nav>
        </div>
      </div>
    </>
  );
}

function NavLink({ to, active, children }) {
  return <Link to={to} className="relative hover:text-gold transition-colors">
    {children}
    {active && <svg className="absolute left-1/2 -bottom-2 h-2 w-9 -translate-x-1/2 text-gold" viewBox="0 0 36 8" fill="none" aria-hidden="true"><path d="M1 4c4-4 8-4 12 0s8 4 12 0 7-4 10 0" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" /></svg>}
  </Link>;
}
