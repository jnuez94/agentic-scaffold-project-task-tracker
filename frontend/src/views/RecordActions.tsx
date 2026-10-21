/**
 * The transitions a record offers from its inspector: session recovery,
 * agent retirement and restoration, a decision's status, an artifact's
 * status and record correction, and an escalation's resolution. Each appears
 * only where the CLI would accept it, so no control implies a change the
 * record cannot take.
 *
 * Which sheet each opens is described, not rendered, here: RecordActionSheet
 * renders it, so the inspector and its overlays stay separate.
 */

import type { Agent, Artifact, Decision, Escalation, Session } from "../api/contract.ts";
import { isResolvable } from "../lib/escalationResolution.ts";
import { retirementBlock } from "../lib/retirement.ts";
import type { Row } from "./inspectorConfigs.tsx";
import type { RecordConfig } from "./recordConfigs.tsx";

/** The one sheet a record inspector can have open. */
export type OpenSheet =
  | { kind: "retire"; agent: Agent }
  | { kind: "ruling"; decision: Decision }
  | { kind: "artifactStatus"; artifact: Artifact }
  | { kind: "artifactCorrect"; artifact: Artifact }
  | { kind: "resolve"; escalation: Escalation };

function Action({ label, disabled, onClick, describedBy }: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  describedBy?: string;
}) {
  return (
    <button type="button" className="record-action" disabled={disabled} aria-describedby={describedBy} onClick={onClick}>
      {label}
    </button>
  );
}

export function RecordActions({
  config,
  kind,
  row,
  actorId,
  sessions,
  onAct,
  onOpen,
}: {
  config: RecordConfig;
  /** The inspector's entity kind: "agent", "decision", "artifact", "escalation"… */
  kind: string;
  row: Row;
  actorId: string | null;
  sessions: readonly Session[];
  onAct: (row: Row) => void;
  onOpen: (sheet: OpenSheet) => void;
}) {
  const noActor = !actorId;

  if (kind === "agent") {
    const agent = row as unknown as Agent;
    const block = retirementBlock(agent, actorId, sessions);
    return (
      <>
        <Action
          label={agent.status === "active" ? "Retire agent…" : "Restore to active"}
          disabled={Boolean(block)}
          describedBy={block ? "retire-block" : undefined}
          onClick={() => onOpen({ kind: "retire", agent })}
        />
        {/* Accessible text, not a tooltip: the reason is required to
            understand why the control is unavailable. */}
        {block ? (
          <p className="small muted" id="retire-block">
            {block.reason}
          </p>
        ) : null}
      </>
    );
  }
  if (kind === "decision") {
    const decision = row as unknown as Decision;
    return <Action label="Change status…" disabled={noActor} onClick={() => onOpen({ kind: "ruling", decision })} />;
  }
  if (kind === "artifact") {
    const artifact = row as unknown as Artifact;
    return (
      <>
        <Action label="Change status…" disabled={noActor} onClick={() => onOpen({ kind: "artifactStatus", artifact })} />
        <Action label="Correct record…" disabled={noActor} onClick={() => onOpen({ kind: "artifactCorrect", artifact })} />
      </>
    );
  }
  if (kind === "escalation") {
    const escalation = row as unknown as Escalation;
    return isResolvable(escalation) ? (
      <Action label="Resolve…" disabled={noActor} onClick={() => onOpen({ kind: "resolve", escalation })} />
    ) : null;
  }
  // Reuses the row action's own predicate, so the control appears only where
  // the underlying command would accept it (session recovery).
  return config.rowAction?.applies(row) ? <Action label={config.rowAction.label} onClick={() => onAct(row)} /> : null;
}
