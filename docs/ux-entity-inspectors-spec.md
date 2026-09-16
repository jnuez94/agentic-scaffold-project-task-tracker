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

## 1. The constraint that shapes the whole design

**`task` is the only entity with a `show` command.** In the CLI:

```text
task         {create,list,show,assign,update,claim,status,release}
agent        {add,list,update}
session      {start,list,heartbeat,end,recover}
review       {add,list}
decision     {add,list}
message      {send,list}
artifact     {add,list,status}
escalation   {add,list,resolve}
```

There is no detail fetch for anything except a task. So an inspector for these
entities **must render the row the table already holds** and issue no query of
its own.

This is not a limitation to work around — it is already the documented design
of `MessageInspector`:

> Renders the record the table already holds. It issues no query of its own, so
> opening a message cannot imply a per-task message thread — the CLI has no way
> to fetch one, and pretending otherwise would be a false affordance.

That reasoning generalises exactly. This spec extends an existing pattern
rather than inventing one.

The list responses are **complete records**, not thin rows, so everything the
inspector needs is already in memory the moment the table renders. Nothing here
needs a new endpoint, data shape, schema, CLI, or API change.

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

1. **Read-only by default.** Schema v1 offers no edit or delete for these
   records, so no control implies one. Three deliberate exceptions: session
   recovery (existing), artifact status (existing), and agent
   retirement (`ux-retire-agent-spec.md`, which the Agents inspector hosts).
   Each is a state transition the CLI already supports — none is record
   editing.
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

### Health, Export — not applicable

Health is a findings list whose entries already link to their records. Export
is a generated document.

## 4. Interaction

- Selecting a row opens the inspector beside the table, matching the Tasks and
  Messages layout at ≥1280px; below that it becomes an overlay, as those two
  already do.
- Selection is reflected in the row and survives sorting and filtering of
  loaded rows.
- The URL does **not** gain deep-link routes for these entities. Tasks has
  `#/tasks/{id}` because `task show` can resolve it on load; the others cannot
  be fetched individually, so a deep link would break on refresh. Selection is
  view state, not a route. This is a deliberate asymmetry and worth stating so
  nobody "fixes" it later.
- `Escape` closes and returns focus to the originating row.

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
3. The inspector issues **no** additional request; opening it works offline
   from the loaded row.
4. Constraint fields render first, and render `None recorded` when empty.
5. Identifier cross-links resolve; `artifact_uri` is not a link.
6. No control implies an edit, delete, or state schema v1 does not have.
7. Selection is view state; no deep-link route is added for list-only entities.
8. Keyboard operation, focus return, 200% zoom, reduced motion, and WCAG 2.2 AA
   contrast verified.
9. No package data-shape, schema, CLI, or API change.
10. Tests cover: a record with every field populated, a record with empty
    constraint fields, cross-link resolution, and focus return on close.

## 7. What this does not do

Does not add or change any endpoint, introduce editing of
governance records, or add deep links the CLI cannot resolve. It makes already
recorded and already loaded information readable.
