/**
 * The Messages screen: one fetch, two presentations, one inspector.
 *
 * Conversation and Ledger render the *same* loaded rows (UI-11 criterion 1),
 * so the fetch, the loaded-row filter, and the selected record all live here
 * rather than inside either presentation. That is what lets filter, selection,
 * and the inspector survive a view switch.
 *
 * The broadcast trigger is not here; it is global in the toolbar (UI-12).
 */

import { useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Agent, Message } from "../api/contract.ts";
import { DataTable } from "../components/DataTable.tsx";
import { ErrorBanner, SkeletonRows } from "../components/Feedback.tsx";
import { ResizeHandle } from "../components/ResizeHandle.tsx";
import { loadedCountLabel } from "../lib/conversation.ts";
import { filterRows } from "../lib/filters.ts";
import { useApp } from "../state/AppContext.tsx";
import { BOUNDS } from "../state/layoutStore.ts";
import type { Layout } from "../state/useLayout.ts";
import { useResource } from "../state/useResource.ts";
import { useMessageView } from "../state/useMessageView.ts";
import { ConversationView } from "./ConversationView.tsx";
import { MessageInspector } from "./MessageInspector.tsx";
import { RECORD_CONFIGS } from "./recordConfigs.tsx";

export function MessagesView({
  filter,
  agents,
  layout,
  reloadKey,
}: {
  filter: string;
  agents: Agent[];
  layout: Layout;
  /** Bumped by the global broadcast launcher after a successful send. */
  reloadKey: number;
}) {
  const { coordination, identity } = useApp();
  const [view, setView] = useMessageView();
  const [selected, setSelected] = useState<Message | null>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);

  const config = RECORD_CONFIGS.messages;
  const resource = useResource(
    () => coordination.messages({ limit: 500 }),
    [coordination, reloadKey],
  );

  const rows = useMemo(
    () => filterRows(resource.data ?? [], config?.filterFields ?? [], filter),
    [resource.data, config, filter],
  );

  const nameFor = useMemo(() => {
    const byId = new Map(agents.map((agent) => [agent.id, agent.name]));
    return (id: string) => byId.get(id) ?? id;
  }, [agents]);

  const select = (message: Message, element: HTMLElement) => {
    lastTrigger.current = element;
    setSelected(message);
  };

  return (
    <div className="messages-screen">
      <div
        className={selected ? "messages-layout with-inspector" : "messages-layout"}
        style={
          { "--message-inspector-width": `${layout.widths.messageInspector}px` } as CSSProperties
        }
      >
        <div className="messages-main">
          <div className="view-header">
            <h1>Messages</h1>
            <p className="small muted">{config?.description}</p>
          </div>

          <div className="queue-toolbar">
            <div className="view-switch" role="group" aria-label="Message presentation">
              <button
                className={view === "conversation" ? "active" : ""}
                aria-pressed={view === "conversation"}
                onClick={() => setView("conversation")}
              >
                Conversation
              </button>
              <button
                className={view === "ledger" ? "active" : ""}
                aria-pressed={view === "ledger"}
                onClick={() => setView("ledger")}
              >
                Ledger
              </button>
            </div>
            <p className="queue-count small muted" aria-live="polite">
              {loadedCountLabel(rows.length, Boolean(filter))}
            </p>
          </div>

          {resource.error ? (
            <ErrorBanner error={resource.error} onRetry={resource.refresh} />
          ) : null}
          {!resource.loaded && resource.loading ? <SkeletonRows rows={6} columns={3} /> : null}

          {resource.loaded && view === "conversation" ? (
            <ConversationView
              messages={rows}
              actorId={identity.actorId}
              nameFor={nameFor}
              selectedId={selected?.id ?? null}
              onSelect={select}
              filtered={Boolean(filter)}
            />
          ) : null}

          {resource.loaded && view === "ledger" && config ? (
            <DataTable
              rows={rows as never[]}
              columns={config.columns}
              rowKey={(row) => String((row as Record<string, unknown>)["id"])}
              caption="Coordination messages"
              defaultOrder={config.defaultOrder}
              loaded={resource.loaded}
              loading={resource.loading}
              selectedKey={selected?.id ?? null}
              onSelect={(row) => {
                lastTrigger.current = document.activeElement as HTMLElement;
                setSelected(row as unknown as Message);
              }}
              emptyTitle={filter ? "No loaded messages match this filter" : config.emptyTitle}
              emptyHint={filter ? "Clear the filter to see everything loaded." : config.emptyHint}
            />
          ) : null}
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
                lastTrigger.current?.focus();
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
