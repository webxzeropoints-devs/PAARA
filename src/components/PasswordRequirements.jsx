import React from "react";

import { passwordRequirements } from "../lib/validation";

export default function PasswordRequirements({ password }) {
  return (
    <ul aria-label="Password requirements" className="mt-2 space-y-1 text-xs">
      {passwordRequirements.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.id} className={met ? "text-emerald-700" : "text-cocoa/55"}>
            <span aria-hidden="true" className="inline-block w-4 font-medium">{met ? "✓" : "○"}</span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
