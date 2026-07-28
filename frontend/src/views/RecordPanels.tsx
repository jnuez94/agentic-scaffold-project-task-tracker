/**
 * The overlays a record table can open: the read-only inspector, and the one
 * state transition the CLI supports on this surface.
 *
 * Extracted from RecordsView to keep that view to one job and within the
 * file-size limit. Both panels are driven by the row the table already holds;
 * neither issues a query.
 */

import { useState } from "react";
import type { Agent, Session, TaskListRow } from "../api/contract.ts";
import { retirementBlock } from "../lib/retirement.ts";
import { AgentRetirement } from "./AgentRetirement.tsx";
import { RecordInspector } from "./RecordInspector.tsx";
import type { InspectorConfig, Row } from "./inspectorConfigs.tsx";
import type { RecordConfig } from "./recordConfigs.tsx";
import { SessionRecovery } from "./SessionRecovery.tsx";

export function RecordPanels({
  config,
  inspectorConfig,
  inspecting,
  acting,
  tasks,
  sessions,
  actorId,
  onCloseInspector,
  onCloseAction,
  onAct,
  onRecovered,
}: {
  config: RecordConfig;
  inspectorConfig: InspectorConfig | undefined;
  inspecting: Row | null;
  acting: Row | null;
  tasks: readonly TaskListRow[];
  /** Needed to explain the CLI's active-session guard before submission. */
  sessions: readonly Session[];
  actorId: string | null;
  onCloseInspector: () => void;
  onCloseAction: () => void;
  onAct: (row: Row) => void;
  onRecovered: () => void;
}) {
  const [retiring, setRetiring] = useState<Agent | null>(null);
  const agentRow =
    inspectorConfig?.kind === "agent" ? (inspecting as Agent | null) : null;
  const block = agentRow ? retirementBlock(agentRow, actorId, sessions) : null;

  return (
    <>
      {inspecting && inspectorConfig ? (
        <RecordInspector
          config={inspectorConfig}
          row={inspecting}
          onClose={onCloseInspector}
          actions={
            <>
              {/* Reuses the row action's own predicate, so the control appears
                  only where the underlying command would accept it. */}
              {config.rowAction?.applies(inspecting) ? (
                <button
                  type="button"
                  className="record-action"
                  onClick={() => onAct(inspecting)}
                >
                  {config.rowAction.label}
                </button>
              ) : null}

              {agentRow ? (
                <>
                  <button
                    type="button"
                    className="record-action"
                    disabled={Boolean(block)}
                    aria-describedby={block ? "retire-block" : undefined}
                    onClick={() => setRetiring(agentRow)}
                  >
                    {agentRow.status === "active"
                      ? "Retire agent…"
                      : "Restore to active"}
                  </button>
                  {/* Accessible text, not a tooltip: the reason is required to
                      understand why the control is unavailable. */}
                  {block ? (
                    <p className="small muted" id="retire-block">
                      {block.reason}
                    </p>
                  ) : null}
                </>
              ) : null}
            </>
          }
        />
      ) : null}

      {retiring ? (
        <>
          <div
            className="sheet-scrim"
            onClick={() => setRetiring(null)}
            aria-hidden="true"
          />
          <AgentRetirement
            agent={retiring}
            tasks={tasks}
            onClose={() => setRetiring(null)}
            onChanged={onRecovered}
          />
        </>
      ) : null}

      {acting ? (
        <>
          <div
            className="sheet-scrim"
            onClick={onCloseAction}
            aria-hidden="true"
          />
          <SessionRecovery
            session={acting as unknown as Session}
            tasks={tasks}
            actorId={actorId}
            onClose={onCloseAction}
            onRecovered={onRecovered}
          />
        </>
      ) : null}
    </>
  );
}
