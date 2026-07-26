/**
 * The Messages screen: the record list and the read-only message inspector.
 *
 * The broadcast trigger deliberately does not live here. It moved to the
 * persistent toolbar in UI-12 so an operator can interject from any route, and
 * keeping a copy here would give one action two entry points.
 */

import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Message } from "../api/contract.ts";
import { ResizeHandle } from "../components/ResizeHandle.tsx";
import { BOUNDS } from "../state/layoutStore.ts";
import type { Layout } from "../state/useLayout.ts";
import { MessageInspector } from "./MessageInspector.tsx";
import { RecordsView } from "./RecordsView.tsx";

export function MessagesView({
  filter,
  layout,
  reloadKey,
}: {
  filter: string;
  layout: Layout;
  /** Bumped by the global launcher after a successful broadcast. */
  reloadKey: number;
}) {
  const [selected, setSelected] = useState<Message | null>(null);
  // Restores focus to the row that opened the inspector.
  const lastRow = useRef<HTMLElement | null>(null);

  return (
    <div className="messages-screen">
      <div
        className={selected ? "messages-layout with-inspector" : "messages-layout"}
        style={
          { "--message-inspector-width": `${layout.widths.messageInspector}px` } as CSSProperties
        }
      >
        <div className="messages-main">
          <RecordsView<Message>
            route="messages"
            filter={filter}
            reloadKey={reloadKey}
            selectedKey={selected?.id ?? null}
            onSelect={(row) => {
              lastRow.current = document.activeElement as HTMLElement;
              setSelected(row);
            }}
          />
        </div>

        {selected ? (
          <>
            <ResizeHandle
              label="Resize message inspector"
              value={layout.widths.messageInspector}
              min={BOUNDS.messageInspector.min}
              max={BOUNDS.messageInspector.max}
              direction={-1}
              onResize={(next) => layout.setWidth("messageInspector", next)}
              onReset={() => layout.reset("messageInspector")}
            />
            <MessageInspector
              message={selected}
              onClose={() => {
                setSelected(null);
                lastRow.current?.focus();
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
