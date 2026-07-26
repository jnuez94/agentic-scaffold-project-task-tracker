/**
 * Typed calls, one per API route. Grouped so views never build URLs by hand.
 */

import type { ApiClient, Query } from "./client.ts";
import type {
  Agent,
  Artifact,
  AuditPage,
  Decision,
  Escalation,
  Evidence,
  Health,
  Message,
  Meta,
  Review,
  Session,
  Summary,
  TaskDetail,
  TaskListRow,
} from "./contract.ts";

export class Coordination {
  constructor(private readonly api: ApiClient) {}

  meta = () => this.api.get<Meta>("/api/meta");
  doctor = () => this.api.get<Record<string, unknown>>("/api/doctor");
  summary = () => this.api.get<Summary>("/api/summary");
  health = (query?: Query) => this.api.get<Health>("/api/health", query);
  audit = (query?: Query) => this.api.get<AuditPage>("/api/audit", query);
  exportReport = () => this.api.getText("/api/export");

  agents = (query?: Query) => this.api.get<Agent[]>("/api/agents", query);
  createAgent = (body: unknown) => this.api.post<{ id: string }>("/api/agents", body);
  updateAgent = (id: string, body: unknown) => this.api.post<Agent>(`/api/agents/${id}`, body);

  sessions = (query?: Query) => this.api.get<Session[]>("/api/sessions", query);
  startSession = (body: unknown) => this.api.post<Session>("/api/sessions", body);
  heartbeatSession = (id: string) => this.api.post<Session>(`/api/sessions/${id}/heartbeat`);
  endSession = (id: string) => this.api.post<Session>(`/api/sessions/${id}/end`);
  recoverSession = (id: string, body: unknown) =>
    this.api.post<Record<string, unknown>>(`/api/sessions/${id}/recover`, body);

  tasks = (query?: Query) => this.api.get<TaskListRow[]>("/api/tasks", query);
  task = (id: string) => this.api.get<TaskDetail>(`/api/tasks/${id}`);
  createTask = (body: unknown) => this.api.post<{ id: string }>("/api/tasks", body);
  updateTask = (id: string, body: unknown) =>
    this.api.post<{ revision: number }>(`/api/tasks/${id}/update`, body);
  assignTask = (id: string, body: unknown) =>
    this.api.post<{ revision: number; assignees: string[] }>(`/api/tasks/${id}/assign`, body);
  claimTask = (id: string, body: unknown) =>
    this.api.post<{ revision: number; status: string }>(`/api/tasks/${id}/claim`, body);
  setTaskStatus = (id: string, body: unknown) =>
    this.api.post<{ revision: number; status: string }>(`/api/tasks/${id}/status`, body);
  releaseTask = (id: string, body: unknown) =>
    this.api.post<{ revision: number; status: string }>(`/api/tasks/${id}/release`, body);

  evidence = (taskId: string) => this.api.get<Evidence[]>(`/api/tasks/${taskId}/evidence`);
  addEvidence = (body: unknown) => this.api.post<{ id: number }>("/api/evidence", body);
  addDependency = (body: unknown) => this.api.post<Record<string, string>>("/api/dependencies", body);
  resolveDependency = (body: unknown) =>
    this.api.post<Record<string, string>>("/api/dependencies/resolve", body);

  reviews = (query?: Query) => this.api.get<Review[]>("/api/reviews", query);
  addReview = (body: unknown) => this.api.post<{ id: string }>("/api/reviews", body);

  decisions = (query?: Query) => this.api.get<Decision[]>("/api/decisions", query);
  addDecision = (body: unknown) => this.api.post<{ id: string }>("/api/decisions", body);

  messages = (query?: Query) => this.api.get<Message[]>("/api/messages", query);
  sendMessage = (body: unknown) => this.api.post<{ id: string }>("/api/messages", body);

  artifacts = (query?: Query) => this.api.get<Artifact[]>("/api/artifacts", query);
  addArtifact = (body: unknown) => this.api.post<{ id: string }>("/api/artifacts", body);
  setArtifactStatus = (id: string, body: unknown) =>
    this.api.post<{ status: string }>(`/api/artifacts/${id}/status`, body);

  escalations = (query?: Query) => this.api.get<Escalation[]>("/api/escalations", query);
  addEscalation = (body: unknown) => this.api.post<{ id: string }>("/api/escalations", body);
  resolveEscalation = (id: string, body: unknown) =>
    this.api.post<{ status: string }>(`/api/escalations/${id}/resolve`, body);
}
