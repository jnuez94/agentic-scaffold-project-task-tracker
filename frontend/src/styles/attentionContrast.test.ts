/**
 * The attention row's contrast, measured from the tokens themselves (UI-45).
 *
 * Michael returned this task because Blueprint measured 4.39:1 for quiet
 * metadata on a marked row — below AA — and because the wash barely moved a
 * light surface. Both defects lived in themes that were never checked, and
 * neither was visible in the theme the work was done in.
 *
 * His instruction was to re-measure all three on any change rather than assume,
 * because the two criteria pull in opposite directions: a heavier wash makes
 * the row read better and pushes the text closer to failing. A comment saying
 * that is advice. This is the part that fails the build.
 *
 * Values are parsed from the real stylesheets, so editing a token without
 * re-measuring is what breaks the test.
 */

import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { describe, expect, it } from "vitest";

// Resolved from the project root rather than import.meta.url: under jsdom that
// is not a file: URL, so readFileSync rejects it.
const read = (name: string) =>
  readFileSync(resolvePath(process.cwd(), "src/styles", name), "utf8");

const tokens = read("tokens.css");
const themes = read("themes.css");

type Rgb = [number, number, number];

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function hex(value: string): Rgb {
  const v = value.replace("#", "").trim();
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as Rgb;
}

/** Flatten `rgba(r, g, b, a)` onto an opaque backdrop. */
function over(wash: string, backdrop: Rgb): Rgb {
  const parts = wash.match(/[\d.]+/g)?.map(Number) ?? [];
  const [r, g, b, alpha = 1] = parts as [number, number, number, number];
  return [r, g, b].map((c, i) => alpha * c + (1 - alpha) * backdrop[i]!) as Rgb;
}

/** Read a custom property from a block, so themes override the root. */
function token(name: string, block: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match?.[1]) throw new Error(`token --${name} not found`);
  return match[1].trim();
}

function themeBlock(name: string): string {
  const start = themes.indexOf(`:root[data-theme="${name}"]`);
  if (start < 0) throw new Error(`theme ${name} not found`);
  return themes.slice(start, themes.indexOf("\n}", start));
}

interface Resolved {
  surface: Rgb;
  quietText: Rgb;
  wash: string;
}

function resolve(theme: "flowline" | "paper" | "blueprint"): Resolved {
  const root = tokens.slice(tokens.indexOf(":root"));
  const block = theme === "flowline" ? root : themeBlock(theme);
  const pick = (name: string) => {
    try {
      return token(name, block);
    } catch {
      return token(name, root);
    }
  };
  return {
    surface: hex(pick("surface-900")),
    quietText: hex(pick("text-400")),
    wash: pick("attention-wash"),
  };
}

const THEMES = ["flowline", "paper", "blueprint"] as const;

describe("attention row contrast", () => {
  it.each(THEMES)("keeps quiet metadata at AA on a marked row in %s", (theme) => {
    const { surface, quietText, wash } = resolve(theme);
    const marked = over(wash, surface);
    expect(contrast(quietText, marked)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)("does not make an unmarked row worse in %s", (theme) => {
    const { surface, quietText, wash } = resolve(theme);
    const marked = over(wash, surface);
    // The wash may only cost contrast, never silently gain it by inverting.
    expect(contrast(quietText, surface)).toBeGreaterThanOrEqual(contrast(quietText, marked));
  });

  it("holds Blueprint above the value that failed review", () => {
    // The returned defect measured 4.39:1 here.
    const { surface, quietText, wash } = resolve("blueprint");
    expect(contrast(quietText, over(wash, surface))).toBeGreaterThan(4.5);
  });

  it("keeps the dark themes' rows readable as tone, not only as hue", () => {
    // Michael's greyscale criterion. Achievable on a dark surface, where a
    // wash multiplies a near-zero luminance; see the Paper case below.
    for (const theme of ["flowline", "blueprint"] as const) {
      const { surface, wash } = resolve(theme);
      const marked = over(wash, surface);
      const ratio = luminance(marked) / luminance(surface);
      expect(ratio).toBeGreaterThan(2.5);
    }
  });

  it("documents that Paper cannot carry the cue in its wash", () => {
    // Not a wish: on a near-white surface a wash can only subtract luminance,
    // and matching the dark themes' separation needs ~0.70 alpha, which drops
    // quiet text to 1.94:1. The leading rule is the cue in this theme, which
    // is why it is 5px and darkened here rather than inheriting.
    const { surface, wash } = resolve("paper");
    const ratio = luminance(over(wash, surface)) / luminance(surface);
    expect(ratio).toBeLessThan(1.5);
  });

  it("gives Paper a leading rule strong enough to be that cue", () => {
    const { surface, wash } = resolve("paper");
    const rule = hex(token("attention-rule", themeBlock("paper")));
    // 3:1 is the WCAG AA threshold for a non-text graphic.
    expect(contrast(rule, over(wash, surface))).toBeGreaterThanOrEqual(3);
  });
});
