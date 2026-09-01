import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { useCart } from "../../lib/cart.jsx";
import {
  apiGet,
  apiPost,
  getAddresses,
  getProducts,
  getShippingCities,
  getToken,
  postAddress,
  postCreateRazorpay,
  postVerifyPayment,
  previewInvoice,
  postOrder,
  postShippingQuote,
} from "../../lib/api";
import { fadeUp } from "../../lib/motion";
import { INDIAN_STATES, STATE_CITIES } from "../../lib/locations";

const formatPrice = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;

const STEPS = ["Address", "Delivery", "Payment"];
const PAYMENT_METHODS = [
  { id: "razorpay", label: "Pay online", description: "UPI, card, net banking or wallet via Razorpay" },
  { id: "manual_upi", label: "Pay Now (Online)", description: "Use UPI QR or link, then submit your UTR for manual confirmation" },
  { id: "cod", label: "Cash on Delivery", description: "Pay in cash when your order arrives" },
];
const isCodEnabled = false;

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Razorpay), { once: true });
      existing.addEventListener("error", () => reject(new Error("Payment methods could not be loaded. Please try again.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Payment methods could not be loaded. Please try again."));
    script.onerror = () => reject(new Error("Payment methods could not be loaded. Check your connection and try again."));
    document.body.appendChild(script);
  });
}

export default function Checkout() {
  const navigate = useNavigate();
  const { items, clear } = useCart();
  const [step, setStep] = useState(0);

  // Address step
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [newAddress, setNewAddress] = useState({
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    lat: "",
    lng: "",
    is_default: false,
  });
  const [addingAddress, setAddingAddress] = useState(false);

  // Delivery step
  const [cities, setCities] = useState([]);
  const [shipping, setShipping] = useState(null);
  const [products, setProducts] = useState([]);

  // Order / payment
  const [order, setOrder] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("razorpay");
  const [manualUpi, setManualUpi] = useState({ ready: false, qr_code_url: "", deep_link: "", payee_name: "", upi_id: "", amount: 0, instructions: "" });
  const [manualUpiUtr, setManualUpiUtr] = useState("");
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [paymentMethodsError, setPaymentMethodsError] = useState("");
  const [previewingInvoice, setPreviewingInvoice] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) {
      navigate("/login", { state: { redirectTo: "/checkout" }, replace: true });
      return;
    }
    if (items.length === 0) {
      navigate("/cart", { replace: true });
      return;
    }
    getAddresses()
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.addresses || [];
        setAddresses(list);
        const def = list.find((a) => a.is_default) || list[0];
        if (def) setSelectedAddressId(def.id);
      })
      .catch(() => setAddresses([]));
    getShippingCities().catch(() => setCities([]));
    getProducts().then((data) => setProducts(Array.isArray(data) ? data : [])).catch(() => setProducts([]));
    loadRazorpay()
      .then(() => setRazorpayReady(true))
      .catch((err) => setPaymentMethodsError(err.message));
  }, [navigate, items.length]);

  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === selectedAddressId) || null,
    [addresses, selectedAddressId]
  );

  const summaryItems = useMemo(() => {
    if (Array.isArray(order?.items) && order.items.length > 0) return order.items;
    return items.map((line) => {
      const product = products.find((candidate) => String(candidate.id) === String(line.product_id));
      return {
        ...line,
        product_name: product?.name || line.name || `Product #${line.product_id}`,
        line_total: product?.price != null ? product.price * line.quantity : line.price != null ? line.price * line.quantity : null,
      };
    });
  }, [items, order?.items, products]);

  const productSubtotal = useMemo(
    () => summaryItems.reduce((sum, line) => sum + (Number(line.line_total) || 0), 0),
    [summaryItems]
  );
  const totalWeightKg = useMemo(
    () => items.reduce((sum, item) => {
      const product = products.find((candidate) => String(candidate.id) === String(item.product_id));
      return sum + (Number(product?.weight_kg) || 0.1) * item.quantity;
    }, 0),
    [items, products]
  );
  const customerTotal = order?.total_amount ?? Math.round((productSubtotal * 1.18 + (shipping?.amount || 0)) * 100) / 100;

  useEffect(() => {
    if (step !== 2 || !selectedAddress || !totalWeightKg) return undefined;
    let cancelled = false;
    postShippingQuote({
      city: selectedAddress.city,
      state: selectedAddress.state,
      payment_method: paymentMethod,
      total_weight_kg: totalWeightKg,
    }).then((quote) => {
      if (!cancelled) setShipping(quote);
    }).catch((err) => {
      if (!cancelled) setError(err?.message || "Could not calculate delivery charge.");
    });
    return () => { cancelled = true; };
  }, [paymentMethod, selectedAddress, step, totalWeightKg]);

  const openInvoicePreview = async () => {
    setPreviewingInvoice(true);
    setError("");
    try {
      setPreviewUrl(await previewInvoice(items.map(({ product_id, quantity }) => ({ product_id, quantity })), selectedAddressId, paymentMethod));
    } catch (err) {
      setError(err?.message || "Could not preview invoice");
    } finally {
      setPreviewingInvoice(false);
    }
  };

  const loadManualUpiDetails = async (orderId) => {
    if (!orderId || paymentMethod !== "manual_upi") return;
    try {
      const provider = await apiGet(`/payment/provider/manual_upi?order_id=${orderId}`);
      setManualUpi({ ready: true, qr_code_url: provider.qr_code_url || "", deep_link: provider.deep_link || "", payee_name: provider.payee_name || "Paara Jewellery", upi_id: provider.upi_id || "", amount: provider.amount || 0, instructions: provider.instructions || "" });
    } catch (err) {
      setManualUpi({ ready: false, qr_code_url: "", deep_link: "", payee_name: "", upi_id: "", amount: 0, instructions: "" });
      setError(err?.message || "Could not prepare UPI details.");
    }
  };

  // Step 1 → 2: compute shipping quote from the selected address's city.
  const goToDelivery = async () => {
    if (!selectedAddress) {
      setError("Please select or add an address to continue.");
      return;
    }
    setError("");
    try {
      const quote = await postShippingQuote({ city: selectedAddress.city, state: selectedAddress.state, payment_method: paymentMethod, total_weight_kg: totalWeightKg || 0.1 });
      setShipping(quote);
      setStep(1);
    } catch (err) {
      setError(err?.message || "Could not compute shipping");
    }
  };

  const addNewAddress = async (e) => {
    e.preventDefault();
    setError("");
    if (!newAddress.line1.trim() || !newAddress.city.trim() || !newAddress.state.trim() || !newAddress.pincode.trim()) {
      setError("Line 1, city, state and pincode are required.");
      return;
    }
    try {
      const created = await postAddress({
        line1: newAddress.line1,
        line2: newAddress.line2 || undefined,
        city: newAddress.city,
        state: newAddress.state,
        pincode: newAddress.pincode,
        lat: newAddress.lat ? Number(newAddress.lat) : undefined,
        lng: newAddress.lng ? Number(newAddress.lng) : undefined,
        is_default: !!newAddress.is_default,
      });
      if (!created?.id) throw new Error("Address was not saved. Please try again.");
      const refreshed = [...addresses, created];
      setAddresses(refreshed);
      setSelectedAddressId(created.id);
      const persisted = await getAddresses();
      setAddresses(Array.isArray(persisted) ? persisted : refreshed);
      setAddingAddress(false);
      setNewAddress({
        line1: "",
        line2: "",
        city: "",
        state: "",
        pincode: "",
        lat: "",
        lng: "",
        is_default: false,
      });
    } catch (err) {
      setError(err?.message || "Could not save address");
    }
  };

  // The payment screen creates the order. COD stops here; Razorpay continues
  // with the existing gateway and server-side signature verification flow.
  const payNow = async () => {
    if (!paymentMethod || !selectedAddressId || items.length === 0) {
      setError("Please select an address and add an item before paying.");
      return;
    }
    setPaying(true);
    setError("");
    try {
      const createdOrder = await postOrder({
        items: items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
        address_id: selectedAddressId,
        payment_method: paymentMethod,
      });
      if (!createdOrder?.order_id) throw new Error("The order could not be created. Please try again.");
      setOrder(createdOrder);
      if (paymentMethod === "cod") {
        clear();
        navigate(`/order-confirmation?order_id=${createdOrder.order_id}&payment=success`, { replace: true, state: { recentOrder: createdOrder, selectedAddress } });
        return;
      }

      if (paymentMethod === "manual_upi") {
        const provider = await apiPost("/payment/create", {
          order_id: createdOrder.order_id,
          payment_method: "manual_upi",
        });

        setManualUpi({
          ready: true,
          qr_code_url: provider.qr_code_url || "",
          deep_link: provider.deep_link || "",
          payee_name: provider.payee_name || "Paara Jewellery",
          upi_id: provider.upi_id || "",
          amount: provider.amount || 0,
          instructions: provider.instructions || "",
        });

        setOrder(createdOrder);
        setPaying(false);
        setError("");
        return;
      }

      const Razorpay = await loadRazorpay();
      const razorpayOrder = await postCreateRazorpay(createdOrder.order_id);
      const razorpayCheckout = new Razorpay({
        key: razorpayOrder.key_id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        name: "Paara.",
        description: `Order #${createdOrder.order_number || createdOrder.order_id}`,
        order_id: razorpayOrder.razorpay_order_id,
        config: {
          display: {
            blocks: {
              selected: {
                name: PAYMENT_METHODS.find((method) => method.id === paymentMethod)?.label || "Payment",
                instruments: [{ method: paymentMethod }],
              },
            },
            sequence: ["block.selected"],
            preferences: { show_default_blocks: false },
          },
        },
        theme: { color: "#B98F4E" },
        handler: async (response) => {
          try {
            await postVerifyPayment({
              paara_order_id: createdOrder.order_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            clear();
            navigate(`/order-confirmation?order_id=${createdOrder.order_id}&payment=success`, {
              replace: true,
              state: { recentOrder: createdOrder, selectedAddress },
            });
          } catch (err) {
            setError(err?.message || "Payment could not be verified. Please contact support if you were charged.");
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      razorpayCheckout.open();
    } catch (err) {
      setError(err?.message || "Could not start payment. Please try again.");
      setPaying(false);
    }
  };

  return (
    <div className="min-h-[80vh] bg-sand text-cocoa font-body">
      {previewUrl && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-cocoa/50 p-4">
          <div className="flex h-[90vh] w-full max-w-3xl flex-col bg-shell">
            <div className="flex items-center justify-between border-b border-cocoa/10 px-4 py-3">
              <span className="text-xs uppercase tracking-widest">Proforma invoice preview</span>
              <button type="button" onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(""); }} className="text-xs uppercase tracking-widest text-cocoa/60 hover:text-cocoa">Close</button>
            </div>
            <iframe title="Proforma invoice preview" src={previewUrl} className="min-h-0 flex-1" />
          </div>
        </div>
      )}
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-14">
        <motion.h1
          initial="hidden"
          animate="show"
          variants={fadeUp}
          className="font-display text-3xl md:text-4xl mb-2"
        >
          Checkout
        </motion.h1>

        {/* Stepper */}
        <ol className="flex items-center gap-4 my-8 text-xs uppercase tracking-widest text-cocoa/60">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full grid place-items-center text-[10px] ${
                  i <= step ? "bg-gold text-white" : "bg-cocoa/10 text-cocoa/60"
                }`}
              >
                {i + 1}
              </span>
              <span className={i === step ? "text-cocoa" : ""}>{s}</span>
              {i < STEPS.length - 1 && <span className="w-6 h-px bg-cocoa/20" />}
            </li>
          ))}
        </ol>

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-sm mb-6">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-[1fr_360px] gap-10">
          <main>
            {step === 0 && (
              <div>
                <h2 className="font-display text-2xl mb-4">Delivery address</h2>
                {addresses.length > 0 ? (
                  <div className="space-y-3">
                    {addresses.map((a) => (
                      <label
                        key={a.id}
                        className={`block border rounded-sm p-4 cursor-pointer transition-colors ${
                          selectedAddressId === a.id
                            ? "border-gold bg-sand"
                            : "border-cocoa/15 hover:border-cocoa/30"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            checked={selectedAddressId === a.id}
                            onChange={() => setSelectedAddressId(a.id)}
                            className="mt-1 accent-gold"
                          />
                          <div>
                            <p className="text-sm">{a.line1}</p>
                            {a.line2 && <p className="text-xs text-cocoa/60">{a.line2}</p>}
                            <p className="text-xs text-cocoa/60">
                              {a.city}, {a.state} — {a.pincode}
                            </p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-cocoa/60 mb-4">
                    No saved addresses yet — add one to continue.
                  </p>
                )}

                {!addingAddress ? (
                  <button
                    onClick={() => setAddingAddress(true)}
                    className="mt-4 text-xs uppercase tracking-widest text-gold hover:text-cocoa transition-colors"
                  >
                    + Add a new address
                  </button>
                ) : (
                  <form onSubmit={addNewAddress} className="mt-6 space-y-3 border border-cocoa/15 rounded-sm p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        required
                        placeholder="Line 1"
                        value={newAddress.line1}
                        onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })}
                        className="border-b border-cocoa/30 bg-transparent py-2 text-sm focus:border-gold outline-none col-span-2"
                      />
                      <input
                        placeholder="Line 2 (optional)"
                        value={newAddress.line2}
                        onChange={(e) => setNewAddress({ ...newAddress, line2: e.target.value })}
                        className="border-b border-cocoa/30 bg-transparent py-2 text-sm focus:border-gold outline-none col-span-2"
                      />
                      <select
                        required
                        value={newAddress.state}
                        onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value, city: "" })}
                        className="border-b border-cocoa/30 bg-transparent py-2 text-sm focus:border-gold outline-none"
                      >
                        <option value="">Select state</option>
                        {INDIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                      </select>
                      <select
                        required
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                        disabled={!newAddress.state}
                        className="border-b border-cocoa/30 bg-transparent py-2 text-sm focus:border-gold outline-none disabled:opacity-50"
                      >
                        <option value="">Select city</option>
                        {(STATE_CITIES[newAddress.state] || cities.map((city) => city.name)).map((city) => <option key={city} value={city}>{city}</option>)}
                      </select>
                      <input
                        required
                        placeholder="Pincode"
                        value={newAddress.pincode}
                        onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                        className="border-b border-cocoa/30 bg-transparent py-2 text-sm focus:border-gold outline-none"
                      />
                      <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-cocoa/70 col-span-2 mt-2">
                        <input
                          type="checkbox"
                          checked={newAddress.is_default}
                          onChange={(e) =>
                            setNewAddress({ ...newAddress, is_default: e.target.checked })
                          }
                          className="accent-gold"
                        />
                        Set as default
                      </label>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        type="submit"
                        className="bg-gold text-white px-6 py-2 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors"
                      >
                        Save address
                      </motion.button>
                      <button
                        type="button"
                        onClick={() => setAddingAddress(false)}
                        className="px-6 py-2 text-xs uppercase tracking-widest text-cocoa/60 hover:text-cocoa transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <div className="flex justify-between mt-8">
                  <Link to="/cart" className="text-xs uppercase tracking-widest text-cocoa/60 hover:text-cocoa">
                    ← Back to bag
                  </Link>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={goToDelivery}
                    disabled={!selectedAddressId}
                    className="bg-gold text-white px-8 py-3 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors disabled:opacity-60"
                  >
                    Continue
                  </motion.button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="font-display text-2xl mb-4">Delivery</h2>
                <div className="bg-sand/60 border border-cocoa/10 rounded-sm p-5">
                  <p className="text-xs uppercase tracking-widest text-cocoa/60">
                    Shipping to {selectedAddress?.city}
                  </p>
                  {!shipping && (
                    <p className="text-sm text-cocoa/60 mt-2">Calculating shipping…</p>
                  )}
                </div>

                {cities.length > 0 && (
                  <p className="text-xs text-cocoa/50 mt-3">
                    We currently ship to {cities.length} cities with flat-rate delivery.
                  </p>
                )}

                <div className="flex justify-between mt-8">
                  <button
                    onClick={() => setStep(0)}
                    className="text-xs uppercase tracking-widest text-cocoa/60 hover:text-cocoa"
                  >
                    ← Back
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setStep(2)}
                    disabled={placing || !shipping}
                    className="bg-gold text-white px-8 py-3 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors disabled:opacity-60"
                  >
                    Review & Pay
                  </motion.button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="font-display text-2xl mb-4">Payment</h2>
                <div className="mb-6">
                  <p className="mb-3 text-xs uppercase tracking-widest text-cocoa/60">Choose payment method</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {PAYMENT_METHODS.map((method) => {
                      const isDisabled = method.id === "cod" && !isCodEnabled;
                      return (
                        <label key={method.id} aria-disabled={isDisabled} className={`border rounded-sm p-4 transition-colors ${isDisabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"} ${paymentMethod === method.id && !isDisabled ? "border-gold bg-gold/10" : "border-cocoa/15 hover:border-cocoa/30"}`}>
                          <input type="radio" name="payment-method" value={method.id} checked={paymentMethod === method.id && !isDisabled} disabled={isDisabled} onChange={() => { if (!isDisabled) { setPaymentMethod(method.id); setManualUpiUtr(""); } }} className="sr-only" />
                          <span className="block text-sm font-medium">{method.label}</span>
                          <span className="mt-1 block text-xs text-cocoa/60">{isDisabled ? "Currently unavailable" : method.description}</span>
                        </label>
                      );
                    })}
                  </div>
                  {paymentMethod === "razorpay" && !razorpayReady && !paymentMethodsError && <p className="mt-3 text-xs text-cocoa/60">Loading online payment...</p>}
                  {paymentMethodsError && <p className="mt-3 text-xs text-red-700">{paymentMethodsError}</p>}
                  {paymentMethod === "manual_upi" && (
                    <div className="mt-4 border border-gold/30 bg-gold/5 p-4 rounded-sm">
                      <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-cocoa/60">Manual UPI payment</p>
                      <div className="flex items-center gap-4">
                        {manualUpi.qr_code_url && (
                          <img src={manualUpi.qr_code_url} alt="UPI QR code" className="h-28 w-28 rounded-md border border-cocoa/10 bg-white p-2" />
                        )}
                        <div className="text-sm text-cocoa/80">
                          <p className="font-medium">Pay to: {manualUpi.payee_name || "Paara Jewellery"}</p>
                          <p>UPI ID: {manualUpi.upi_id || "paara.jewellery@upi"}</p>
                          <p>Amount: ₹{Number(manualUpi.amount || customerTotal || 0).toLocaleString("en-IN")}</p>
                          <a href={manualUpi.deep_link || "upi://pay"} className="mt-2 inline-block text-xs uppercase tracking-widest text-gold">Open UPI app</a>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3 border-t border-gold/20 pt-4">
                        <label className="block text-[11px] uppercase tracking-[0.22em] text-cocoa/60">Enter your UPI transaction reference (UTR)</label>
                        <textarea
                          value={manualUpiUtr}
                          onChange={(e) => setManualUpiUtr(e.target.value)}
                          placeholder="Enter UTR / transaction reference"
                          className="w-full border border-cocoa/20 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
                          rows={2}
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const ut = (manualUpiUtr || "").trim();
                            if (!ut) {
                              setError("Please enter the UTR from your UPI payment.");
                              return;
                            }
                            try {
                              setPaying(true);
                              const createdOrder = order || (await postOrder({
                                items: items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
                                address_id: selectedAddressId,
                                payment_method: "manual_upi",
                              }));
                              const response = await apiPost("/payment/verify", {
                                paara_order_id: createdOrder.order_id,
                                payment_method: "manual_upi",
                                payment_reference: ut,
                              });
                              clear();
                              navigate(`/order-confirmation?order_id=${createdOrder.order_id}&payment=success&payment_method=manual_upi`, {
                                replace: true,
                                state: { recentOrder: createdOrder, selectedAddress },
                              });
                              return response;
                            } catch (err) {
                              setError(err?.message || "Could not submit your UPI reference. Please try again.");
                            } finally {
                              setPaying(false);
                            }
                          }}
                          disabled={paying}
                          className="bg-gold text-white px-6 py-2 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors disabled:opacity-60"
                        >
                          {paying ? "Submitting..." : "Submit UTR"}
                        </button>
                        <p className="text-[11px] text-cocoa/60 leading-relaxed">
                          Your order stays on hold until we confirm the payment. This usually takes a few hours. You will receive a confirmation email/SMS once verified.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="bg-sand/60 border border-cocoa/10 rounded-sm p-5 mb-6">
                  <p className="text-xs uppercase tracking-widest text-cocoa/60">
                    {order ? `Order #${order.order_number || order.order_id}` : "Order details will appear after submission"}
                  </p>
                  <p className="font-numeric text-2xl mt-1">{formatPrice(customerTotal)}</p>
                  <p className="text-xs text-cocoa/60 mt-1">Inclusive of all taxes</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={payNow}
                  disabled={paying || !shipping || (paymentMethod === "razorpay" && (!razorpayReady || Boolean(paymentMethodsError)))}
                  className="bg-gold text-white px-8 py-3 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors disabled:opacity-60"
                >
                  {paying ? paymentMethod === "cod" ? "Placing COD order…" : "Opening payment…" : paymentMethod === "cod" ? "Place COD order" : "Pay online"}
                </motion.button>
              </div>
            )}
          </main>

          <aside className="bg-sand/60 border border-cocoa/10 rounded-sm p-6 h-fit md:sticky md:top-24">
            <h2 className="font-display text-xl mb-4">Order Summary</h2>
            <button type="button" onClick={openInvoicePreview} disabled={previewingInvoice} className="mb-4 rounded-sm bg-gold px-6 py-3 text-xs uppercase tracking-widest text-white transition-colors hover:bg-cocoa disabled:cursor-wait disabled:opacity-60">
              {previewingInvoice ? "Generating invoice…" : "Preview invoice"}
            </button>
            {error && <p className="mb-4 text-xs text-red-700">{error}</p>}
            <ul className="text-sm divide-y divide-cocoa/10 mb-4">
              {summaryItems.map((line) => (
                <li key={line.product_id} className="py-2 flex justify-between">
                  <span className="font-product-name text-cocoa/70">
                    {line.product_name || line.name || `Product #${line.product_id}`} × {line.quantity}
                  </span>
                  <span className="font-numeric">{line.line_total != null ? formatPrice(line.line_total) : "—"}</span>
                </li>
              ))}
            </ul>

            {order ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-cocoa/70">Item Total</span>
                  <span className="font-numeric">{formatPrice(order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cocoa/70">Delivery Charge</span>
                  <span className="font-numeric">{formatPrice(order.shipping_amount)}</span>
                </div>
                <div className="flex justify-between border-t border-cocoa/15 pt-2 mt-2 font-medium">
                  <span>Total Payable</span>
                  <span className="font-numeric">{formatPrice(customerTotal)}</span>
                </div>
                <p className="text-[11px] text-cocoa/50">Inclusive of all taxes</p>
                <p className="text-[11px] text-cocoa/50 mt-3 leading-relaxed">
                  Order expires at{" "}
                  {order.expires_at
                    ? new Date(order.expires_at).toLocaleTimeString("en-IN")
                    : "—"}
                  . Pay before then to lock in this total.
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-cocoa/70">Item Total</span>
                  <span className="font-numeric">{formatPrice(productSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cocoa/70">Delivery Charge</span>
                  <span className="font-numeric">{formatPrice(shipping?.amount || 0)}</span>
                </div>
                <div className="flex justify-between border-t border-cocoa/15 pt-2 font-medium">
                  <span>Total Payable</span>
                  <span className="font-numeric">{formatPrice(customerTotal)}</span>
                </div>
                <p className="text-[11px] text-cocoa/50">Item total plus delivery charge, inclusive of all taxes.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
