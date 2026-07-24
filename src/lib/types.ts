/* ============================================================
   TYPES — defensive, matching the black-box backend exactly.
   Every fallback field chain from the source is preserved.
   ============================================================ */

export type MessageRole = 'user' | 'assistant' | 'tool' | 'thinking';

export interface Attachment {
  name: string;
  mime: string;
  data: string; // base64
}

export interface MessageMeta {
  name?: string;
  code?: string;
  status?: string;
  tool_request_id?: string;
  op_id?: string;
  conversation_id?: string;
  failed?: boolean;
  text?: string;
  attachments?: Attachment[];
}

export interface Message {
  role: MessageRole;
  text: string;
  meta: MessageMeta | null;
  attachments?: Attachment[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  remoteId: string | null;
  unread?: boolean;
  _remoteSig?: string;
  _seenAt?: number;
}

// Usage object — all fallback fields from usagePctField / usageResetAt
export interface UsageData {
  daily_usage_percent?: number;
  weekly_usage_percent?: number;
  monthly_usage_percent?: number;
  usage_percent?: number; // fallback for monthly
  daily_window_end?: string | number;
  weekly_window_end?: string | number;
  usage_period_end?: string | number;
  current_period_end?: string | number;
  reset_at?: string | number;
  usage_reset_at?: string | number;
  [key: string]: unknown;
}

// /workspace response — defensive fallbacks preserved
export interface WorkspaceProfile {
  user?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  account?: Record<string, unknown>;
  models?: ModelInfo[];
  model_catalog?: ModelInfo[];
  catalog?: ModelInfo[];
  usage?: UsageData;
  conversation?: { id?: string; name?: string };
  conversation_id?: string;
  blocks?: unknown[];
  messages?: unknown[];
  operation_id?: string;
  operation?: { id?: string };
  pending_tool_request?: {
    tool_request_id?: string;
    name?: string;
    arguments?: string;
    code?: string;
  };
  [key: string]: unknown;
}

export interface ModelInfo {
  id: string;
  label?: string;
  name?: string;
  provider?: string;
  coding_score?: string;
  code_score?: string;
  codingScore?: string;
  coding_win_rate?: string;
  code_win_rate?: string;
  win_rate?: string;
  latency_ms?: number;
  latency?: number;
  best_for?: string;
  coding_best_for?: string;
  [key: string]: unknown;
}

export interface PairingData {
  token: string;
}

export interface HeartbeatData {
  connected: boolean;
}

export interface OperationsResponse {
  events: OperationEvent[];
  status: string;
  latest_seq?: number;
}

export interface OperationEvent {
  type: string;
  payload?: Record<string, unknown>;
}

export interface ToolDecision {
  conversation_id: string;
  tool_request_id: string;
  decision: 'allow_once' | 'always' | 'decline' | 'tool_resolved';
  tool_output?: string;
}

export interface ApiError extends Error {
  status?: number;
  upgradeUrl?: string;
}

export interface ActiveStream {
  opId: string | null;
  cid: string;
  aborted: boolean;
}
