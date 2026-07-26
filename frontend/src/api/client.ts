/**
 * The single boundary between the UI and the CLI-backed JSON API.
 *
 * The active session travels as a header rather than in each body so no form
 * can disagree with the identity shown in the header bar.
 */

import { ApiError } from "./errors.ts";

export const SESSION_HEADER = "X-Coordination-Session";

export type Query = Record<string, string | number | boolean | undefined | null>;

export type SessionSource = () => string | null;

export class ApiClient {
  private readonly baseUrl: string;
  private readonly sessionSource: SessionSource;
  private readonly fetchImpl: typeof fetch;

  constructor(
    sessionSource: SessionSource = () => null,
    baseUrl = "",
    fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.sessionSource = sessionSource;
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl;
  }

  /**
   * A client that never sends a session header.
   *
   * Startup identity bootstrap needs this. It acts as `local-operator` before
   * any session for that actor exists, while the header would still carry a
   * session persisted from a previous actor — and the CLI rejects a global
   * session that belongs to someone other than the accountable actor with
   * `session_actor_mismatch`. None of the three bootstrap calls need a session:
   * `agent add` attributes to the new id, and `session start` attributes to the
   * session it creates.
   */
  withoutSession(): ApiClient {
    return new ApiClient(() => null, this.baseUrl, this.fetchImpl);
  }

  /** Build a URL, dropping empty query values so filters can be optional. */
  url(path: string, query?: Query): string {
    if (!query) return `${this.baseUrl}${path}`;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      params.set(key, String(value));
    }
    const search = params.toString();
    return search ? `${this.baseUrl}${path}?${search}` : `${this.baseUrl}${path}`;
  }

  private headers(withBody: boolean): HeadersInit {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (withBody) headers["Content-Type"] = "application/json";
    const session = this.sessionSource();
    if (session) headers[SESSION_HEADER] = session;
    return headers;
  }

  async get<T>(path: string, query?: Query): Promise<T> {
    const response = await this.fetchImpl(this.url(path, query), {
      method: "GET",
      headers: this.headers(false),
    });
    return this.unwrap<T>(response);
  }

  async post<T>(path: string, body: unknown = {}): Promise<T> {
    const response = await this.fetchImpl(this.url(path), {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    return this.unwrap<T>(response);
  }

  /** Fetch a text body (the Markdown export). */
  async getText(path: string): Promise<string> {
    const response = await this.fetchImpl(this.url(path), {
      method: "GET",
      headers: this.headers(false),
    });
    if (!response.ok) throw ApiError.fromPayload(await this.safeJson(response), response.status);
    return response.text();
  }

  private async unwrap<T>(response: Response): Promise<T> {
    const payload = await this.safeJson(response);
    if (!response.ok) throw ApiError.fromPayload(payload, response.status);
    if (payload && typeof payload === "object" && "data" in payload) {
      return (payload as { data: T }).data;
    }
    throw new ApiError(
      "unexpected_response",
      "The server returned a success without a data payload.",
      response.status,
    );
  }

  private async safeJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
}
