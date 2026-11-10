/**
 * The sheet a record inspector's action opened (see RecordActions), over a
 * scrim that closes it. One at a time: the inspector holds one OpenSheet.
 */

import type { TaskListRow } from "../api/contract.ts";
import { AgentRetirement } from "./AgentRetirement.tsx";
import { ArtifactCorrectionForm } from "./ArtifactCorrectionForm.tsx";
import { ArtifactStatusForm } from "./ArtifactStatusForm.tsx";
import { DecisionStatusForm } from "./DecisionStatusForm.tsx";
import { EscalationResolveForm } from "./EscalationResolveForm.tsx";
import type { OpenSheet } from "./RecordActions.tsx";

export function RecordActionSheet({
  sheet,
  tasks,
  tasksKnown = true,
  onClose,
  onChanged,
}: {
  sheet: OpenSheet;
  tasks: readonly TaskListRow[];
  /** False when the open tasks could not be read whole. */
  tasksKnown?: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const shared = { onClose, onChanged };
  return (
    <>
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />
      {sheet.kind === "retire" ? <AgentRetirement agent={sheet.agent} tasks={tasks} tasksKnown={tasksKnown} {...shared} /> : null}
      {sheet.kind === "ruling" ? <DecisionStatusForm decision={sheet.decision} {...shared} /> : null}
      {sheet.kind === "artifactStatus" ? <ArtifactStatusForm artifact={sheet.artifact} {...shared} /> : null}
      {sheet.kind === "artifactCorrect" ? <ArtifactCorrectionForm artifact={sheet.artifact} {...shared} /> : null}
      {sheet.kind === "resolve" ? <EscalationResolveForm escalation={sheet.escalation} tasks={tasks} {...shared} /> : null}
    </>
  );
}
