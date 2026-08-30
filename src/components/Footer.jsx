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

function Facebook(props) {
  return (
    <IconBase {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </IconBase>
  );
}

function Youtube(props) {
  return (
    <IconBase {...props}>
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </IconBase>
  );
}

export default function Footer() {
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
              <li><a href="/collections" className="hover:text-gold transition-colors">Collections</a></li>
              <li><a href="/shop" className="hover:text-gold transition-colors">All Products</a></li>
              <li><a href="/shop?filter=new" className="hover:text-gold transition-colors">New Arrivals</a></li>
              <li><a href="/shop?filter=best-sellers" className="hover:text-gold transition-colors">Best Sellers</a></li>
              <li><a href="/gift-cards" className="hover:text-gold transition-colors">Loyalty Card</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm tracking-widest uppercase text-cocoa mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-cocoa/70">
              <li><a href="#our-story" className="hover:text-gold transition-colors">Our Story</a></li>
              <li><a href="/sustainability" className="hover:text-gold transition-colors">Sustainability</a></li>
              <li><a href="/contact" className="hover:text-gold transition-colors">Contact Us</a></li>
            </ul>
          </div>

          {/* Help */}
          <div>
            <h4 className="text-sm tracking-widest uppercase text-cocoa mb-4">Help</h4>
            <ul className="space-y-2 text-sm text-cocoa/70">
              <li><a href="/faqs" className="hover:text-gold transition-colors">FAQs</a></li>
              <li><a href="/shipping" className="hover:text-gold transition-colors">Shipping &amp; Delivery</a></li>
              <li><a href="/returns" className="hover:text-gold transition-colors">Returns &amp; Exchanges</a></li>
              <li><a href="/track-order" className="hover:text-gold transition-colors">Track Order</a></li>
              <li><a href="/jewellery-care" className="hover:text-gold transition-colors">Jewellery Care</a></li>
            </ul>
          </div>

          {/* Stay connected */}
          <div className="col-span-2 md:col-span-1">
            <h4 className="text-sm tracking-widest uppercase text-cocoa mb-4">Stay Connected</h4>
            <p className="text-sm text-cocoa/70 mb-3">Join our ocean of love.</p>
            <form
              className="flex items-center border border-cocoa/30 rounded-full overflow-hidden mb-4"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 bg-transparent px-4 py-2 text-sm text-cocoa placeholder:text-cocoa/40 outline-none"
              />
              <button type="submit" className="px-4 text-gold" aria-label="Subscribe">
                🐚
              </button>
            </form>
            <div className="flex items-center gap-4 text-cocoa">
              <a href="#" aria-label="Instagram" className="hover:text-gold transition-colors"><Instagram size={18} strokeWidth={1.4} /></a>
              <a href="#" aria-label="Facebook" className="hover:text-gold transition-colors"><Facebook size={18} strokeWidth={1.4} /></a>
              <a href="#" aria-label="YouTube" className="hover:text-gold transition-colors"><Youtube size={18} strokeWidth={1.4} /></a>
            </div>
          </div>
        </div>

        <div className="border-t border-cocoa/10 mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-cocoa/60">
          <p>© 2026 Paara Jewellery. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}
