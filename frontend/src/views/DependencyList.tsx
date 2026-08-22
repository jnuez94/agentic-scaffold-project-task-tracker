/**
 * A task's recorded dependencies, with resolution inline (UI-50).
 *
 * Resolution has no confirmation step, by ruling: `dependency resolve` marks
 * the row resolved rather than deleting it — `resolved_at` is set and the
 * record kept — so nothing is lost and the action is closer to marking
 * something done than to deleting it. A confirmation on a non-destructive
 * action teaches the operator that confirmations are noise, which is what
 * makes them skip the one on session recovery, where it matters.
 *
 * The control renders only on active rows: a resolved dependency offers
 * nothing, and the CLI would refuse it anyway. Same applies-predicate rule as
 * the row actions in recordConfigs.
 */

import { useState } from "react";
import type { Dependency } from "../api/contract.ts";
import { ApiError } from "../api/errors.ts";
import { EnumPill } from "../components/Pill.tsx";
import { describeThrown } from "../lib/copy.ts";
import { orderDependencies } from "../lib/dependency.ts";
import { useApp } from "../state/AppContext.tsx";

export function DependencyList({
  taskId,
  dependencies,
  onChanged,
}: {
  taskId: string;
  dependencies: readonly Dependency[];
  onChanged: () => void;
}) {
  const { coordination, identity, announce, mutationsEnabled } = useApp();
  // Keyed by edge, so one slow resolve does not disable the whole list.
  const [pendingEdge, setPendingEdge] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | undefined>();

  const edgeOf = (d: Dependency) => `${d.depends_on_task_id}-${d.dependency_type}`;

  const resolve = async (dependency: Dependency) => {
    if (pendingEdge || !identity.actorId) return;
    setFailure(undefined);
    setPendingEdge(edgeOf(dependency));
    try {
      await coordination.resolveDependency({
        task: taskId,
        depends_on: dependency.depends_on_task_id,
        type: dependency.dependency_type,
        actor: identity.actorId,
      });
      // Outcome and consequence (UI-32): what changed, and that the record
      // survives — "resolved" must not read as "removed".
      announce(
        `${taskId} no longer waits on ${dependency.depends_on_task_id}. ` +
          "The dependency is kept in the record as resolved.",
      );
      onChanged();
    } catch (caught) {
      setFailure(
        caught instanceof ApiError ? caught.message : describeThrown(caught),
      );
    } finally {
      setPendingEdge(null);
    }
  };

  return (
    <>
      {failure ? (
        <p className="small field-problem" role="alert">
          {failure}
        </p>
      ) : null}
      <ul className="record-list">
        {orderDependencies(dependencies).map((dependency) => {
          const edge = edgeOf(dependency);
          return (
            <li key={edge}>
              <div className="record-head">
                <span className="mono">{dependency.depends_on_task_id}</span>
                <EnumPill value={dependency.dependency_type} />
                <EnumPill value={dependency.status} />
                {dependency.status === "active" && mutationsEnabled ? (
                  <button
                    type="button"
                    className="record-action"
                    disabled={pendingEdge !== null}
                    onClick={() => void resolve(dependency)}
                  >
                    {pendingEdge === edge ? "Resolving…" : "Mark resolved"}
                  </button>
                ) : null}
              </div>
              {dependency.rationale ? (
                <p className="small">{dependency.rationale}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
