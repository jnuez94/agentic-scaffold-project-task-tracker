# agentic-scaffold-project-task-tracker

A local web console for the coordination database that
[agentic-project-scaffold-lite](https://github.com/jnuez94/agentic-project-scaffold-lite)
keeps at `.coordination/coordination.sqlite3`.

It shows what the coordination CLI shows — tasks, agents, sessions, evidence,
dependencies, reviews, decisions, messages, artifacts, escalations, health, and
the audit log — and lets an operator act on it from a browser.

## Running it

Requires Python 3.10+. No third-party packages, no build step, no network.

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
  launcher.py  startup orchestration
```

One class per file, every file under 200 lines, every class and function under
test.

## Tests

```bash
python3 -m unittest discover -s tests -t .
```

425 tests. Each one that needs a database creates a throwaway project with
`coordination init`; nothing in the suite touches
`.coordination/coordination.sqlite3`.

Tests that need the CLI skip themselves when it is not installed, so the suite
still runs in a checkout without the scaffold.

## Design documents

- [`.documents/coordination-console-design.md`](.documents/coordination-console-design.md)
  — architecture of record: component diagrams, request sequences, data model,
  security model, testing strategy.
- [`.documents/ux-visual-interaction-spec.md`](.documents/ux-visual-interaction-spec.md)
  — selected UX direction (owner: `mikhail-ux`).
- [`.documents/ux-data-shape-and-workflow-spec.md`](.documents/ux-data-shape-and-workflow-spec.md)
  — data shapes and workflows behind that direction.

## Status

The backend is complete and tested. The React/TypeScript frontend (`UI-2`) is
specified and architecturally reviewed but not yet implemented;
`coordination_ui/static/` currently holds a placeholder. Until it lands, the
JSON API is usable directly:

```bash
curl -s http://127.0.0.1:8787/api/tasks | python3 -m json.tool
```
