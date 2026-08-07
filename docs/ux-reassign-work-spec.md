# UX Spec — Operator Reassignment of Work

| Field | Value |
| --- | --- |
| Status | Implemented in `UI-28`; UX review accepted as `UX-UI28-QA-1` |
| Owner | `michael-ux` — UX Designer |
| Tracked by | `UX-16`; implementation in `UI-28` |
| Candidate | Behaviour probed against `d4e1adc` on a throwaway database |
| Companion | `ux-visual-interaction-spec.md` §5.3, §5.6, §9 |

## 1. Why this exists

`SEC-1` is assigned to `codex-security`, `security-file-review-f`, and `toby`.
`codex-security` is **inactive**, and `SEC-1`'s own note says its parent scan
must be reclaimed before the work can continue. The console cannot change that.
An operator looking at the blocker on the release critical path today has to
leave the application and use the CLI.

This is not a hypothetical convenience feature. It is the one workflow standing
between an operator and an escalation that is currently open
(`ESC-SEC1-OWNER-1`).

The capability is already plumbed and dead-ends at the UI, the same pattern as
stale-session recovery before `UI-22`:

| Layer | State |
| --- | --- |
| CLI | `coordination task assign <id> --actor --add --remove --if-revision` |
| HTTP API | `POST /api/tasks/{id}/assign` — `coordination_ui/api/routes/tasks.py:136` |
| Typed client | `assignTask(id, body)` — `frontend/src/api/coordination.ts:49` |
| UI | **No caller anywhere in `frontend/src`** |

No new data shape, schema, CLI, or API change is required by anything below.

## 2. Verified behaviour

Probed against a throwaway coordination database, not inferred from the
contract document. These results drive the whole design.

| # | Action | Result |
| --- | --- | --- |
| 1 | Add an **inactive** agent as assignee | **Allowed.** No guard at any layer. |
| 2 | Remove the **active claim owner** | **Refused** — `task_claim_owner_mismatch`, "The active claim owner cannot be removed from task assignees" |
| 3 | Submit a stale revision | **Refused** — `stale_task_revision`, "Task T-1 changed after revision 1" |
| 4 | Add an agent id that does not exist | **Refused** — `not_found`, "Not found: agent nobody" |
| 5 | Add and remove the same actor in one call | **Refused** — `invalid_arguments`, "Task assignment cannot add and remove the same actor" |
| 6 | Assign on a `done` task | **Allowed.** Assignment is not status-gated. |
| 7 | Remove every assignee | **Allowed.** Task is left with `assignees: []` and its status unchanged. |
| 8 | Assign with no active session | **Allowed** by the CLI. The route forwards the session for attribution but does not require one. |

Three of these are the design problem:

- **(1)** is how `SEC-1` got into its current state. A picker that offers
  retired identities without saying so reproduces the bug the console is
  already carrying.
- **(7)** silently manufactures a health finding. `unowned_tasks` is a
  first-class section on Health, and the console would be creating those
  findings without ever saying it was about to.
- **(2)** is a refusal the operator cannot predict from the UI, because
  assignee and claim owner are different things displayed in different places.

## 3. Users and the job

**Local operator**, reassigning because an assignee is retired, unavailable,
wrong, or because work needs an additional owner. They need to see who holds
the task now, who can legitimately hold it, and what their change will do —
before it happens.

This is explicitly **not** claiming. Assignment says who is responsible; a
claim says who is actively working under a session. The visual spec §9 already
requires distinguishing them, and this feature must not blur it.

## 4. Entry points

1. **Task inspector → Overview → Assignees** — a `Change assignees` control
   beside the field. This is the primary path: the operator is already looking
   at the task and its current owners.
2. **Health → Unowned tasks** — the finding already deep-links to the task
   (`UI-24`). No separate entry; the link lands on the inspector where the
   control lives.

**Correction (2026-07-28).** This section originally read: *"Not offered from
the queue row. Reassignment needs the current revision and the claim state, both
of which the inspector already has loaded."* The stated reason was factually
wrong, and David caught it while implementing `UI-36`. The task-list response
carries `revision`, `assignees`, `claimed_by`, `claim_session_id` and `status` —
everything reassignment needs. The row has the data; the inspector holds no
information the row lacks.

The decision to keep reassignment in the inspector still stands, but on a
different and honest basis: **it is a deliberate friction, not a data
limitation.** Reassignment is an accountability change, and the inspector is
where the operator can see who currently holds the claim, what the task is
blocked on, and what they are taking from or giving to someone. A row-level
control offers the same mutation with none of that context in view.

`UI-36` may therefore offer assignment from the row — the constraint was never
technical. What it must not do is offer it *without* the context that makes the
choice informed. Surfacing current assignee and claim owner in the row-level
affordance, and routing anything ambiguous to the inspector, is the shape that
keeps the friction where it earns its keep.

## 5. The panel

Opens inline in the inspector, not as a modal. The operator must keep seeing
the task while deciding.

```text
┌──────────────────────────────────────────────┐
│ Change assignees                          ✕  │
│                                              │
│ Currently assigned                           │
│  ⬤ Toby · toby                        Remove │
│  ⬤ Security File Review F ·  …        Remove │
│  ○ Toby · codex-security — retired    Remove │
│                                              │
│ Add someone                                  │
│  [ Choose an agent…                      ▾ ] │
│                                              │
│ ── Result ─────────────────────────────────  │
│ toby, security-file-review-f                 │
│ Removing: codex-security (retired)           │
│                                              │
│ Acting as Local Operator · session …         │
│ Revision 10                                  │
│                                              │
│            [ Cancel ]  [ Save assignees ]    │
└──────────────────────────────────────────────┘
```

### Current assignees

Each row uses the `agentOptionLabel` treatment from `UI-21`: `Name · id`, with
`— retired` appended for inactive agents. The id is what disambiguates, and
this feature is where that matters most — `SEC-1` carries two agents whose
display name is "Toby".

Status is shown with a glyph plus text, never colour alone (§4).

### The claim owner cannot be removed

When an assignee holds the active claim, their `Remove` is disabled with an
inline explanation rather than a failed submit:

> **`david` holds the active claim on this task.**
> Releasing or recovering the claim comes first — reassigning cannot take work
> away from a session that is still holding it.

This mirrors error 2 as a *precondition* instead of letting the operator
discover it after submitting. The CLI still enforces it independently; the UI
simply stops wasting the operator's attempt.

### Adding someone

A `<select>` grouped exactly as `UI-21` established:

- Active agents, selectable.
- A `Retired — cannot be assigned` group, disabled.

The CLI permits assigning to a retired agent (verified, case 1). The console
will not, because that is precisely how `SEC-1` reached a state where its
parent scan is owned by a deactivated identity. Anyone who genuinely needs it
still has the CLI; the console should not make the failure mode easy.

Already-assigned agents do not appear in the add list — that is how error 5
becomes unreachable rather than a message.

### Result preview

The panel states the resulting assignee set before submission, and names
removals explicitly. Reassignment is a multi-step edit committed in one call;
the operator should read the outcome, not reconstruct it.

### The unowned warning

If the pending change would remove every assignee, the preview replaces the
result line with:

> **This will leave the task unowned.**
> It will appear under *Unowned tasks* on Health until someone is assigned.

Not a blocker. Deliberately unassigning is legitimate — Mikhail did exactly
that when signing off, releasing four tasks so an incoming agent could claim
them explicitly. But the console should say what it is about to create.

## 6. Submitting

1. `Save assignees` is disabled until at least one add or remove is pending.
2. Submit sends `add`, `remove`, `actor`, and `if_revision` in one call. Never
   two calls — a remove that succeeds and an add that fails would leave the
   task in a state the operator never asked for.
3. Pending state disables the control to prevent duplicate submission.
4. On success: the inspector refreshes, the new revision is shown, and an
   `aria-live="polite"` announcement states the change — "Assignees updated.
   Now: toby, security-file-review-f. Revision 11."
5. On failure the draft is preserved and never retried automatically (§5.6).

### Error copy, mapped to stable codes

| Code | Copy |
| --- | --- |
| `task_claim_owner_mismatch` | "`{id}` holds the active claim and cannot be removed. Release the claim or recover the session that holds it, then try again." |
| `stale_task_revision` | "This task changed while you were editing. Reload latest; your draft will be preserved." |
| `not_found` | "`{id}` no longer exists as an agent. Refresh the agent list." |
| `invalid_arguments` | Show the CLI message. Should be unreachable given the constraints above; if it appears, the UI let through something it should have prevented. |

Branch on `error.code`, never on message text — the CLI contract is explicit
that codes are the stable surface.

## 7. Attribution

The panel footer names the acting actor, the active session, and the revision
being submitted, matching the existing inspector footer. Assignment is an
accountable act and the audit log records it.

The CLI accepts a sessionless assign (case 8). The console should still send
its session when one is selected, so the audit entry carries it. If no session
is selected, the action stays available — this is not a claim — but the footer
says attribution will record the actor only.

## 8. Accessibility

- The panel is a labelled region; focus moves to its heading on open and
  returns to `Change assignees` on close.
- Full keyboard operation; `Escape` closes and discards with no silent loss —
  if a change is pending, confirm before discarding.
- Disabled `Remove` controls carry their reason as accessible text, not a
  tooltip alone (§8: hover must not be the only way to reveal something
  required).
- Status conveyed by glyph and text as well as colour.
- Success and failure announced through the existing live region.

## 9. What this does not do

- Does not claim, release, or recover. Those are `UI-22` and the existing
  claim controls.
- Does not change task status.
- Does not create or delete agents.
- Does not bypass the claim-owner rule; it surfaces it earlier.
- Introduces no package data-shape, schema, CLI, or API change.

## 10. Acceptance

1. An operator can remove a retired assignee from a task without leaving the
   console — verified against a `SEC-1`-shaped case.
2. Retired agents cannot be *added*; already-assigned agents are not offered.
3. The active claim owner's `Remove` is disabled with a stated reason before
   submission, not after a failed call.
4. Removing the last assignee warns that the task will become unowned, and
   proceeds if confirmed.
5. Add and remove commit in exactly one call carrying the current revision.
6. Each error code above renders its mapped copy; `stale_task_revision`
   preserves the draft and offers `Reload latest`.
7. Attribution shows actor, session, and revision; the audit log records the
   assignment.
8. Keyboard, focus return, 200% zoom, reduced motion, and WCAG 2.2 AA contrast
   verified.
9. Tests cover: retired removal, claim-owner refusal, last-assignee warning,
   stale revision with draft preserved, and the combined add-and-remove call.
