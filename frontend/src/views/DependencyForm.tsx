/**
 * Recording what a task waits on, from the Dependencies tab (UI-50).
 *
 * Deliberately in the tab that already lists them rather than as a row action:
 * a dependency only means anything next to the ones already recorded, and the
 * duplicate check needs that list anyway.
 */

import { useState } from "react";
import type { Dependency } from "../api/contract.ts";
import { ApiError } from "../api/errors.ts";
import { ErrorBanner } from "../components/Feedback.tsx";
import { FormField } from "../components/FormField.tsx";
import {
  buildDependencyRequest,
  checkDependency,
  DEPENDENCY_LABELS,
  DEPENDENCY_TYPES,
  type DependencyDraft,
} from "../lib/dependency.ts";
import { describeThrown } from "../lib/copy.ts";
import { useApp } from "../state/AppContext.tsx";
import { receiptSuffix } from "../lib/receipt.ts";

export function DependencyForm({
  taskId,
  existing,
  onAdded,
}: {
  taskId: string;
  existing: readonly Dependency[];
  onAdded: () => void;
}) {
  const { coordination, identity, announce, mutationsEnabled } = useApp();
  const [draft, setDraft] = useState<DependencyDraft>({
    dependsOn: "",
    type: "blocks",
    rationale: "",
  });
  const [problem, setProblem] = useState<string | undefined>();
  const [error, setError] = useState<ApiError | undefined>();
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;

    const found = checkDependency(draft, {
      taskId,
      existing,
      actorId: identity.actorId,
    });
    if (found) {
      setProblem(found.message);
      return;
    }
    setProblem(undefined);
    setError(undefined);
    setPending(true);
    try {
      const added = await coordination.addDependency(
        buildDependencyRequest(draft, { taskId, actorId: identity.actorId! }),
      );
      // Outcome and consequence, per the UI-32 ruling: what changed, and what
      // it now means for the task.
      announce(
        `${taskId} now records ${draft.dependsOn.trim()} as ${draft.type}. ` +
          `${draft.type === "blocks" ? "It cannot proceed until that task is done." : "Recorded as context."}` +
          receiptSuffix(added),
      );
      setDraft({ dependsOn: "", type: draft.type, rationale: "" });
      onAdded();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError("network_error", describeThrown(caught), 0),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="dependency-form" onSubmit={(event) => void submit(event)}>
      {error ? <ErrorBanner error={error} onDismiss={() => setError(undefined)} /> : null}

      <FormField
        id="dependency-target"
        label="This task waits on"
        hint="Task id, for example UI-12"
        error={problem}
      >
        {(control) => (
          <input
            {...control}
            value={draft.dependsOn}
            onChange={(event) => setDraft({ ...draft, dependsOn: event.target.value })}
          />
        )}
      </FormField>

      <FormField id="dependency-type" label="Relationship">
        {(control) => (
          <select
            {...control}
            value={draft.type}
            onChange={(event) =>
              setDraft({ ...draft, type: event.target.value as DependencyDraft["type"] })
            }
          >
            {DEPENDENCY_TYPES.map((value) => (
              <option key={value} value={value}>
                {DEPENDENCY_LABELS[value]}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField
        id="dependency-rationale"
        label="Why (optional)"
        hint="What about that task this one needs"
      >
        {(control) => (
          <input
            {...control}
            value={draft.rationale}
            onChange={(event) => setDraft({ ...draft, rationale: event.target.value })}
          />
        )}
      </FormField>

      <div className="field-actions">
        <button type="submit" disabled={pending || !mutationsEnabled}>
          {pending ? "Recording…" : "Record dependency"}
        </button>
      </div>
    </form>
  );
}
