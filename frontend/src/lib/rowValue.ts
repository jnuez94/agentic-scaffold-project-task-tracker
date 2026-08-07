/**
 * Reading values out of a heterogeneous record row.
 *
 * The record registry is deliberately untyped per entity: one table renders
 * seven different shapes, so a column receives `Record<string, unknown>` and the
 * compiler cannot tell it which entity it holds. That is a reasonable trade, but
 * it means every read is a coercion, and `String(value)` on an object silently
 * renders `[object Object]` into the UI rather than failing.
 *
 * These are the safe readers. `list` already existed inline in recordConfigs for
 * arrays; `text` is its missing counterpart, added after the linter found four
 * sites — two of them in the record inspector's heading and title — where an
 * object value would have been shown to the operator as `[object Object]`.
 */

/**
 * A value as display text, or the fallback when it is not text-like.
 *
 * Numbers and booleans stringify meaningfully and are allowed through. Objects,
 * arrays and functions do not, so they yield the fallback: showing nothing is
 * honest, while showing `[object Object]` looks like data.
 */
export function text(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "bigint") return value.toString();
  return fallback;
}

/**
 * A value as a list of strings, or empty when it is not a list.
 *
 * The casts in the registry describe the entity a column *belongs* to, and the
 * compiler cannot check that the row it receives is that entity. When the two
 * disagreed — Decision rows reaching the Artifacts columns during a route
 * change — a bare `(row[key] as string[]).join()` threw and took the whole
 * console down with it.
 */
export function list(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => text(entry)).filter((entry) => entry !== "");
}
