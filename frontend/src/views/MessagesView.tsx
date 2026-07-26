/**
 * The Messages screen: the record list plus the one broadcast entry point.
 *
 * Deliberately the only place a broadcast can be started. The task queue and
 * inspector gain no broadcast affordance (criterion 2).
 */

import { useRef, useState } from "react";
import type { Agent, Message } from "../api/contract.ts";
import { broadcastReadiness } from "../lib/broadcast.ts";
import { useApp } from "../state/AppContext.tsx";
import { BroadcastComposer } from "./BroadcastComposer.tsx";
import { MessageInspector } from "./MessageInspector.tsx";
import { RecordsView } from "./RecordsView.tsx";

export function MessagesView({ filter, agents }: { filter: string; agents: Agent[] }) {
  const { identity, mutationsEnabled } = useApp();
  const [open, setOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<Message | null>(null);
  // Restores focus to the row that opened the inspector.
  const lastRow = useRef<HTMLElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const actor = agents.find((agent) => agent.id === identity.actorId);
  const readiness = broadcastReadiness({
    actor,
    sessionId: identity.sessionId,
    mutationsEnabled,
  });
  const blocked = readiness.kind === "blocked";

  // Focus returns to the trigger when the composer closes.
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div className={open ? "messages-screen with-sheet" : "messages-screen"}>
      <div className={selected ? "messages-layout with-inspector" : "messages-layout"}>
        <div className="messages-main">
        <div className="broadcast-bar">
          <button
            ref={trigger}
            className="primary"
            disabled={blocked}
            title={blocked ? readiness.reason : undefined}
            onClick={() => setOpen(true)}
          >
            Broadcast to team
          </button>
          {blocked ? <p className="small muted">{readiness.reason}</p> : null}
        </div>

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
          <MessageInspector
            message={selected}
            onClose={() => {
              setSelected(null);
              lastRow.current?.focus();
            }}
          />
        ) : null}
      </div>

      {open && readiness.kind === "ready" && identity.sessionId ? (
        <>
          <div className="sheet-scrim" onClick={close} aria-hidden="true" />
          <BroadcastComposer
            senderId={readiness.senderId}
            senderName={actor?.name ?? readiness.senderId}
            sessionId={identity.sessionId}
            onClose={close}
            onSent={() => setReloadKey((value) => value + 1)}
          />
        </>
      ) : null}
    </div>
  );
}
