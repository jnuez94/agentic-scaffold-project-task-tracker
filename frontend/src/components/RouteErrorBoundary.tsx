/**
 * Keeps a failed route from taking the console with it.
 *
 * A render error anywhere under the routed content used to unmount the whole
 * application: blank page, no navigation, no way back except a manual reload,
 * and — worst for a coordination tool — no indication of what happened. The
 * operator was left unable to tell whether their last action had been recorded.
 *
 * This is a backstop, not a cure. It is deliberately narrow: it wraps only the
 * routed surface, so the shell, navigation, and identity stay usable, and it
 * re-throws nothing it can present honestly. Bugs it catches are still bugs and
 * still surface in the console.
 *
 * A class component because React exposes no hook equivalent of
 * componentDidCatch.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** Changing this clears a caught error — a new route deserves a fresh try. */
  resetKey: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Left in place on purpose: swallowing this is how a render bug becomes a
    // mystery blank screen, and the tests assert on real failures, not on a
    // quiet fallback.
    console.error("Route render failed", error, info.componentStack);
  }

  override componentDidUpdate(previous: Props): void {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private retry = () => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <section className="records" aria-label="This view could not be displayed">
        <div className="view-header">
          <h1>This view could not be displayed</h1>
          <p className="small muted">
            The rest of the console still works — the navigation on the left will take you
            somewhere else.
          </p>
        </div>

        <div className="empty-state" role="alert">
          {/* Named plainly: an operator deciding whether to retry a coordination
              write needs to know this was a display failure, not a lost write. */}
          <p>
            Nothing was sent or changed by this error. It happened while drawing the page,
            after any request had already completed.
          </p>
          <p className="small mono">{error.message}</p>
          <button type="button" onClick={this.retry}>
            Try this view again
          </button>
        </div>
      </section>
    );
  }
}
