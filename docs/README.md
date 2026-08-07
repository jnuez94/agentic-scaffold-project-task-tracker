# Design documentation

These describe the shipped console: how it is built, what data it may show, and
how its workflows are meant to behave. They are for someone who has cloned this
repository and wants to run, understand, extend, or modify it.

Everything here reflects behaviour that exists. Working material — audits, QA
passes, research, superseded directions, coordination notes — lives in
`.documents/`, which is not tracked.

## The documents

| Document | What it answers |
| --- | --- |
| [`coordination-console-design.md`](coordination-console-design.md) | How the backend and React console are put together, and why those boundaries |
| [`ux-data-shape-and-workflow-spec.md`](ux-data-shape-and-workflow-spec.md) | What each entity actually contains, and which workflows the CLI can honestly support |
| [`ux-visual-interaction-spec.md`](ux-visual-interaction-spec.md) | The Flowline visual system: tokens, typography, states, responsive and accessibility rules |
| [`ux-entity-inspectors-spec.md`](ux-entity-inspectors-spec.md) | The record inspector on every entity table, and why it renders the already-loaded row |
| [`ux-reassign-work-spec.md`](ux-reassign-work-spec.md) | Operator reassignment of task assignees |
| [`ux-retire-agent-spec.md`](ux-retire-agent-spec.md) | Operator retirement and restoration of an agent |

## Two things worth knowing before you read them

**The CLI is the contract.** Every write goes through
`.agents/agentic-project-scaffold-lite/bin/coordination`. Where a document says
a view cannot show something, the reason is almost always that the CLI has no
truthful way to answer it — not that the UI was left unfinished. The data-shape
spec is explicit about which gaps are which.

**Constraints are load-bearing.** The console has no network access, serves a
strict CSP, binds loopback only, and ships one bundled stylesheet. Several
choices that look arbitrary — the system font stack, themes applied by
attribute rather than a second stylesheet, no fetched webfonts — follow directly
from those. Each document says so where it matters.

## What is not here

Research, option boards, rejected directions, rendered QA captures, brand and
naming work, storyboards, and agent coordination notes. They informed these
documents; they are not the product record. If you are looking for why a
decision went the way it did, the coordination database holds the decision
records, and `coordination export` will print them.
