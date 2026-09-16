/**
 * The Messages presentation preference.
 *
 * Local-only (UI-11 criterion 2): it is a display choice, not coordination
 * state, so it never touches the database. Anything unrecognised in storage
 * falls back to the default rather than throwing.
 */

import type { StorageLike } from "./identityStore.ts";

export const MESSAGE_VIEWS = ["inbox", "conversation", "ledger"] as const;
export type MessageView = (typeof MESSAGE_VIEWS)[number];

/**
 * Inbox first (UI-68): the question an operator opens Messages with is what
 * is addressed to them. Without an actor there is no inbox, and the view
 * falls back to the transcript — see `resolveMessageView`.
 */
export const DEFAULT_MESSAGE_VIEW: MessageView = "inbox";

/** The view that can actually be shown: an inbox needs an owner. */
export function resolveMessageView(view: MessageView, hasActor: boolean): MessageView {
  return view === "inbox" && !hasActor ? "conversation" : view;
}

const STORAGE_KEY = "coordination-console.messageView";

export function isMessageView(value: unknown): value is MessageView {
  return typeof value === "string" && (MESSAGE_VIEWS as readonly string[]).includes(value);
}

export class ViewPreferenceStore {
  constructor(private readonly storage: StorageLike | null) {}

  load(): MessageView {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      return isMessageView(raw) ? raw : DEFAULT_MESSAGE_VIEW;
    } catch {
      return DEFAULT_MESSAGE_VIEW;
    }
  }

  save(view: MessageView): void {
    try {
      if (isMessageView(view)) this.storage?.setItem(STORAGE_KEY, view);
    } catch {
      // A private-browsing quota failure must not break switching views.
    }
  }
}

export function browserViewPreferenceStore(): ViewPreferenceStore {
  try {
    return new ViewPreferenceStore(globalThis.localStorage ?? null);
  } catch {
    return new ViewPreferenceStore(null);
  }
}
