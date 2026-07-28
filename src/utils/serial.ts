// Serial-number normalization + validation shared across data entry surfaces.
// Keeps the DB free of variants like "  sn-001 ", "sn_001", "SN 001" that
// otherwise look distinct and break lookups / duplicate checks.

const SERIAL_MAX = 64;

/** Normalize a raw serial: trim, drop internal whitespace, upper-case,
 *  strip characters outside [A-Z0-9-_./]. Returns '' for nullish/empty. */
export const normalizeSerial = (raw: unknown): string => {
  if (raw == null) return "";
  return String(raw)
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\-_./]/g, "")
    .slice(0, SERIAL_MAX);
};

export type SerialValidation = { ok: boolean; value: string; error?: string };

/** Validate a serial. Empty is allowed (treated as "not entered") unless
 *  `required` is true. Otherwise any non-empty value up to 64 chars is accepted,
 *  which allows manual entry of shorter serials such as "A1" or "SN1". */
export const validateSerial = (
  raw: unknown,
  opts: { required?: boolean } = {},
): SerialValidation => {
  const value = normalizeSerial(raw);
  if (!value) {
    return opts.required
      ? { ok: false, value, error: "Serial required" }
      : { ok: true, value };
  }
  if (value.length > SERIAL_MAX)
    return { ok: false, value, error: `Serial too long (max ${SERIAL_MAX})` };
  return { ok: true, value };
};

/** Keys we treat as serial-number columns for auto-normalization. */
export const SERIAL_KEYS = new Set([
  "serial_number",
  "psu_serial_number",
  "hash_board_serial_number",
]);

export const isSerialKey = (key: string) => SERIAL_KEYS.has(key);
