/**
 * Lint configuration.
 *
 * The codebase carried two `eslint-disable react-hooks/exhaustive-deps`
 * directives for a linter that was never installed, so those dependency arrays
 * had never actually been checked and the suppressions were inherited belief
 * rather than a decision. That is the gap this closes.
 *
 * Type-aware rules are on. Without the type checker, the rules that matter most
 * here — unhandled promises, unsafe narrowing around `unknown` in the error
 * paths — cannot be expressed at all, and those are exactly the paths this
 * console gets wrong when it gets anything wrong.
 */

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "../coordination_ui/static/**"] },

  js.configs.recommended,

  // Type-aware rules apply to source only. The config file and any plain JS are
  // outside the TypeScript project, and pointing type-checked rules at files
  // the compiler does not know about fails at load rather than at lint time.
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { window: "readonly", document: "readonly", globalThis: "readonly" },
    },
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,

      // A floating promise in a mutation handler means a write whose failure
      // nobody sees. This console's whole contract is that a refusal reaches
      // the operator, so this is a correctness rule here, not hygiene.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",

      // The API boundary genuinely produces `unknown`, and the codebase already
      // narrows it deliberately. Flagging every such site would train people to
      // ignore the linter, so these report rather than block.
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",

      // `as never` is used deliberately in the heterogeneous column registry.
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",

      // Three roles in this console are legitimately focusable, and the default
      // rule does not model any of them:
      //   separator — focusable only as a window splitter, which is exactly what
      //     ResizeHandle is; it carries aria-valuenow/min/max accordingly.
      //   region, tabpanel — scrollable panes must be reachable by keyboard or
      //     their content cannot be scrolled without a mouse (WCAG 2.1.1), and
      //     both carry an accessible name.
      // Declared once, with the reason, rather than as disables at each site.
      "jsx-a11y/no-noninteractive-tabindex": [
        "error",
        { tags: [], roles: ["separator", "region", "tabpanel"], allowExpressionValues: true },
      ],
      "jsx-a11y/no-noninteractive-element-interactions": [
        "error",
        { handlers: ["onClick", "onKeyDown", "onKeyUp", "onKeyPress"] },
      ],
    },
  },

  {
    // Tests reach into internals and stub globals on purpose.
    files: ["src/**/*.test.{ts,tsx}", "src/test/**"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/unbound-method": "off",
      // A stubbed fetch is `async` to match the real signature and has nothing
      // to await; requiring one would mean adding a fake await to satisfy a rule.
      "@typescript-eslint/require-await": "off",
      // Tests throw response-shaped literals to drive error paths, which is the
      // shape the code under test actually receives from the wire.
      "@typescript-eslint/only-throw-error": "off",
      // `String(url)` where url is RequestInfo | URL: always a string in tests.
      "@typescript-eslint/no-base-to-string": "off",
    },
  },
);
