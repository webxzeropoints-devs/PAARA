// API client for the Paara backend (AI_BUILD_BRIEF §3).
// Defaults to the colocated backend in development; production can override it
// with VITE_API_URL (for example, https://api.example.com/api).

const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/$/, "");
const TOKEN_KEY = "paara_token";

const ADMIN_TOKEN_KEY = "paara_admin_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const getAdminToken = () => localStorage.getItem(ADMIN_TOKEN_KEY);
export const setAdminToken = (token) => localStorage.setItem(ADMIN_TOKEN_KEY, token);
export const clearAdminToken = () => localStorage.removeItem(ADMIN_TOKEN_KEY);

const buildHeaders = (extra = {}, useAdminToken = false) => {
  const headers = { "Content-Type": "application/json", ...extra };
  const token = useAdminToken ? getAdminToken() : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const isFormData = (value) => typeof FormData !== "undefined" && value instanceof FormData;

const prepareRequestBody = (body, headers) => {
  if (body === undefined) return { body: undefined, headers };

  if (isFormData(body)) {
    const nextHeaders = { ...headers };
    delete nextHeaders["Content-Type"];
    return { body, headers: nextHeaders };
  }

  return {
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers,
  };
};

const handle = async (res) => {
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = data?.error || data?.message || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
};

// Catch network-level failures (backend down, CORS, DNS) so a missing
// backend never crashes the page — log a warning and let the caller
// fall back to its empty/error UI.
const wrapFetch = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (err) {
    if (err && err instanceof TypeError) {
      console.warn(
        `[paara] backend unreachable at ${BASE_URL} — ${err.message || "network error"}`
      );
      const wrapped = new Error(
        "Backend is unreachable. Please try again later."
      );
      wrapped.cause = err;
      wrapped.network = true;
      throw wrapped;
    }
    throw err;
  }
};

export const apiGet = wrapFetch((path) =>
  fetch(`${BASE_URL}${path}`, { headers: buildHeaders() }).then(handle)
);

export const apiPost = wrapFetch((path, body) => {
  const headers = buildHeaders();
  const payload = prepareRequestBody(body, headers);
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: payload.headers,
    body: payload.body,
  }).then(handle);
});

export const apiPut = wrapFetch((path, body) => {
  const headers = buildHeaders();
  const payload = prepareRequestBody(body, headers);
  return fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: payload.headers,
    body: payload.body,
  }).then(handle);
});

export const apiDelete = wrapFetch((path) =>
  fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: buildHeaders(),
  }).then(handle)
);

export const adminRequest = wrapFetch((path, options = {}) => {
  const { method = "GET", body, headers: extraHeaders = {} } = options;
  const headers = buildHeaders(extraHeaders, true);
  const payload = prepareRequestBody(body, headers);
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers: payload.headers,
    body: payload.body,
  }).then(handle);
});

// Admin helpers
export const adminListProducts = () => adminRequest("/admin/products");
export const adminListCategories = () => adminRequest("/admin/categories");
export const adminCreateProduct = (payload) => adminRequest("/admin/products", { method: "POST", body: payload });
export const adminUpdateProduct = (id, payload) => adminRequest(`/admin/products/${id}`, { method: "PUT", body: payload });
export const adminDeleteProduct = (id) => adminRequest(`/admin/products/${id}`, { method: "DELETE" });
export const adminDeleteCustomer = (id) => adminRequest(`/admin/customers/${id}`, { method: "DELETE" });
export const adminSetVault = (product_ids) => adminRequest("/admin/vault", { method: "POST", body: { product_ids } });
export const adminListCoupons = () => adminRequest("/admin/coupons");
export const adminCreateCoupon = (payload) => adminRequest("/admin/coupons", { method: "POST", body: payload });
export const adminUpdateCoupon = (id, payload) => adminRequest(`/admin/coupons/${id}`, { method: "PUT", body: payload });
export const adminDeleteCoupon = (id) => adminRequest(`/admin/coupons/${id}`, { method: "DELETE" });
export const adminChangeProfilePicture = (image_url) => adminRequest("/admin-auth/profile-picture", { method: "PUT", body: { image_url } });
export const adminChangeEmail = (newEmail, currentPassword) => adminRequest("/admin-auth/change-email", { method: "PUT", body: { newEmail, currentPassword } });
export const adminChangePassword = (currentPassword, newPassword) => adminRequest("/admin-auth/change-password", { method: "PUT", body: { currentPassword, newPassword } });

// Convenience helpers that match §3's exact endpoint shapes.
export const authLogin = (email, password) => apiPost("/auth/login", { email, password });
export const authRegister = (payload) => apiPost("/auth/register", payload);

export const getProducts = (params = {}) => {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null)
  ).toString();
  return apiGet(`/products${qs ? `?${qs}` : ""}`);
};
export const getProductBySlug = (slug) => apiGet(`/products/${slug}`);

export const getVaultToday = () => apiGet("/vault/today");
export const getVaultArchive = () => apiGet("/vault/archive");
export const getVaultNext = () => apiGet("/vault/next");

export const getShippingCities = () => apiGet("/shipping/cities");
export const postShippingQuote = (payload) => apiPost("/shipping/quote", payload);

export const getAddresses = () => apiGet("/addresses");
export const postAddress = (payload) => apiPost("/addresses", payload);

export const postOrder = (payload) => apiPost("/orders", payload);
export const previewInvoice = async (items, addressId, paymentMethod = "razorpay") => {
  const res = await fetch(`${BASE_URL}/orders/proforma`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ items, address_id: addressId, payment_method: paymentMethod }),
  });
  if (!res.ok) {
    const text = await res.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
    throw new Error(payload?.error || `Could not preview invoice (HTTP ${res.status}).`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/pdf")) {
    throw new Error("Invoice preview returned an invalid file.");
  }
  const blob = await res.blob();
  if (!blob.size) throw new Error("Invoice preview was empty.");
  const url = URL.createObjectURL(blob);
  return url;
};
export const getOrders = () => apiGet("/orders");
export const getOrderById = (id) => apiGet(`/orders/${id}`);
export const getOrderStatus = (orderId, email) => apiGet(`/orders/${orderId}/status?email=${encodeURIComponent(email)}`);
export const updateOrderStatus = (orderId, status) => adminRequest(`/admin/orders/${orderId}/status`, { method: "PATCH", body: { status } });

export const postCreateRazorpay = (order_id) =>
  apiPost("/payment/create-razorpay-order", { order_id });
export const postVerifyPayment = (payload) => apiPost("/payment/verify", payload);
export const validateCoupon = (code, subtotal) => apiPost("/coupons/validate", { code, subtotal });
export const downloadInvoice = async (orderId) => {
  const res = await fetch(`${BASE_URL}/orders/${orderId}/invoice`, {
    headers: buildHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    const payload = text ? JSON.parse(text) : {};
    throw new Error(payload?.error || "Could not download invoice.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `paara-invoice-${orderId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};

export default {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  adminRequest,
  adminListProducts,
  adminListCategories,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminDeleteCustomer,
  adminSetVault,
  adminListCoupons,
  adminCreateCoupon,
  adminUpdateCoupon,
  adminDeleteCoupon,
  adminChangeProfilePicture,
  adminChangeEmail,
  adminChangePassword,
  getToken,
  setToken,
  clearToken,
  getAdminToken,
  setAdminToken,
  clearAdminToken,
};
