const TZ = "America/Los_Angeles";

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(iso));
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" })
    .format(new Date(iso));
}

export function fmtTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" })
    .format(new Date(iso));
}

export function durationLabel(startIso: string, endIso: string) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const m = Math.max(1, Math.round(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

export const COUNTIES = ["Kern County", "San Diego County", "San Bernardino County", "Riverside County"] as const;
export type County = (typeof COUNTIES)[number];

export function shortCounty(c: string | null | undefined) {
  return (c ?? "").replace(/ County$/, "");
}

/** Map an outcome/note to a chip class + label. */
export function outcomeChip(outcome: string | null, note?: string | null) {
  const o = (outcome ?? "").toLowerCase();
  const n = (note ?? "").toLowerCase();
  if (n.includes("needs review") || o.includes("needs review")) return { cls: "chip-review", label: "Needs review" };
  if (o.startsWith("new foreclosure")) return { cls: "chip-new", label: "New foreclosure" };
  if (o.startsWith("joined")) return { cls: "chip-joined", label: "Joined to existing" };
  if (o.startsWith("cancellation")) return { cls: "chip-cancel", label: "Cancellation" };
  if (o.includes("violation") || o.includes("expunge")) return { cls: "chip-cv", label: "Code violation" };
  if (o === "received") return { cls: "chip-received", label: "Received" };
  if (!o) return { cls: "chip-skipped", label: "Skipped" };
  return { cls: "chip-received", label: outcome ?? "" };
}

export function docStatus(d: { last_outcome: string | null; needs_review: boolean; skipped: boolean }) {
  if (d.needs_review) return { cls: "chip-review", label: "Needs review" };
  if (d.skipped) return { cls: "chip-skipped", label: "Skipped" };
  return outcomeChip(d.last_outcome);
}

export function cleanAddress(a: string | null | undefined) {
  const s = (a ?? "").trim().replace(/^,\s*/, "").replace(/,\s*$/, "");
  return s || "";
}
