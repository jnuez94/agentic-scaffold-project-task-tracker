/**
 * Why a status changed (UI-72).
 *
 * 1.4.0 adds `--because TYPE:ID` to status changes: a record — a review, a
 * decision, a message, another task, an escalation, an artifact — validated
 * to exist and written into the audit detail as `because=TYPE:ID`. There is
 * no column; it is a suffix on detail, and this module is the only place
 * that reads or writes that shape. Nothing else in detail is parsed.
 */

import type { Decision, Escalation, Review, TaskDetail } from "../api/contract.ts";
import type { TaskAction } from "./transitions.ts";

export const BECAUSE_TYPES = ["review", "decision", "message", "task", "escalation", "artifact"] as const;
export type BecauseType = (typeof BECAUSE_TYPES)[number];

export interface Because {
  type: BecauseType;
  id: string;
}

const ROUTES: Record<BecauseType, string> = {
  review: "reviews",
  decision: "decisions",
  message: "messages",
  task: "tasks",
  escalation: "escalations",
  artifact: "artifacts",
};

// One `;`-separated segment of the detail. The task text called it a suffix;
// the CLI writes it between the transition and any note ("proposed ->
// superseded; because=decision:DEC-1; the note"), so it is found wherever
// it sits and lifted out, and the segments around it are rejoined.
const SEGMENT = /^because=(review|decision|message|task|escalation|artifact):([A-Za-z0-9][A-Za-z0-9._:@+-]{0,127})$/;

export function formatBecause(because: Because): string {
  return `${because.type}:${because.id}`;
}

export function becauseHref(because: Because): string {
  return `#/${ROUTES[because.type]}/${encodeURIComponent(because.id)}`;
}

/** Split an audit detail into its text and the cause it carries, if any. */
export function parseBecause(detail: string): { text: string; because: Because | null } {
  const segments = detail.split(";").map((segment) => segment.trim());
  const index = segments.findIndex((segment) => SEGMENT.test(segment));
  if (index === -1) return { text: detail, because: null };
  const match = SEGMENT.exec(segments[index]!)!;
  const text = segments.filter((_, position) => position !== index && _ !== "").join("; ");
  return { text, because: { type: match[1] as BecauseType, id: match[2]! } };
}

export interface CauseOption {
  value: string;
  label: string;
}

/**
 * What a change may cite. For a task: its own reviews, decisions whose text
 * names it, and open escalations that relate to it. For an escalation being
 * answered (UI-82): decisions that name it or one of its related tasks.
 * Only records that exist are offered — the CLI would refuse anything else,
 * and a typed id is a guess where a choice is a fact.
 */
export interface CauseSubject extends Pick<TaskDetail, "id" | "reviews"> {
  /** Other ids a decision may name to count as a cause — an escalation's related tasks. */
  alsoNamed?: readonly string[];
}

export function causeOptions(
  task: CauseSubject,
  decisions: readonly Decision[],
  escalations: readonly Escalation[],
): CauseOption[] {
  const names = [task.id, ...(task.alsoNamed ?? [])];
  const reviews = [...task.reviews]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((review) => ({
      value: formatBecause({ type: "review", id: review.id }),
      label: `Review ${review.id} — ${review.decision.replace(/_/g, " ")}`,
    }));
  const named = decisions
    .filter((decision) =>
      [decision.title, decision.context, decision.decision, decision.evidence, decision.implications]
        .join("\n")
        .match(new RegExp(names.map(escapeRegExp).join("|"))),
    )
    .map((decision) => ({
      value: formatBecause({ type: "decision", id: decision.id }),
      label: `Decision ${decision.id} — ${decision.title}`,
    }));
  const open = escalations
    .filter(
      (escalation) =>
        escalation.id !== task.id &&
        escalation.status === "open" &&
        escalation.related_tasks
          .split(",")
          .map((part) => part.trim())
          .includes(task.id),
    )
    .map((escalation) => ({
      value: formatBecause({ type: "escalation", id: escalation.id }),
      label: `Escalation ${escalation.id}`,
    }));
  return [...reviews, ...named, ...open];
}

/** The latest review, when a task leaves review: the console knows the cause, so it says it. */
export function autoCause(
  task: Pick<TaskDetail, "status" | "reviews">,
  action: Pick<TaskAction, "kind">,
): Because | null {
  if (task.status !== "review" || action.kind === "claim") return null;
  const latest = [...task.reviews].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return latest ? { type: "review", id: latest.id } : null;
}

export function describeCause(because: Because): string {
  return `${because.type} ${because.id}`;
}

export type { Review };

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
