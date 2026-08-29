import React, { useEffect, useState } from "react";
import { Bell, Trash2 } from "lucide-react";

import AccountPageLayout from "./AccountPageLayout";

const KEY = "paara_notifications";

const seedNotifications = () => [
  { id: "n1", title: "Welcome to Paara", body: "Thanks for joining — explore this week's exclusive drop.", read: false, date: new Date().toISOString() },
  { id: "n2", title: "Your wishlist is waiting", body: "Pieces you saved are still available.", read: false, date: new Date().toISOString() },
];

const readNotifications = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
    const seeded = seedNotifications();
    localStorage.setItem(KEY, JSON.stringify(seeded));
    return seeded;
  } catch {
    return [];
  }
};

export default function Notifications() {
  const [notifications, setNotifications] = useState(() => readNotifications());

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(notifications));
  }, [notifications]);

  const markRead = (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const remove = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => setNotifications([]);

  return (
    <AccountPageLayout title="Notifications" subtitle="Updates about your orders, drops, and account.">
      {notifications.length > 0 && (
        <div className="flex justify-end mb-4">
          <button type="button" onClick={clearAll} className="text-xs uppercase tracking-widest text-cocoa/60 hover:text-cocoa transition-colors">
            Clear all
          </button>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="bg-sand/60 border border-cocoa/10 rounded-sm p-10 text-center">
          <Bell className="mx-auto mb-3 text-cocoa/40" size={28} strokeWidth={1.2} />
          <h2 className="font-display text-2xl mb-2">You're all caught up</h2>
          <p className="text-sm text-cocoa/60">New notifications will show up here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`border rounded-sm p-4 flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                n.read ? "border-cocoa/10 bg-white/30" : "border-gold/40 bg-gold/5"
              }`}
            >
              <div className="flex items-start gap-3">
                {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-gold shrink-0" aria-hidden="true" />}
                <div>
                  <p className="font-medium text-sm">{n.title}</p>
                  <p className="text-sm text-cocoa/60 mt-0.5">{n.body}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(n.id);
                }}
                aria-label="Delete notification"
                className="text-cocoa/40 hover:text-red-600 transition-colors shrink-0"
              >
                <Trash2 size={16} strokeWidth={1.4} />
              </button>
            </div>
          ))}
        </div>
      )}
    </AccountPageLayout>
  );
}
