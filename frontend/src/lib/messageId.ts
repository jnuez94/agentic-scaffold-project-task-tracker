/**
 * Message identifiers for operator-composed broadcasts.
 *
 * The CLI requires the caller to supply `--id`, and ids are operator-visible,
 * so they need to be readable as well as unique. A timestamp alone collides
 * when two broadcasts are sent inside the same second, so a short random
 * suffix is appended.
 *
 * The result must satisfy the contract's identifier grammar: a leading letter
 * or digit, then letters, digits, and `.`, `_`, `:`, `@`, `+`, `-`.
 */

const SUFFIX_LENGTH = 4;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function randomSuffix(
  length: number = SUFFIX_LENGTH,
  random: () => number = Math.random,
): string {
  let suffix = "";
  for (let index = 0; index < length; index += 1) {
    suffix += ALPHABET[Math.floor(random() * ALPHABET.length)] ?? "0";
  }
  return suffix;
}

export function newBroadcastId(
  now: Date = new Date(),
  random: () => number = Math.random,
): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `bcast-${stamp}-${randomSuffix(SUFFIX_LENGTH, random)}`;
}
