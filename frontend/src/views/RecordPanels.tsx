/**
 * The overlays a record table can open: the inspector, its actions (see
 * RecordActions) and the sheet one of them opened, and session recovery from
 * a table row.
 *
 * Extracted from RecordsView to keep that view to one job. The inspector is
 * driven by the row the table already holds and issues no query of its own.
 */

import { useState } from "react";
import type { Session, TaskListRow } from "../api/contract.ts";
import { useApp } from "../state/AppContext.tsx";
import type { InspectorConfig, Row } from "./inspectorConfigs.tsx";
import { RecordActionSheet } from "./RecordActionSheet.tsx";
import { RecordActions, type OpenSheet } from "./RecordActions.tsx";
import { RecordInspector } from "./RecordInspector.tsx";
import type { RecordConfig } from "./recordConfigs.tsx";
import { SessionRecovery } from "./SessionRecovery.tsx";

export function RecordPanels({
  config,
  inspectorConfig,
  inspecting,
  acting,
  tasks,
  tasksKnown = true,
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
  tasksKnown?: boolean;
  /** Needed to explain the CLI's active-session guard before submission. */
  sessions: readonly Session[];
  actorId: string | null;
  onCloseInspector: () => void;
  onCloseAction: () => void;
  onAct: (row: Row) => void;
  onRecovered: () => void;
}) {
  const [sheet, setSheet] = useState<OpenSheet | null>(null);
  const { announce } = useApp();

  return (
    <>
      {inspecting && inspectorConfig ? (
        <RecordInspector
          config={inspectorConfig}
          row={inspecting}
          onClose={onCloseInspector}
          onCopied={announce}
          withActivity
          actions={
            <RecordActions
              config={config}
              kind={inspectorConfig.kind}
              row={inspecting}
              actorId={actorId}
              sessions={sessions}
              onAct={onAct}
              onOpen={setSheet}
            />
          }
        />
      ) : null}

      {sheet ? (
        <RecordActionSheet sheet={sheet} tasks={tasks} tasksKnown={tasksKnown} onClose={() => setSheet(null)} onChanged={onRecovered} />
      ) : null}

      {acting ? (
        <>
          <div className="sheet-scrim" onClick={onCloseAction} aria-hidden="true" />
          <SessionRecovery
            session={acting as unknown as Session}
            tasks={tasks}
            tasksKnown={tasksKnown}
            actorId={actorId}
            onClose={onCloseAction}
            onRecovered={onRecovered}
          />
        </>
      ) : null}
    </>
  );
}
