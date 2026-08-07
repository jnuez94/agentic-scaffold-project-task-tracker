/**
 * Reading an artifact's `uri` for what it actually is (UI-57).
 *
 * The field is documented as a URI and is frequently not one. On this board 3
 * of 15 artifacts hold several comma-separated repository paths, so anything
 * treating the value as a single path is wrong for a fifth of the records — it
 * renders one run-on string that is neither readable nor copyable.
 *
 * The console resolves nothing. It cannot say whether a path exists, and 4 of
 * 15 already dangle, one because a docs/ reorganisation moved its target. So
 * the rule this module exists to serve is: show the paths as the list they
 * sometimes are, and never imply the console checked them.
 */

/** The separator the CLI's own records use between paths. */
const SEPARATOR = ",";

/**
 * The paths in a `uri` field, in recorded order.
 *
 * Deliberately not deduplicated and not sorted: this is a record of what
 * someone wrote, and reordering it would make the console disagree with the
 * CLI about the field's contents.
 */
export function splitPaths(uri: unknown): string[] {
  if (typeof uri !== "string") return [];
  return uri
    .split(SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** True when the field holds more than one path, which changes how it reads. */
export function isMultiPath(uri: unknown): boolean {
  return splitPaths(uri).length > 1;
}

/**
 * Michael's wording, used verbatim (UI-57 next_steps).
 *
 * One sentence, stated once per field rather than once per path: repeating it
 * beside every line would make the caveat louder than the paths it qualifies.
 */
export const NOT_VERIFIED = "Recorded path. The console does not check whether it exists.";

/** Plural form for the same statement, when the field holds a list. */
export const NOT_VERIFIED_MANY =
  "Recorded paths. The console does not check whether they exist.";

export function notVerifiedNote(uri: unknown): string {
  return isMultiPath(uri) ? NOT_VERIFIED_MANY : NOT_VERIFIED;
}

/**
 * The table cell form: the first path, and how many more there are.
 *
 * Not one-per-line here. UI-44 established that a multi-line cell drives row
 * height and costs the whole table more than the detail is worth; the paths
 * are read and copied in the inspector, and the column only has to be honest
 * that the field holds several.
 */
export function pathSummary(uri: unknown): { first: string; extra: number } {
  const paths = splitPaths(uri);
  return { first: paths[0] ?? "", extra: Math.max(0, paths.length - 1) };
}
