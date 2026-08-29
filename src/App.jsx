import React, { useEffect, Suspense, lazy } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import Collections from "./pages/products/Collections";
import Product from "./pages/products/Product";
import ProductDetails from "./pages/products/ProductDetails";
import Home from "./pages/home";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import ErrorBoundary from "./components/ErrorBoundary";
import ScrollReveal from "./components/ScrollReveal";

// Lazy load heavy animation components to speed up first load
const CursorRipple = lazy(() => import("./components/CursorRipple"));
const CouponPopup = lazy(() => import("./components/CouponPopup"));

import Login from "./pages/auth/login";
import Register from "./pages/auth/register";
import OTP from "./pages/auth/otp";
import ForgotPassword from "./pages/auth/forgot-password";
import Cart from "./pages/shopping/cart";
import Checkout from "./pages/shopping/checkout";
import Orders from "./pages/shopping/orders";
import Wishlist from "./pages/shopping/wishlist";
import OrderConfirmation from "./pages/shopping/order-confirmation";
import OurStory from "./pages/content/OurStory";
import Journal from "./pages/content/Journal";

import Addresses from "./pages/account/Addresses";
import GiftCards from "./pages/account/GiftCards";
import Notifications from "./pages/account/Notifications";
import CustomerCare from "./pages/account/CustomerCare";
import TrackOrder from "./pages/account/TrackOrder";

import AdminLayout from "./admin/AdminLayout";
import AdminLogin from "./admin/AdminLogin";
import AdminDashboard from "./admin/AdminDashboard";
import AdminCollectionTiles from "./admin/AdminCollectionTiles";
import AdminPaaraIRL from "./admin/AdminPaaraIRL";
import AdminWornByYou from "./admin/AdminWornByYou";
import AdminCoupons from "./admin/AdminCoupons";
import AdminGiftCardRules from "./admin/AdminGiftCardRules";
import AdminOrders from "./admin/AdminOrders";
import AdminCustomers from "./admin/AdminCustomers";
import AdminProfile from "./admin/AdminProfile";

import { CartProvider } from "./lib/cart.jsx";
import { WishlistProvider } from "./lib/wishlist.jsx";
import { AdminProvider } from "./lib/adminAuth.jsx";

// Optimize page transitions for faster perceived load
const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: "easeIn" } },
};

function AnimatedRoutes() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const routes = (
    <Routes location={location}>
      <Route path="/" element={<Home />} />
      <Route path="/collections" element={<Collections />} />
      <Route path="/shop" element={<Collections />} />
      <Route path="/products/:collectionType" element={<Product />} />
      <Route path="/product/:slug" element={<ProductDetails />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/otp" element={<OTP />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route path="/our-story" element={<OurStory />} />
      <Route path="/journal" element={<Journal />} />

      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/order-confirmation" element={<OrderConfirmation />} />

      <Route path="/account/orders" element={<Orders />} />
      <Route path="/account/addresses" element={<Addresses />} />
      <Route path="/account/gift-cards" element={<GiftCards />} />
      <Route path="/account/notifications" element={<Notifications />} />
      <Route path="/account/customer-care" element={<CustomerCare />} />
      <Route path="/account/track-order" element={<TrackOrder />} />
      <Route path="/wishlist" element={<Wishlist />} />

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="collection-tiles" element={<AdminCollectionTiles />} />
        <Route path="paara-irl" element={<AdminPaaraIRL />} />
        <Route path="worn-by-you" element={<AdminWornByYou />} />
        <Route path="coupons" element={<AdminCoupons />} />
        <Route path="gift-card-rules" element={<AdminGiftCardRules />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="profile" element={<AdminProfile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  if (location.pathname.startsWith("/product/") || location.pathname.startsWith("/admin")) {
    return routes;
  }

  return (
    <>
      <ScrollReveal routeKey={location.pathname} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={location.pathname} {...pageTransition}>
          {routes}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

function AppContent() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <>
      {!isAdmin && <Navbar />}
      {!isAdmin && (
        <Suspense fallback={null}>
          <CursorRipple />
        </Suspense>
      )}
      {!isAdmin && (
        <Suspense fallback={null}>
          <CouponPopup />
        </Suspense>
      )}
      <ErrorBoundary>
        <AnimatedRoutes />
      </ErrorBoundary>
      {!isAdmin && <Footer />}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AdminProvider>
          <CartProvider>
            <WishlistProvider>
              <AppContent />
            </WishlistProvider>
          </CartProvider>
        </AdminProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
