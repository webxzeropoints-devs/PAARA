import React, { useState } from "react";
import { ChevronDown, Mail, MessageCircle, Phone } from "lucide-react";
import { Link } from "react-router-dom";

import AccountPageLayout from "./AccountPageLayout";
import Seo from "../../components/Seo";

const PAARA_CONTACT_NUMBER = "+91 95142 93949";
const PAARA_CONTACT_TEL = "tel:+919514293949";

const FAQS = [
  { q: "How do I track my order?", a: "Go to Account → Track Order and enter your order number to see its current status." },
  { q: "What is your return policy?", a: "Unworn pieces in original packaging can be returned within 7 days of delivery." },
  { q: "How do I exchange a piece?", a: "Contact support with your order number and we'll arrange an exchange for a different size or design." },
  { q: "Do you offer gift wrapping?", a: "Yes — every Paara order ships in our signature packaging at no extra cost." },
  { q: "How do I use a loyalty card?", a: "Visit Account → Loyalty Card to check your balance and redeem a code at checkout." },
];

export default function CustomerCare() {
  const [openIndex, setOpenIndex] = useState(0);
  const [sent, setSent] = useState(false);

  const onSubmit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <AccountPageLayout title="Customer Care" subtitle="We're here to help with orders, returns, and everything in between.">
      <Seo title="Customer Care" description="Contact Paara Jewellery for order support, returns and customer care." />
      <div className="grid md:grid-cols-3 gap-4 mb-12">
        <ContactCard icon={<Mail size={18} strokeWidth={1.4} />} label="Email us" value="support@paarajewellery.in" />
        <ContactCard icon={<Phone size={18} strokeWidth={1.4} />} label="Call us" value={PAARA_CONTACT_NUMBER} href={PAARA_CONTACT_TEL} />
        <ContactCard icon={<MessageCircle size={18} strokeWidth={1.4} />} label="Live chat" value="Mon–Sat, 10am–7pm" />
      </div>

      <div className="grid md:grid-cols-2 gap-10">
        <div>
          <h2 className="font-display text-2xl mb-4">Frequently asked questions</h2>
          <div className="space-y-2">
            {FAQS.map((faq, index) => (
              <div key={faq.q} className="border border-cocoa/10 rounded-sm">
                <button
                  type="button"
                  onClick={() => setOpenIndex(openIndex === index ? -1 : index)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-sm"
                >
                  {faq.q}
                  <ChevronDown
                    size={16}
                    className={`shrink-0 transition-transform ${openIndex === index ? "rotate-180" : ""}`}
                  />
                </button>
                {openIndex === index && <p className="px-4 pb-4 text-sm text-cocoa/60">{faq.a}</p>}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-xs uppercase tracking-widest">
            <Link to="/account/orders" className="text-gold hover:text-cocoa transition-colors">Order help →</Link>
            <Link to="/return-policy" className="text-gold hover:text-cocoa transition-colors">Return / exchange →</Link>
          </div>
        </div>

        <div>
          <h2 className="font-display text-2xl mb-4">Contact support</h2>
          {sent ? (
            <div className="border border-cocoa/10 rounded-sm p-6 bg-white/50">
              <p className="text-sm">Thanks — our team will get back to you shortly.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4 border border-cocoa/10 rounded-sm p-6 bg-white/50">
              <div>
                <label className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">Order number (optional)</label>
                <input className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-cocoa/60 mb-1.5">Message</label>
                <textarea required rows={4} className="w-full bg-transparent border-b border-cocoa/30 focus:border-gold outline-none py-2 text-sm transition-colors resize-none" />
              </div>
              <button type="submit" className="bg-gold text-white px-6 py-2.5 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors">
                Send message
              </button>
            </form>
          )}
        </div>
      </div>
    </AccountPageLayout>
  );
}

function ContactCard({ icon, label, value, href }) {
  return (
    <div className="border border-cocoa/10 rounded-sm p-5 flex items-center gap-3 bg-white/40">
      <span className="text-gold shrink-0">{icon}</span>
      <div>
        <p className="text-xs uppercase tracking-widest text-cocoa/60">{label}</p>
        <p className="text-sm mt-0.5">
          {href ? <a href={href} className="hover:text-gold transition-colors">{value}</a> : label === "Email us" ? <a href={`mailto:${value}`} className="hover:text-gold transition-colors">{value}</a> : value}
        </p>
      </div>
    </div>
  );
}
