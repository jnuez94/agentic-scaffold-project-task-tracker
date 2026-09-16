# UX Spec — Operator Reassignment of Work

| Field | Value |
| --- | --- |
| Companion | `ux-visual-interaction-spec.md` §5.3, §5.6, §9 |

## 1. What the CLI allows and refuses

These are the rules of `task assign`, and they drive the whole design.

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

- **(1)** lets work be handed to an identity that cannot act. A picker that
  offers retired identities without saying so makes that failure easy.
- **(7)** silently manufactures a health finding. `unowned_tasks` is a
  first-class section on Health, and the console would be creating those
  findings without ever saying it was about to.
- **(2)** is a refusal the operator cannot predict from the UI, because
  assignee and claim owner are different things displayed in different places.

## 2. Users and the job

**Local operator**, reassigning because an assignee is retired, unavailable,
wrong, or because work needs an additional owner. They need to see who holds
the task now, who can legitimately hold it, and what their change will do —
before it happens.

This is explicitly **not** claiming. Assignment says who is responsible; a
claim says who is actively working under a session. The visual spec §9 already
requires distinguishing them, and this feature must not blur it.

## 3. Entry points

1. **Task inspector → Overview → Assignees** — a `Change assignees` control
   beside the field. This is the primary path: the operator is already looking
   at the task and its current owners.
2. **Health → Unowned tasks** — the finding already deep-links to the task. No
   separate entry; the link lands on the inspector where the control lives.

Reassignment is not offered from the queue row. That is a deliberate friction,
not a data limitation: the row carries every value reassignment needs —
`revision`, `assignees`, `claimed_by`, `claim_session_id` and `status` — but
reassignment is an accountability change, and the inspector is where the
operator can see who currently holds the claim, what the task is blocked on,
and what they are taking from or giving to someone. A row-level control would
offer the same mutation with none of that context in view.

## 4. The panel

Opens inline in the inspector, not as a modal. The operator must keep seeing
the task while deciding.

```text
┌──────────────────────────────────────────────┐
│ Change assignees                          ✕  │
│                                              │
│ Currently assigned                           │
│  ⬤ Priya · priya-be                   Remove │
│  ⬤ Release Bot · release-bot          Remove │
│  ○ Sam · sam-qa — retired             Remove │
│                                              │
│ Add someone                                  │
│  [ Choose an agent…                      ▾ ] │
│                                              │
│ ── Result ─────────────────────────────────  │
│ priya-be, release-bot                        │
│ Removing: sam-qa (retired)                   │
│                                              │
│ Acting as Local Operator · session …         │
│ Revision 10                                  │
│                                              │
│            [ Cancel ]  [ Save assignees ]    │
└──────────────────────────────────────────────┘
```

### Current assignees

Each row uses the console's actor-picker treatment: `Name · id`, with
`— retired` appended for inactive agents. The id is what disambiguates, and
this feature is where that matters most — two agents can share a display name
and differ only by id.

Status is shown with a glyph plus text, never colour alone (§4).

### The claim owner cannot be removed

When an assignee holds the active claim, their `Remove` is disabled with an
inline explanation rather than a failed submit:

> **`priya-be` holds the active claim on this task.**
> Releasing or recovering the claim comes first — reassigning cannot take work
> away from a session that is still holding it.

This mirrors error 2 as a *precondition* instead of letting the operator
discover it after submitting. The CLI still enforces it independently; the UI
simply stops wasting the operator's attempt.

### Adding someone

A `<select>` grouped as the console's actor pickers are:

- Active agents, selectable.
- A `Retired — cannot be assigned` group, disabled.

The CLI permits assigning to a retired agent (case 1). The console will not:
work assigned to a retired identity cannot be picked up, and nothing on the
board says so. Anyone who genuinely needs it still has the CLI; the console
should not make the failure mode easy.

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

Not a blocker. Deliberately unassigning is legitimate — an agent signing off
may release its tasks so a successor can claim them explicitly. But the console
should say what it is about to create.

## 5. Submitting

1. `Save assignees` is disabled until at least one add or remove is pending.
2. Submit sends `add`, `remove`, `actor`, and `if_revision` in one call. Never
   two calls — a remove that succeeds and an add that fails would leave the
   task in a state the operator never asked for.
3. Pending state disables the control to prevent duplicate submission.
4. On success: the inspector refreshes, the new revision is shown, and an
   `aria-live="polite"` announcement states the change — "Assignees updated.
   Now: priya-be, release-bot. Revision 11."
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

## 6. Attribution

The panel footer names the acting actor, the active session, and the revision
being submitted, matching the existing inspector footer. Assignment is an
accountable act and the audit log records it.

The CLI accepts a sessionless assign (case 8). The console should still send
its session when one is selected, so the audit entry carries it. If no session
is selected, the action stays available — this is not a claim — but the footer
says attribution will record the actor only.

## 7. Accessibility

- The panel is a labelled region; focus moves to its heading on open and
  returns to `Change assignees` on close.
- Full keyboard operation; `Escape` closes and discards with no silent loss —
  if a change is pending, confirm before discarding.
- Disabled `Remove` controls carry their reason as accessible text, not a
  tooltip alone (§8: hover must not be the only way to reveal something
  required).
- Status conveyed by glyph and text as well as colour.
- Success and failure announced through the existing live region.

## 8. What this does not do

- Does not claim, release, or recover. Those are the session-recovery and
  claim controls.
- Does not change task status.
- Does not create or delete agents.
- Does not bypass the claim-owner rule; it surfaces it earlier.
- Introduces no package data-shape, schema, CLI, or API change.

## 9. Acceptance

1. An operator can remove a retired assignee from a task without leaving the
   console.
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
