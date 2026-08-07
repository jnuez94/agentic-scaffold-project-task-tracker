/**
 * Operator-facing sentences that appear on more than one surface.
 *
 * Only strings that are genuinely shared live here. Copy used in exactly one
 * place stays where it is used, because indirection buys nothing there and
 * costs a jump to read.
 *
 * These three had drifted into three, three and two literal copies. One of them
 * already had a named constant in TaskActions that the other two callers did
 * not use, which is how this kind of thing goes wrong: the wording is corrected
 * in the place someone happened to be looking, and the other copies quietly
 * disagree. A shared constant makes "change the wording" a single edit and
 * makes disagreement impossible rather than merely unlikely.
 */

/**
 * Shown wherever a mutation control is disabled during startup.
 *
 * Deliberately about *setup*, not about permission: the operator has done
 * nothing wrong and the state resolves on its own.
 */
export const SETUP_PENDING = "Waiting for identity setup to finish.";

/**
 * The empty-state hint whenever a filter is the reason nothing is shown.
 *
 * "everything loaded" rather than "everything": the console only ever holds the
 * rows it fetched, and the contract gives no total, so promising more than the
 * loaded window would be a claim the console cannot support.
 */
export const CLEAR_FILTER_HINT = "Clear the filter to see everything loaded.";

/**
 * Empty-state title for Messages under a filter.
 *
 * Shared because Conversation and Ledger render the *same* loaded rows in two
 * presentations; if they described an empty result differently, the operator
 * would reasonably conclude the two views hold different data.
 */
export const NO_MESSAGES_MATCH = "No loaded messages match this filter";

/**
 * A message for something thrown that is not an `Error`.
 *
 * Both `useResource` and `useBootstrap` had a byte-identical private `describe`
 * doing this. Two copies of a function whose whole job is to produce one
 * consistent sentence is the failure it exists to prevent.
 *
 * Names the transport rather than guessing: a non-Error rejection from `fetch`
 * in this console almost always means the local server is not answering, and
 * saying so beats surfacing `[object Object]`.
 */
export function describeThrown(caught: unknown): string {
  if (caught instanceof Error) return caught.message;
  return "The console could not reach the local server.";
}
