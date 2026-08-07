# agentic-scaffold-project-task-tracker

A local web console for the coordination database that
[agentic-project-scaffold-lite](https://github.com/jnuez94/agentic-project-scaffold-lite)
keeps at `.coordination/coordination.sqlite3`.

It shows what the coordination CLI shows — tasks, agents, sessions, evidence,
dependencies, reviews, decisions, messages, artifacts, escalations, health, and
the audit log — and lets an operator act on it from a browser.

## Requirements

Two things, and the second is the one people miss:

| | |
| --- | --- |
| Python | 3.10 or newer |
| coordination CLI | `>=1.2.0,<2.0.0`, from [agentic-project-scaffold-lite](https://github.com/jnuez94/agentic-project-scaffold-lite) |

This console is a **view onto a coordination database; it is not a coordination
tool on its own.** Every read and every write is performed by the coordination
CLI, so without one installed there is nothing here to run. It is looked for at
`.agents/agentic-project-scaffold-lite/bin/coordination` inside the project, and
`COORDINATION_BIN` overrides that with any other install.

Startup checks the CLI and schema versions it finds and refuses to serve an
installation it does not support, naming what it found and what it needs, so a
mismatch is one line at launch rather than confusing behaviour later.

No third-party Python packages, no build step, no network.

## Running it

```bash
python3 -m coordination_ui
```

Then open <http://127.0.0.1:8787/>. Stop with Ctrl-C.

| Option | Default | Meaning |
| --- | --- | --- |
| `--db PATH` | nearest project | Serve a specific `coordination.sqlite3` |
| `--host ADDR` | `127.0.0.1` | Loopback address to bind; non-loopback is refused |
| `--port N` | `8787` | Port to bind |
| `--timeout SECONDS` | `30` | Per-command CLI timeout |
| `--open` | off | Open the console in your browser once it is up |

Startup runs `version` and `doctor` before binding, so a broken installation
reports the CLI's own diagnostic on the terminal instead of surfacing as a 500
on your first click.

`COORDINATION_BIN` overrides which `coordination` executable is used.

## How it talks to the database

`AGENTS.md` forbids editing `.coordination/coordination.sqlite3` directly, and
this console does not.

```
browser  ->  coordination_ui  ->  bin/coordination  ->  coordination.sqlite3
                     |
                     +--------->  read-only connection (audit log, dashboard counts)
```

**Every write, and nearly every read, is a subprocess call to
`bin/coordination`.** The CLI keeps sole responsibility for validation,
locking, revision checks, transition rules, and audit attribution. Its stable
`error.code` is passed through to the browser unchanged, and its exit code
determines the HTTP status:

| Exit | HTTP | Examples |
| ---: | ---: | --- |
| 2 | 400 | `invalid_arguments`, `session_required`, `task_claim_required` |
| 3 | 404 | `not_found` |
| 4 | 409 | `stale_task_revision`, `task_already_claimed`, `invalid_task_transition` |
| 5 | 500 | `configuration_error`, `database_corrupt` |
| 6 | 503 | `database_busy` |

Two reads have no CLI equivalent — the audit timeline and the dashboard
aggregate counts — so they open SQLite directly. Those connections are opened
`mode=ro` **and** pinned with `PRAGMA query_only = ON`; the test suite asserts
that `INSERT` and `DROP` are both refused through them.

`backup`, `restore`, and `init` are intentionally not exposed. They are
destructive or filesystem-publishing operations whose failure modes need an
operator reading exit codes at a terminal, not a browser button. Run them with
the CLI.

## Identity

Every mutation needs an accountable actor, and some need an active session:

- `task claim` always requires a session.
- Leaving `in_progress` requires the acting actor *and* session to own the claim.

The console sends the active session in an `X-Coordination-Session` header
rather than in each request body, so no form can disagree with the header bar.

## Security model

The CLI contract's environment is one machine with trusted local OS users, so
the console does not authenticate. What it does enforce:

- Binds loopback only; a non-loopback `--host` is refused rather than warned about.
- Requires a loopback `Host` header, which blocks a hostile domain resolving to
  127.0.0.1 from driving the API through your browser.
- Requires `Content-Type: application/json` on POST. An HTML form cannot set
  that without a CORS preflight, and no CORS headers are ever sent.
- Serves under `default-src 'none'; script-src 'self'`, so the page has no
  network path to any other origin.
- Resolves static paths and then re-checks containment, defeating traversal and
  symlink escapes.
- Caps request bodies at 2 MiB from the `Content-Length` header alone.

**Residual risk, stated plainly:** any process running as your OS user can reach
the port and mutate coordination state as any actor it names. That is the same
authority the CLI already grants that user. The console does not widen it and
does not defend against a hostile local user. Do not put secrets, credentials,
customer data, or regulated data into coordination records.

## Layout

```
coordination_ui/
  cli/         subprocess bridge; the only code that runs bin/coordination
  discovery/   resolves which project, database, and executable to use
  readonly/    query_only SQLite for the audit log and dashboard counts
  api/         route table; one handler per documented CLI command
  web/         loopback HTTP server, security policy, static serving
  static/      the built frontend bundle (committed)
  launcher.py  startup orchestration
frontend/
  src/api/     typed client and the row types mirrored from the contract
  src/lib/     transition rules, labels, formatting, filtering
  src/state/   identity, hash routing, resource loading
  src/views/   task queue, inspector, entity browsers, health, audit, export
  src/styles/  Flowline design tokens and per-concern stylesheets
```

One class per file, every class and function under test. Files are held under
200 lines; six views currently exceed it and are tracked for splitting rather
than silently exempted.

## Tests

```bash
python3 -m unittest discover -s tests -t .
```

469 Python tests, plus 543 frontend tests via `npm test` in `frontend/`. Each
one that needs a database creates a throwaway project with `coordination init`;
nothing in the suite touches `.coordination/coordination.sqlite3`.

Tests that need the CLI skip themselves when it is not installed, so the suite
still runs in a checkout without the scaffold.

## Design documents

[`docs/`](docs/README.md) holds the design record for what actually ships:

- [`docs/coordination-console-design.md`](docs/coordination-console-design.md)
  — architecture of record: component diagrams, request sequences, data model,
  security model, testing strategy.
- [`docs/ux-data-shape-and-workflow-spec.md`](docs/ux-data-shape-and-workflow-spec.md)
  — what each entity contains, and which workflows the CLI can honestly support.
- [`docs/ux-visual-interaction-spec.md`](docs/ux-visual-interaction-spec.md)
  — the Flowline visual system: tokens, states, responsive and accessibility rules.
- [`docs/ux-entity-inspectors-spec.md`](docs/ux-entity-inspectors-spec.md)
  — the record inspector on every entity table.
- [`docs/ux-reassign-work-spec.md`](docs/ux-reassign-work-spec.md)
  — operator reassignment of task assignees.
- [`docs/ux-retire-agent-spec.md`](docs/ux-retire-agent-spec.md)
  — operator retirement and restoration of an agent.

Working material — audits, QA captures, research, superseded directions — stays
in `.documents/` and is not tracked.

## The frontend

A React 19 + TypeScript console, bundled by Vite into `coordination_ui/static/`
and committed, so a clean checkout runs with Python alone.

Working on it needs Node:

```bash
cd frontend && npm install && npm run dev
```

`npm run dev` serves on :5173 and proxies `/api` to the Python server on :8787,
so you get hot reload against a real database. `npm run build` regenerates the
committed bundle — do that whenever frontend sources change.

```bash
cd frontend && npm test
```

62 unit tests over the API client, error mapping, transition rules, labels, and
identity storage.

Three things the UI deliberately does *not* do, because the CLI cannot back
them honestly:

- it reports "N loaded", never "N of M" — list results carry no total count;
- its filter box says "Filter loaded rows", not "Search";
- it has no per-task Messages tab — `message list` filters by recipient only.

The audit view is the exception: it shows a real total, because that read
computes an unpaged `COUNT` alongside the page.
