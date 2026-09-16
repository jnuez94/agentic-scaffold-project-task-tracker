/**
 * What the audit pickers offer (UI-66).
 *
 * The contract fixes the Audit row's fields but tabulates neither its actions
 * nor its object types, so these are read from the vendored implementation —
 * every `audit(...)` call in lib/coordination at 1.4.0 — and pinned here.
 * Offering the full set rather than what the loaded window happens to contain
 * means a type absent from the newest 500 can still be asked for; a choice
 * that matches nothing shows the empty state, which is the honest answer.
 */

export const AUDIT_OBJECT_TYPES = [
  "agent",
  "artifact",
  "database",
  "decision",
  "dependency",
  "escalation",
  "evidence",
  "message",
  "review",
  "session",
  "task",
] as const;

export const AUDIT_ACTIONS = [
  "add",
  "assign",
  "backup",
  "claim",
  "create",
  "end",
  "export",
  "heartbeat",
  "mark_read",
  "recover",
  "recover_claim",
  "redact",
  "resolve",
  "restore",
  "send",
  "start",
  "status",
  "update",
] as const;

export interface AuditRequestFilters {
  objectType: string;
  action: string;
}

/** The request parameters a picker state becomes; empty pickers send nothing. */
export function auditRequestParams(filters: AuditRequestFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.objectType) params["object_type"] = filters.objectType;
  if (filters.action) params["action"] = filters.action;
  return params;
}

/** "task claim events", "task events", "claim events", or "" when nothing narrows. */
export function auditWindowNoun(filters: AuditRequestFilters): string {
  const parts = [filters.objectType, filters.action].filter(Boolean);
  return parts.length ? `${parts.join(" ")} events` : "";
}
