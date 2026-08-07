/**
 * A cheap signature of a loaded set, for noticing it has moved (UI-34).
 *
 * The console renders what it fetched when the route loaded and never says it
 * may no longer be true. With several agents in one repository that is how work
 * gets lost — silently, while the operator believes they are current.
 *
 * Revision is what makes this reliable rather than approximate: the CLI
 * increments it on every mutation, so two sets with the same signature really
 * are the same rows at the same versions. Comparing timestamps would miss two
 * changes inside one second, and comparing lengths would miss an edit.
 */

/** Rows carry an id and a revision; nothing else is needed to detect a change. */
export interface Versioned {
  id: string;
  revision: number;
}

/**
 * Order-independent, so a re-sort is not mistaken for a change.
 *
 * The server orders by priority then updated_at, both of which move when a task
 * is edited — so a sorted join would report a change for every row whenever any
 * one row moved position.
 */
export function fingerprint(rows: readonly Versioned[]): string {
  return [...rows]
    .map((row) => `${row.id}@${row.revision}`)
    .sort()
    .join(",");
}

/** What changed between two loaded sets, for a bar that has to say something. */
export interface BoardDelta {
  added: string[];
  removed: string[];
  changed: string[];
}

export function diffBoards(
  before: readonly Versioned[],
  after: readonly Versioned[],
): BoardDelta {
  const was = new Map(before.map((row) => [row.id, row.revision]));
  const now = new Map(after.map((row) => [row.id, row.revision]));
  const delta: BoardDelta = { added: [], removed: [], changed: [] };

  for (const [id, revision] of now) {
    const previous = was.get(id);
    if (previous === undefined) delta.added.push(id);
    else if (previous !== revision) delta.changed.push(id);
  }
  for (const id of was.keys()) {
    if (!now.has(id)) delta.removed.push(id);
  }
  return delta;
}

/** "3 tasks changed", "1 task added and 2 changed" — never a bare "updated". */
export function describeDelta(delta: BoardDelta): string {
  const parts: string[] = [];
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (delta.added.length) parts.push(`${plural(delta.added.length, "task")} added`);
  if (delta.changed.length) parts.push(`${plural(delta.changed.length, "task")} changed`);
  if (delta.removed.length) parts.push(`${plural(delta.removed.length, "task")} no longer listed`);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]!}`;
}
