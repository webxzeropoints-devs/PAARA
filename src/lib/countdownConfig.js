// Frontend-only configuration for the "Paara's Exclusive" countdown.
// This is intentionally a static frontend constant (no backend call) so the
// countdown works reliably without depending on the API being reachable.
//
// Update NEXT_DROP_DATE whenever you want to point the countdown at a new
// release. It must be an ISO-8601 string (parsed with `new Date(...)`).
export const NEXT_DROP_DATE = "2026-12-25T00:00:00+05:30";
