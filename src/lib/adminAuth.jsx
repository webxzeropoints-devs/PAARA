import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { adminRequest, apiPost } from "./api";

const ADMIN_TOKEN_KEY = "paara_admin_token";
const ADMIN_USER_KEY = "paara_admin_user";

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY) || "");
  const [admin, setAdmin] = useState(() => {
    try {
      const saved = localStorage.getItem(ADMIN_USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loginStep, setLoginStep] = useState(() => {
    const savedToken = localStorage.getItem(ADMIN_TOKEN_KEY);
    return savedToken ? "authenticated" : "credentials";
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    setToken("");
    setAdmin(null);
    setLoginStep("credentials");
    setError("");
  }, []);

  // Validate existing session once on mount if token is saved in localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (savedToken) {
      adminRequest("/admin-auth/me")
        .then((data) => {
          if (data && data.id) {
            setAdmin(data);
            localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(data));
            setLoginStep("authenticated");
          }
        })
        .catch((err) => {
          if (err && err.status === 401) {
            logout();
          }
        });
    }
  }, [logout]);

  const requestLogin = useCallback(async (email, password) => {
    setError("");
    setLoading(true);
    try {
      const res = await apiPost("/admin-auth/login", { email, password });

      if (res?.token) {
        localStorage.setItem(ADMIN_TOKEN_KEY, res.token);
        localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(res.admin));
        setToken(res.token);
        setAdmin(res.admin);
        setLoginStep("authenticated");
        return res;
      }

      return res;
    } catch (err) {
      setError(err.message || "Login failed.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (updatedData = {}) => {
    try {
      const fresh = await adminRequest("/admin-auth/me");
      if (fresh) {
        const merged = { ...fresh, ...updatedData };
        setAdmin(merged);
        localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(merged));
      }
    } catch (err) {
    }
  }, []);

  const value = {
    token,
    admin,
    loginStep,
    error,
    loading,
    requestLogin,
    logout,
    updateProfile,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return ctx;
}

