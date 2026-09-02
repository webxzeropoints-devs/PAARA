import { useState } from "react";
import { Link } from "react-router-dom";

// Social icons as inline SVGs — avoids depending on lucide-react's export set,
// which varies by installed version and was causing build errors.
function IconBase({ size = 18, strokeWidth = 1.4, children, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

function Instagram(props) {
  return (
    <IconBase {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </IconBase>
  );
}

function Youtube(props) {
  return (
    <IconBase {...props}>
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0-.46-5.25 29 29 0 0 0-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </IconBase>
  );
}

export default function Footer() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const submitNewsletter = (event) => {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }
    setEmail("");
    setMessage("Thanks for connecting! We will get to you soon!!");
  };

  return (
    <footer className="w-full bg-shell border-t border-cocoa/10 mt-24">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 pt-16 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 md:gap-8">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <img src="/assets/paara-logo.png" alt="Paara Jewellery" className="h-9 w-auto mb-4" />
            <p className="text-sm text-cocoa/70 leading-relaxed">
              Jewellery made to be loved.<br />
              Inspired by the ocean.<br />
              Made for you.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h4 className="text-sm tracking-widest uppercase text-cocoa mb-4">Shop</h4>
            <ul className="space-y-2 text-sm text-cocoa/70">
              <li><Link to="/collections" className="hover:text-gold transition-colors">Collections</Link></li>
              <li><Link to="/shop" className="hover:text-gold transition-colors">All Products</Link></li>
              <li><Link to="/shop?filter=new" className="hover:text-gold transition-colors">New Arrivals</Link></li>
              <li><Link to="/shop?filter=best-sellers" className="hover:text-gold transition-colors">Best Sellers</Link></li>
              <li><Link to="/account/gift-cards" className="hover:text-gold transition-colors">Loyalty Card</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm tracking-widest uppercase text-cocoa mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-cocoa/70">
              <li><Link to="/our-story" className="hover:text-gold transition-colors">Our Story</Link></li>
              <li><Link to="/account/customer-care" className="hover:text-gold transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Help */}
          <div>
            <h4 className="text-sm tracking-widest uppercase text-cocoa mb-4">Help</h4>
            <ul className="space-y-2 text-sm text-cocoa/70">
              <li><Link to="/account/customer-care" className="hover:text-gold transition-colors">FAQs</Link></li>
              <li><Link to="/account/customer-care" className="hover:text-gold transition-colors">Shipping &amp; Delivery</Link></li>
              <li><Link to="/return-policy" className="hover:text-gold transition-colors">Returns &amp; Exchanges</Link></li>
              <li><Link to="/account/track-order" className="hover:text-gold transition-colors">Track Order</Link></li>
              <li><Link to="/account/customer-care" className="hover:text-gold transition-colors">Jewellery Care</Link></li>
            </ul>
          </div>

          {/* Stay connected */}
          <div className="col-span-2 md:col-span-1">
            <h4 className="text-sm tracking-widest uppercase text-cocoa mb-4">Stay Connected</h4>
            <p className="text-sm text-cocoa/70 mb-3">JOIN OUR PAARA COMMUNITY</p>
            <form
              className="flex items-center border border-cocoa/30 rounded-full overflow-hidden mb-4"
              onSubmit={submitNewsletter}
            >
              <input
                type="email"
                aria-label="Email address"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                className="flex-1 bg-transparent px-4 py-2 text-sm text-cocoa placeholder:text-cocoa/40 outline-none"
              />
              <button type="submit" className="px-4 text-gold" aria-label="Subscribe">
                🐚
              </button>
            </form>
            <div className="flex items-center gap-4 text-cocoa">
              <a href="https://www.instagram.com/paara.jewellery?igsi=MTZyZ3JrdGRldTRhag==" target="_blank" rel="noreferrer" aria-label="Instagram" className="hover:text-gold transition-colors"><Instagram size={18} strokeWidth={1.4} /></a>
            </div>
          </div>
        </div>

        <div className="border-t border-cocoa/10 mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-cocoa/60">
          <p>© 2026 Paara Jewellery. All Rights Reserved.</p>
        </div>
      </div>
      {message && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-cocoa/35 px-6" role="dialog" aria-modal="true" aria-label="Newsletter confirmation">
          <div className="w-full max-w-sm bg-shell p-7 text-center shadow-xl">
            <p className="font-display text-2xl text-cocoa">{message}</p>
            <button type="button" onClick={() => setMessage("")} className="mt-6 border border-gold px-5 py-2 text-xs uppercase tracking-widest text-cocoa">Close</button>
          </div>
        </div>
      )}
    </footer>
  );
}
