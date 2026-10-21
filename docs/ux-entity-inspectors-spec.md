# UX Spec — An Inspector for Every Listed Entity

| Field | Value |
| --- | --- |
| Companion | `ux-visual-interaction-spec.md` §3, §6, §9 |

The tables show a fraction of what each record holds, and the hidden fields are
not incidental metadata. They are, almost exactly, the fields that state what
each record **authorises and forbids**:

- **Agent** — `decision_authority`, `review_authority`, `escalation_rules`,
  `unavailable_for`, `responsibilities`, `operating_style`
- **Review** — `accepted_items`, `required_changes`, `remaining_risks`,
  `blocked_claims`, `follow_up_tasks`
- **Decision** — `context`, `options_considered`, `implications`, `evidence`,
  `blocked_claims`, `review_required`
- **Escalation** — `issue`, `resolution`, `needed_by`, `related_tasks`,
  `follow_up_tasks`
- **Artifact** — `usage_boundaries`, `reviewers`, `related_tasks`

A console that records a constraint and cannot display it is worse than one
that never recorded it, because everyone believes the constraint is
communicated. The inspector is where those fields become readable.

## 1. The rule that shapes the whole design

**An inspector opened from a row renders the row the table already holds.**
List responses are complete records, not thin rows, so everything the inspector
shows is in memory the moment the table renders. Opening one from a row issues
no request.

Two reads exist for what the loaded row cannot answer, and each is used only
there:

- **`show`** resolves a link to a record that is not in the loaded window. Every
  inspected entity has one — agent, session, review, decision, message,
  artifact, escalation, and task. Evidence and dependencies do not.
- **`history`** feeds the Activity tab, read when that tab is opened: the
  record's audit rows, newest first.

## 2. Shared inspector shell

One component, entity-specific content. It reuses the existing task-inspector
shell so nothing new is invented visually.

```text
┌────────────────────────────────────────────┐
│ decision                              ✕    │  ← entity kind, mono, text-400
│ DEC-17                                     │  ← record id, mono
│ Adopt the ledger layout for the queue…     │  ← heading-lg, title if any
├────────────────────────────────────────────┤
│ Status   Owner        Recorded             │  ← metric row, entity-specific
│ accepted ops-lead     2h ago               │
├────────────────────────────────────────────┤
│ ⚠ What this does not authorise             │  ← constraint block, first
│   Layout only. Not a visual sign-off…      │
│                                            │
│ Context                                    │  ← remaining fields, ordered
│ …                                          │
├────────────────────────────────────────────┤
│ Recorded by ops-lead · 2026-01-14          │  ← diagnostic footer, mono
└────────────────────────────────────────────┘
```

### Rules that apply to every entity

1. **Read-only by default.** No control implies an edit or a delete the CLI
   does not offer. The exceptions are each a transition or correction the CLI
   supports, offered only where it would be accepted: session recovery, agent
   retirement and restoration (`ux-retire-agent-spec.md`), a decision's status,
   and an artifact's status and record correction. None rewrites what a record
   says it decided.
2. **Constraint first.** Whatever field states what the record does *not*
   authorise renders directly beneath the metric row, before descriptive
   content — `blocked_claims`, `usage_boundaries`, `unavailable_for`. The task
   inspector already does this, promoting *Why this is blocked* above
   Description.
3. **Absence is meaningful for constraint fields.** An empty `blocked_claims`
   renders `None recorded` rather than being omitted. For descriptive fields,
   omit empties entirely rather than printing blank labels.
4. **Cross-link every identifier.** `task_id` and `related_tasks` link to
   `#/tasks/{id}`; `reviewer_id`, `owner_id`, `raised_by`, `agent_id` link to
   the agent record; `artifact_uri` renders as text, never a clickable link,
   because it is a repository path and not a resolvable URL.
5. **Long text wraps and stays selectable.** These fields are paragraphs; no
   truncation inside the inspector. Truncation in the table is fine — that is
   what the inspector is for.
6. **No invented state.** No read receipts, no "last viewed", no counts the
   API does not return.

## 3. Per-entity layout

Order is deliberate. Constraint block first, then what the operator most needs.

### Agents

```text
Metrics:  Type · Status · Updated
Constraint: Unavailable for
Then:     Role, Goal, Responsibilities, Decision authority,
          Review authority, Escalation rules, Operating style
Footer:   id · created
```

Status shows `Active` / `Retired` with glyph and text, matching the actor
pickers. This inspector is where an operator answers "what is this agent
allowed to decide".

### Decisions

```text
Metrics:  Status · Owner · Updated
Constraint: Blocked claims  →  "What this does not authorise"
Then:     Decision, Context, Options considered, Implications,
          Evidence, Review required
Footer:   id · created
```

`Decision` before `Context` — the operator opened this to read the ruling, not
the preamble.

### Reviews

```text
Metrics:  Decision · Reviewer · Task · Created
Constraint: Blocked claims  →  "What this review does not approve"
Then:     Scope, Accepted items, Required changes, Remaining risks,
          Follow-up tasks
Footer:   id · artifact URI
```

`Required changes` and `Remaining risks` are the reason a conditional
acceptance is conditional, and neither is visible in the table.

### Escalations

```text
Metrics:  Status · Owner · Raised by · Needed by
Constraint: (none in the shape)
Then:     Issue, Requested decision, Resolution, Related tasks,
          Follow-up tasks
Footer:   id · raised · updated
```

Resolution renders only when present; an open escalation shows
`Not yet resolved` rather than an empty field, because that absence is the
point of the record.

### Artifacts

```text
Metrics:  Status · Type · Owner · Updated
Constraint: Usage boundaries
Then:     URI, Related tasks, Reviewers
Footer:   id · created
```

### Sessions

```text
Metrics:  Status · Agent · Harness · Model
Then:     Started, Last seen (with age), Ended
Action:   Recover…  (existing control, unchanged)
Footer:   id
```

Sessions hide only one field, so this inspector earns its place through the
last-seen age and the recovery entry point rather than hidden content. The
existing recovery predicate decides where the control appears, so it is offered
only where the CLI would accept it.

### Audit log — no inspector

Audit rows are already complete in the table. Instead, link `object_id` to its
record where a route exists. An inspector would add a click and reveal nothing.

### Health — not applicable

Health is a findings list whose entries already link to their records.

## 4. Interaction

- Selecting a row opens the inspector beside the table, matching the Tasks and
  Messages layout at ≥1280px; below that it becomes an overlay, as those two
  already do.
- Selection is reflected in the row and survives sorting and filtering of
  loaded rows.
- Opening a record writes its id into the URL — `#/decisions/{id}` and the
  equivalent for every inspected entity — so the address bar always holds a
  link to what is open. Arriving by link opens the inspector from the loaded
  window when the record is there and through `show` when it is not; an id
  that does not exist renders a not-found banner and no inspector.
- `Escape` closes the topmost layer only: a sheet before the inspector beneath
  it. Closing an inspector returns focus to the row that opened it, or to the
  page heading when no row did.

## 5. Accessibility

- The panel is a labelled region; focus moves to its heading on open and back
  to the row on close, matching `MessageInspector`.
- Every field label is programmatically associated with its value.
- Constraint blocks are not conveyed by colour alone — glyph plus the heading
  *What this does not authorise*.
- Long fields remain reachable and selectable at 200% zoom.
- One live-region announcement per selection: entity kind and id.

## 6. Acceptance

1. Every entity with a table — Agents, Sessions, Reviews, Decisions,
   Artifacts, Escalations — opens an inspector from a row.
2. Every field present in the list response renders, or is deliberately and
   documentedly omitted. No field that states an authority or constraint is
   hidden.
3. Opening an inspector from a row issues **no** request. Only a link to an
   unloaded record (`show`) and the Activity tab (`history`) read.
4. Constraint fields render first, and render `None recorded` when empty.
5. Identifier cross-links resolve; `artifact_uri` is not a link.
6. No control implies an edit, delete, or state schema v1 does not have.
7. Every inspected entity has a link route that survives refresh; evidence and
   dependencies, which have no `show`, have none.
8. Keyboard operation, focus return, 200% zoom, reduced motion, and WCAG 2.2 AA
   contrast verified.
9. No package data-shape, schema, or CLI change.
10. Tests cover: a record with every field populated, a record with empty
    constraint fields, cross-link resolution, and focus return on close.

## 7. What this does not do

Does not introduce editing of governance records beyond the transitions and
corrections in §2, or add links the CLI cannot resolve. It makes recorded
information readable.
