/**
 * The broadcast composer's fields.
 *
 * Sender and recipient are read-only inputs rather than plain text so they
 * stay in the form's label/description structure for assistive technology.
 * Optional fields sit behind a disclosure to keep them visually secondary.
 */

import { TEAM_RECIPIENT } from "../lib/broadcast.ts";

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

        <div className="control">
          <label htmlFor="bc-body">Message</label>
          <textarea
            id="bc-body"
            value={body}
            rows={5}
            required
            aria-describedby="bc-body-hint"
            aria-invalid={bodyError ? true : undefined}
            aria-errormessage={bodyError ? "bc-body-error" : undefined}
            onChange={(event) => props.onBody(event.target.value)}
          />
          {bodyError ? (
            <p id="bc-body-error" className="field-error" role="alert">
              {bodyError}
            </p>
          ) : null}
          <p id="bc-body-hint" className="small muted">
            Team messages appear when recipients check their inbox.
          </p>
        </div>

        <details className="optional-fields">
          <summary>Optional details</summary>
          <div className="control">
            <label htmlFor="bc-task">Related task</label>
            <input
              id="bc-task"
              value={task}
              placeholder="TASK-1"
              onChange={(event) => props.onTask(event.target.value)}
            />
          </div>
          <div className="control">
            <label htmlFor="bc-tags">Tags</label>
            <input
              id="bc-tags"
              value={tags}
              placeholder="handoff,status"
              onChange={(event) => props.onTags(event.target.value)}
            />
          </div>
        </details>

    </>
  );
}
