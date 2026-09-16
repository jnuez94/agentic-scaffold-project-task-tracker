/**
 * A tab list with the keyboard behaviour tabs owe: arrows move between them,
 * the active tab alone is in the Tab order, and each tab names its panel.
 *
 * The task inspector grew its own copy of this; the record inspector needs
 * the same thing for its Activity tab (UI-69), and two copies of a keyboard
 * contract drift.
 */

import type { KeyboardEvent } from "react";

export interface TabSpec<T extends string> {
  id: T;
  label: string;
  count?: number;
}

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  label,
  idPrefix,
}: {
  tabs: readonly TabSpec<T>[];
  active: T;
  onChange: (tab: T) => void;
  /** Accessible name for the tab list. */
  label: string;
  /** Distinguishes tab and panel ids when two tab lists share a document. */
  idPrefix: string;
}) {
  const move = (event: KeyboardEvent, current: T) => {
    const index = tabs.findIndex((tab) => tab.id === current);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onChange(tabs[(index + 1) % tabs.length]!.id);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      onChange(tabs[(index - 1 + tabs.length) % tabs.length]!.id);
    }
  };

  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          id={`${idPrefix}-tab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls={`${idPrefix}-panel-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          className={active === tab.id ? "tab active" : "tab"}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => move(event, tab.id)}
        >
          {tab.label}
          {tab.count !== undefined ? <span className="tab-count">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
