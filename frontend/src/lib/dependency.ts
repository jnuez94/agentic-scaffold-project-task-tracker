/**
 * Recording what a task waits on (UI-50).
 *
 * Blockers are the core concept of this tool, and until now the console could
 * read every one and record none: Health has a Blocked tasks section, the
 * inspector has a Dependencies tab, and marking a task blocked without being
 * able to say what it is blocked on is half a workflow.
 *
 * The checks here are the ones the CLI would refuse anyway. Doing them in the
 * browser is not about trusting the client — every write still goes through the
 * CLI, which re-validates — it is about answering in the same keystroke rather
 * than after a round trip.
 */

import type { Dependency, DependencyType } from "../api/contract.ts";

export const DEPENDENCY_TYPES: DependencyType[] = [
  "blocks",
  "informs",
  "review_required",
  "evidence_required",
];

/** What each type means, in the operator's terms rather than the schema's. */
export const DEPENDENCY_LABELS: Record<DependencyType, string> = {
  blocks: "Blocks — this task cannot proceed until that one is done",
  informs: "Informs — useful context, but not a blocker",
  review_required: "Review required — that task must be reviewed first",
  evidence_required: "Evidence required — that task must carry evidence first",
};

export interface DependencyDraft {
  dependsOn: string;
  type: DependencyType;
  rationale: string;
}

export type DependencyProblem =
  | { field: "dependsOn"; message: string }
  | { field: "actor"; message: string };

/**
 * Why this dependency cannot be recorded, or null if it can.
 *
 * Returns the offending field so the form can point at it, rather than a bare
 * string that leaves the caller guessing where to put it.
 */
export function checkDependency(
  draft: DependencyDraft,
  context: { taskId: string; existing: readonly Dependency[]; actorId: string | null },
): DependencyProblem | null {
  const dependsOn = draft.dependsOn.trim();
  if (!dependsOn) {
    return { field: "dependsOn", message: "Name the task this one waits on." };
  }
  // The CLI rejects this, and the reason is worth stating rather than relaying:
  // a self-dependency is unsatisfiable by construction.
  if (dependsOn === context.taskId) {
    return { field: "dependsOn", message: "A task cannot depend on itself." };
  }
  const clash = context.existing.find(
    (entry) =>
      entry.depends_on_task_id === dependsOn &&
      entry.dependency_type === draft.type &&
      entry.status === "active",
  );
  if (clash) {
    return {
      field: "dependsOn",
      message: `${dependsOn} is already recorded as ${draft.type} on this task.`,
    };
  }
  if (!context.actorId) {
    return {
      field: "actor",
      message: "Select an actor in the header: recording a dependency is an attributed change.",
    };
  }
  return null;
}

export function buildDependencyRequest(
  draft: DependencyDraft,
  context: { taskId: string; actorId: string },
): Record<string, string> {
  const body: Record<string, string> = {
    task: context.taskId,
    depends_on: draft.dependsOn.trim(),
    actor: context.actorId,
    type: draft.type,
  };
  const rationale = draft.rationale.trim();
  if (rationale) body["rationale"] = rationale;
  return body;
}

/** Active dependencies first: they are the ones still holding the task up. */
export function orderDependencies(dependencies: readonly Dependency[]): Dependency[] {
  return [...dependencies].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return a.depends_on_task_id.localeCompare(b.depends_on_task_id);
  });
}
