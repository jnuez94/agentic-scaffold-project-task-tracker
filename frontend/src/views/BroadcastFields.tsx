/**
 * The broadcast composer's fields.
 *
 * Sender and recipient are read-only inputs rather than plain text so they
 * stay in the form's label/description structure for assistive technology.
 * Optional fields sit behind a disclosure to keep them visually secondary.
 */

import { TEAM_RECIPIENT } from "../lib/broadcast.ts";
import { FormField } from "../components/FormField.tsx";

export interface BroadcastFieldsProps {
  senderId: string;
  senderName: string;
  body: string;
  bodyError: string | undefined;
  task: string;
  tags: string;
  onBody: (value: string) => void;
  onTask: (value: string) => void;
  onTags: (value: string) => void;
}

export function BroadcastFields(props: BroadcastFieldsProps) {
  const { senderId, senderName, body, bodyError, task, tags } = props;
  return (
    <>
        <div className="control">
          <label htmlFor="bc-from">From</label>
          <input id="bc-from" value={`${senderName} · ${senderId}`} readOnly />
        </div>
        <div className="control">
          <label htmlFor="bc-to">To</label>
          <input id="bc-to" value="Team" readOnly aria-describedby="bc-to-hint" />
          <p id="bc-to-hint" className="small muted">
            Stored as the recipient <span className="mono">{TEAM_RECIPIENT}</span>.
          </p>
        </div>

        {/* The error used to reach the reader only through aria-errormessage:
            aria-describedby was hardcoded to the hint and never chained the
            error id, so a screen reader without errormessage support announced
            nothing. FormField chains both. */}
        <FormField
          id="bc-body"
          className="control"
          label="Message"
          hint="Team messages appear when recipients check their inbox."
          error={bodyError}
        >
          {(control) => (
            <textarea
              {...control}
              value={body}
              rows={5}
              required
              onChange={(event) => props.onBody(event.target.value)}
            />
          )}
        </FormField>

        <details className="optional-fields">
          <summary>Optional details</summary>
          <FormField id="bc-task" className="control" label="Related task">
            {(control) => (
              <input
                {...control}
                value={task}
                placeholder="TASK-1"
                onChange={(event) => props.onTask(event.target.value)}
              />
            )}
          </FormField>
          <FormField id="bc-tags" className="control" label="Tags">
            {(control) => (
              <input
                {...control}
                value={tags}
                placeholder="handoff,status"
                onChange={(event) => props.onTags(event.target.value)}
              />
            )}
          </FormField>
        </details>

    </>
  );
}
