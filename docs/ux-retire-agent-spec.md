# UX Spec — Operator Retirement of an Agent

| Field | Value |
| --- | --- |
| Status | Implemented in `UI-30`; UX review accepted as `UX-UI30-QA-1` |
| Owner | `michael-ux` — UX Designer |
| Tracked by | `UX-18`; implementation in `UI-30` |
| Candidate | Behaviour probed against `d4e1adc` on a throwaway database |
| Companion | `ux-entity-inspectors-spec.md` (Agents inspector hosts this control) |

## 1. Why

Two agents were retired during this project — `mikhail-ux` on sign-off and
`codex-security` when its identity was consolidated into `toby`. Both were done
from the CLI, because the console cannot do it.

The capability is plumbed and dead-ends at the UI, the same pattern as
stale-session recovery before `UI-22` and task assignment before `UI-28`:

| Layer | State |
| --- | --- |
| CLI | `coordination agent update <id> --status inactive --actor <actor>` |
| HTTP API | `POST /api/agents/{id}` — `coordination_ui/api/routes/agents.py:66` |
| Typed client | `updateAgent(id, body)` — `frontend/src/api/coordination.ts:35` |
| UI | **No caller anywhere in `frontend/src`** |

No new data shape, schema, CLI, or API change is required.

## 2. Verified behaviour

Probed against a throwaway database, not inferred.

| # | Action | Result |
| --- | --- | --- |
| 1 | Retire an agent **with an active session** | **Refused** — `agent_has_active_sessions`, "Agent busy cannot be deactivated while sessions are active" |
| 2 | Retire once its sessions are ended | **Succeeds** |
| 3 | Retired agent starts a session | **Refused** — `inactive_actor`, "Agent busy is not active" |
| 4 | Retired agent claims a task | **Refused** — `inactive_actor` |
| 5 | Retired agent is **assigned a new task** | **Allowed.** No guard. |
| 6 | Existing assignments after retirement | **Retained** — nothing is removed |
| 7 | Set status back to `active` | **Succeeds.** Retirement is reversible. |

### The guard the operator asked for already exists

Case 1 is exactly the requested constraint — "an agent that doesn't have any
active sessions" — and the CLI enforces it independently at the only layer that
can be authoritative. The UI's job is not to reimplement it but to **surface it
before the operator commits**, the same way `UI-28` surfaces the claim-owner
rule rather than letting a submit fail.

### The two findings that shape the copy

**Retirement is not deletion, and the word invites that misreading.** Cases 6
and 7: assignments are retained and the change is reversible. Nothing is
destroyed. The confirmation must say so, because an operator who believes this
deletes an agent will avoid it and leave stale identities in place — which is
how we got here.

**Retirement does not stop the agent being assigned new work** (case 5). This
is the `SEC-1` failure in one line: `codex-security` was retired, kept its
assignment on `SEC-1`, and the reconcile step sat with an identity that could
not act. Retiring an agent that still owns work quietly manufactures that
state.

So the confirmation must show **what the agent still owns** before it acts.
That single disclosure would have prevented `SEC-1`'s blocker.

## 3. Entry point

The **Agents inspector**, from `ux-entity-inspectors-spec.md`. One control in
the footer, beside the status metric:

```text
Status  Active                        [ Retire agent… ]
```

Not offered from the table row: retirement needs the agent's session state and
its outstanding assignments, and the inspector is where both are already in
context.

For an already-retired agent the control reads `Restore to active`, because
case 7 proves the change is reversible and hiding that makes retirement feel
more final than it is.

## 4. The confirmation

Consequence-focused, per §5.7's rule against a generic *Are you sure?*

```text
┌──────────────────────────────────────────────┐
│ Retire Mikhail · mikhail-ux                  │
│                                              │
│ A retired agent cannot start a session or    │
│ claim work. Nothing is deleted, and you can  │
│ restore it to active at any time.            │
│                                              │
│ ⚠ Still assigned to 4 tasks                  │
│   UX-1 · UX-7 · UX-12 · UX-13                │
│   Retiring does not unassign them. Work left │
│   with a retired agent cannot be picked up   │
│   until someone else is assigned.            │
│                                              │
│ Acting as Local Operator · session …         │
│                                              │
│              [ Cancel ]  [ Retire agent ]    │
└──────────────────────────────────────────────┘
```

### The outstanding-work disclosure

Computed from the already-loaded task list — no new query. Task IDs link to
their records so the operator can reassign first if they choose.

It is a **warning, not a block**. Mikhail's sign-off is the case that proves
retiring with work outstanding can be correct: the tasks were deliberately
released for an incoming agent. But the operator should choose it, not
discover it.

If `UI-28` has shipped, offer `Reassign first` beside `Retire agent`, linking
to the first task. Otherwise the linked IDs are enough.

### The active-session precondition

When the agent has active sessions, `Retire agent` is **disabled** with the
reason stated inline rather than surfaced as a failed submit:

> **`david` has 1 active session.**
> A session must end before its agent can be retired. Sessions end when their
> agent stops, or through recovery from Health.

Listing the blocking sessions with their last-seen age reuses `UI-22`'s
staleness presentation, and links to Sessions.

The CLI still enforces this independently. The UI is not the guard; it is the
explanation.

## 5. Submitting

1. One call: `POST /api/agents/{id}` with `status: "inactive"` and the acting
   actor. No revision parameter exists on this endpoint — unlike tasks, agents
   carry no optimistic revision, so there is no stale-revision path to handle.
2. Pending state disables the control against duplicate submission.
3. On success: refresh the agent list, announce via the live region — "Mikhail
   is retired. It can no longer start sessions or claim work." — and the
   inspector's status metric flips to `Retired`.
4. On failure the dialog stays open with the error and no automatic retry.

### Error copy, mapped to stable codes

| Code | Copy |
| --- | --- |
| `agent_has_active_sessions` | "`{name}` still has an active session. End it, or recover it from Health, then retire the agent." |
| `not_found` | "`{id}` no longer exists. Refresh the agent list." |
| `inactive_actor` | "The actor you are acting as is retired and cannot make this change. Choose an active actor." |

Branch on `error.code`, never message text.

## 6. Guardrails

- **Never offer retirement of the agent the operator is currently acting as.**
  Retiring your own actor disables your ability to act, and case 3 means you
  could not start a session to undo it. The control is replaced with: "You are
  acting as this agent. Switch to another actor to retire it."
- **Never offer retirement of `local-operator`.** It is bootstrapped at startup
  and the console depends on it existing and being active; `UI-4` recreates it
  and would fight the change.
- Retirement is not offered in bulk. It is per-agent and deliberate.

## 7. Accessibility

- Dialog traps focus and returns it to `Retire agent…` on close, matching the
  broadcast composer and `UI-22`.
- The disabled state's reason is accessible text, not a tooltip alone.
- The outstanding-work warning is in the accessible name of the confirm action,
  so a screen-reader operator hears the consequence before activating it.
- Status conveyed by glyph and text, never colour alone.

## 8. Acceptance

1. An operator can retire an agent with no active sessions from the Agents
   inspector, and restore it to active.
2. With active sessions present, the control is disabled with the blocking
   sessions named and their last-seen age shown — before submission.
3. The confirmation states that nothing is deleted and the change is
   reversible.
4. The confirmation lists every task the agent is still assigned to, linked,
   and proceeds if confirmed.
5. Retiring the current acting actor, and retiring `local-operator`, are not
   offered.
6. Each error code renders its mapped copy; no automatic retry.
7. Attribution shows the acting actor and session; the audit log records it.
8. Keyboard, focus return, 200% zoom, reduced motion, WCAG 2.2 AA verified.
9. No package data-shape, schema, CLI, or API change.
10. Tests cover: successful retirement, refusal with an active session,
    outstanding-assignment warning, restore to active, and the self-retirement
    and `local-operator` guards.

## 9. What this does not do

Does not delete an agent, unassign its work, end its sessions, or alter any
record it authored. Does not authorise release. A retired agent's history,
decisions, reviews, and messages remain exactly as recorded, because attribution
must stay stable — the point of retirement is that the identity stops acting,
not that it stops having acted.
