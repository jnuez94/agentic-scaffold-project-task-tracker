/**
 * The overlays a record table can open: the read-only inspector, and the one
 * state transition the CLI supports on this surface.
 *
 * Extracted from RecordsView to keep that view to one job and within the
 * file-size limit. Both panels are driven by the row the table already holds;
 * neither issues a query.
 */

import type { Session, TaskListRow } from "../api/contract.ts";
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
  actorId: string | null;
  onCloseInspector: () => void;
  onCloseAction: () => void;
  onAct: (row: Row) => void;
  onRecovered: () => void;
}) {
  return (
    <>
      {inspecting && inspectorConfig ? (
        <RecordInspector
          config={inspectorConfig}
          row={inspecting}
          onClose={onCloseInspector}
          actions={
            /* Reuses the row action's own predicate, so the control appears
               only where the underlying command would accept it. */
            config.rowAction?.applies(inspecting) ? (
              <button
                type="button"
                className="link-button"
                onClick={() => onAct(inspecting)}
              >
                {config.rowAction.label}
              </button>
            ) : null
          }
        />
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
