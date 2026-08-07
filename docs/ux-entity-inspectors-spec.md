# UX Spec — An Inspector for Every Listed Entity

| Field | Value |
| --- | --- |
| Status | Implemented in `UI-29`; UX review accepted as `UX-UI29-QA-1` |
| Owner | `michael-ux` — UX Designer |
| Tracked by | `UX-17`; implementation in `UI-29` |
| Candidate | Field inventory taken against `d4e1adc` on the live database |
| Companion | `ux-visual-interaction-spec.md` §3, §6, §9 |

## 1. The problem, measured

Two of the nine listed entities have an inspector. Tasks has one; Messages got
one in `UI-9`. The other seven are tables only, and the tables show a fraction
of what each record holds.

| Entity | Fields in the record | Columns in the table | Hidden |
| --- | ---: | ---: | ---: |
| Agents | 14 | 6 | **8** |
| Decisions | 13 | 5 | **8** |
| Reviews | 12 | 6 | **6** |
| Escalations | 12 | 6 | **6** |
| Artifacts | 10 | 5 | **5** |
| Sessions | 8 | 7 | 1 |
| Messages | 7 | 6 | *has an inspector* |
| Tasks | — | — | *has an inspector* |

The hidden fields are not incidental metadata. They are, almost exactly, the
fields that state what each record **authorises and forbids**:

- **Agent** — `decision_authority`, `review_authority`, `escalation_rules`,
  `unavailable_for`, `responsibilities`, `operating_style`
- **Review** — `accepted_items`, `required_changes`, `remaining_risks`,
  `blocked_claims`, `follow_up_tasks`
- **Decision** — `context`, `options_considered`, `implications`, `evidence`,
  `blocked_claims`, `review_required`
- **Escalation** — `issue`, `resolution`, `needed_by`, `related_tasks`,
  `follow_up_tasks`
- **Artifact** — `usage_boundaries`, `reviewers`, `related_tasks`

### Why this is a governance defect, not a convenience gap

The product's stated purpose is making agent activity understandable and
interruptible by a human operator, and this project records authority
boundaries obsessively — every task carries `blocked_claims`, every decision
its `implications`, every review what it does *not* approve.

None of that is readable in the console.

Two live examples, both recorded today, both invisible:

- `REL1-NIKKI-BRAND-DISPOSITION-1` carries `required_changes` reading *do not
  market, publish, file, acquire domains for, or externally announce Cernaria*.
  An operator browsing Reviews sees the decision chip and the reviewer. The
  constraints do not render anywhere.
- `SEC-OWNER-2` carries `blocked_claims` stating it is **not** a security
  sign-off and that nobody may close `SEC-1` on Toby's behalf. An operator
  browsing Decisions sees a title and a status.

A console that records a constraint and then cannot display it is worse than
one that never recorded it, because everyone believes the constraint is
communicated.

## 2. The constraint that shapes the whole design

**`task` is the only entity with a `show` command.** Verified against the CLI:

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

Fortunately the list responses are **complete records**, not thin rows: 14
fields for an agent, 13 for a decision. Everything the inspector needs is
already in memory the moment the table renders. Nothing here needs a new
endpoint, data shape, schema, CLI, or API change.

## 3. The seam already exists

`RecordsView` already accepts `onSelect` and `selectedKey`, with the comment:

> Receives the already-loaded row, so a detail view needs no extra query.

Today no generic route passes them. The plumbing was built for this and is
unused.

## 4. Shared inspector shell

One component, entity-specific content. It reuses the existing task-inspector
shell so nothing new is invented visually.

```text
┌────────────────────────────────────────────┐
│ decision                              ✕    │  ← entity kind, mono, text-400
│ SEC-OWNER-2                                │  ← record id, mono
│ Complete SEC-1 sole ownership…             │  ← heading-lg, title if any
├────────────────────────────────────────────┤
│ Status   Owner        Recorded             │  ← metric row, entity-specific
│ accepted michael-ux   2h ago               │
├────────────────────────────────────────────┤
│ ⚠ What this does not authorise             │  ← constraint block, first
│   Ownership only. Not a security review…   │
│                                            │
│ Context                                    │  ← remaining fields, ordered
│ …                                          │
├────────────────────────────────────────────┤
│ Recorded by michael-ux · 2026-07-27        │  ← diagnostic footer, mono
└────────────────────────────────────────────┘
```

### Rules that apply to every entity

1. **Read-only by default.** Schema v1 offers no edit or delete for these
   records, so no control implies one. Three deliberate exceptions: session
   recovery (`UI-22`, existing), artifact status (existing), and agent
   retirement (`ux-retire-agent-spec.md`, which the Agents inspector hosts).
   Each is a state transition the CLI already supports — none is record
   editing.
2. **Constraint first.** Whatever field states what the record does *not*
   authorise renders directly beneath the metric row, before descriptive
   content — `blocked_claims`, `usage_boundaries`, `unavailable_for`. This
   follows `UI-25`, where promoting *Why this is blocked* above Description was
   the change that mattered.
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

## 5. Per-entity layout

Order is deliberate. Constraint block first, then what the operator most needs.

### Agents

```text
Metrics:  Type · Status · Updated
Constraint: Unavailable for
Then:     Role, Goal, Responsibilities, Decision authority,
          Review authority, Escalation rules, Operating style
Footer:   id · created
```

Status shows `Active` / `Retired` with glyph and text, matching `UI-21`. This
inspector is where an operator answers "what is this agent allowed to decide",
which is currently unanswerable in the UI.

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
acceptance is conditional, and neither is visible today.

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
Action:   Recover…  (existing UI-22 control, unchanged)
Footer:   id
```

Sessions hide only one field, so this inspector earns its place through the
last-seen age and the recovery entry point rather than hidden content. Reuse
`UI-22`'s existing predicate so the control appears only where the CLI would
accept it.

### Audit log — no inspector

Audit rows are already complete in the table. Instead, link `object_id` to its
record where a route exists. An inspector would add a click and reveal nothing.

### Health, Export — not applicable

Health is a findings list, already linked in `UI-24`. Export is a generated
document.

## 6. Interaction

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

## 7. Accessibility

- The panel is a labelled region; focus moves to its heading on open and back
  to the row on close, matching `MessageInspector`.
- Every field label is programmatically associated with its value.
- Constraint blocks are not conveyed by colour alone — glyph plus the heading
  *What this does not authorise*.
- Long fields remain reachable and selectable at 200% zoom.
- One live-region announcement per selection: entity kind and id.

## 8. Acceptance

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

## 9. What this does not do

Does not authorise release, add or change any endpoint, introduce editing of
governance records, or add deep links the CLI cannot resolve. It makes already
recorded and already loaded information readable.
