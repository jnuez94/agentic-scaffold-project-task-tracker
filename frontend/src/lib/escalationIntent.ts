/**
 * A one-shot handoff from Health to the task inspector (UI-49).
 *
 * Health's blocked-tasks row opens the escalation form for that task, pre-
 * filled with the blocking reason. The route carries only a name and a detail,
 * so the prefill has to travel some other way. This is a bookmark the console
 * leaves for itself and consumes on arrival — sessionStorage so it survives
 * the hash change and nothing else, read once and cleared so it can never
 * reopen the form on a later visit.
 *
 * Deliberately not a hash segment: the route table is used everywhere, and
 * adding a third part to it for one handoff is more surface than the handoff
 * is worth. Deliberately not the coordination database: this is console state
 * about the console, not a fact about the project.
 */

const KEY = "coordination-console.escalationIntent";

export interface EscalationIntent {
  taskId: string;
  issue: string;
}

function storage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function stashEscalationIntent(intent: EscalationIntent): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(intent));
  } catch {
    // If it cannot be stashed the operator lands on the task and escalates
    // from there by hand; the form still exists.
  }
}

/** The intent for this task if one is waiting — and it is gone after this. */
export function takeEscalationIntent(taskId: string): EscalationIntent | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EscalationIntent>;
    if (parsed.taskId !== taskId) return null;
    store.removeItem(KEY);
    return { taskId, issue: typeof parsed.issue === "string" ? parsed.issue : "" };
  } catch {
    store.removeItem(KEY);
    return null;
  }
}
