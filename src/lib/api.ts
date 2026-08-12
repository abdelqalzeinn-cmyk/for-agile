/* ============================================================
   API CLIENT — dual-mode (Lemonade one-click + legacy device-code)
   ============================================================
   Mode 1 — Lemonade (default, preferred):
     Site calls connectSession() -> broker stores X-Client-Id.
     Site polls pollStatus() until the plugin heartbeats.
     Site calls /proxy/... with X-Client-Id; broker injects the
     plugin's deposited bearer token.

   Mode 2 — Legacy device-code (fallback):
     User enters an 8-char code from the plugin.
     Site calls exchangeCode(code) -> gets a bearer token.
     Site stores it in sessionStorage and sends it as
     Authorization: Bearer <token> on every /proxy/... call.

   The broker accepts EITHER header on /proxy/... so the site
   can switch modes transparently.
   ============================================================ */
import type {
  WorkspaceProfile,
  PairingData,
  HeartbeatData,
  OperationsResponse,
  ToolDecision,
  ApiError,
} from './types';

export const BROKER_URL: string =
  (import.meta.env.VITE_BROKER_URL as string | undefined) ||
  'https://for-agile-broker.onrender.com';
export const BACKEND_URL = 'https://api.agilebot.dev';
export const CLIENT_VERSION = '0.3.1';

// ----------------------------------------------------------------------------
// Mode tracking
// ----------------------------------------------------------------------------
export type ConnectionMode = 'lemonade' | 'device-code' | 'none';
let currentMode: ConnectionMode = 'none';

export function getConnectionMode(): ConnectionMode {
  return currentMode;
}

// ----------------------------------------------------------------------------
// CLIENT ID (Lemonade mode) — persisted per-browser
// ----------------------------------------------------------------------------
const CLIENT_ID_KEY = 'agilebot_client_id';

export function getClientId(): string {
  let id = sessionStorage.getItem(CLIENT_ID_KEY) || '';
  if (!id) {
    id = 'site_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
    sessionStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

// ----------------------------------------------------------------------------
// TOKEN (device-code mode) — persisted per-tab
// ----------------------------------------------------------------------------
const TOKEN_KEY = 'agilebot_device_token';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY) || null;
}

export function setToken(token: string | null): void {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

// In-memory session id for Lemonade mode
let currentSessionId: string | null = null;
export function getSessionId(): string | null { return currentSessionId; }

// ----------------------------------------------------------------------------
// LEMONADE MODE — connect / poll / heartbeat / whoami
// ----------------------------------------------------------------------------
export async function connectSession(): Promise<{ session_id: string; connected: boolean }> {
  const resp = await fetch(BROKER_URL + '/actions/connect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Id': getClientId(),
    },
    body: JSON.stringify({ role: 'site' }),
  });
  if (!resp.ok) {
    const err: ApiError = new Error('connect failed (' + resp.status + ')');
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();
  currentSessionId = data.session_id;
  currentMode = 'lemonade';
  return data;
}

export async function pollStatus(): Promise<{
  connected: boolean;
  plugin_heartbeat_age: number | null;
  site_heartbeat_age: number | null;
}> {
  const resp = await fetch(
    BROKER_URL + '/actions/status?session_id=' + encodeURIComponent(currentSessionId || ''),
    { headers: { 'X-Client-Id': getClientId() } }
  );
  if (!resp.ok) {
    return { connected: false, plugin_heartbeat_age: null, site_heartbeat_age: null };
  }
  return resp.json();
}

export async function sendHeartbeat(): Promise<{ ok: boolean; connected: boolean }> {
  if (!currentSessionId) return { ok: false, connected: false };
  const resp = await fetch(BROKER_URL + '/actions/heartbeat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Id': getClientId(),
    },
    body: JSON.stringify({ session_id: currentSessionId, role: 'site' }),
  });
  if (!resp.ok) return { ok: false, connected: false };
  return resp.json();
}

export async function whoami(): Promise<{ username: string; id?: string }> {
  const resp = await fetch(BROKER_URL + '/actions/whoami', {
    headers: { 'X-Client-Id': getClientId() },
  });
  if (!resp.ok) {
    const err: ApiError = new Error('Not connected — pair the plugin first');
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

// ----------------------------------------------------------------------------
// LEGACY MODE — device-code exchange
// ----------------------------------------------------------------------------
export async function exchangeCode(code: string): Promise<PairingData> {
  const resp = await fetch(BROKER_URL + '/device-code/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  if (resp.ok) {
    const data = await resp.json();
    if (data.token) {
      setToken(data.token);
      currentMode = 'device-code';
      return data;
    }
  }

  if (resp.status === 404 || resp.status === 410) {
    const err: ApiError = new Error('waiting');
    err.status = resp.status;
    throw err;
  }

  const err: ApiError = new Error('Broker error. Please try again.');
  err.status = resp.status;
  throw err;
}

// ----------------------------------------------------------------------------
// AUTHENTICATED API CALL — works in both modes
// ----------------------------------------------------------------------------
export async function api(path: string, opts: RequestInit = {}): Promise<unknown> {
  const token = getToken();
  const headers: Record<string, string> = {
    'X-AgileBot-Client-Version': CLIENT_VERSION,
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  };

  // Always send X-Client-Id (harmless in device-code mode, required in Lemonade mode)
  headers['X-Client-Id'] = getClientId();

  // In device-code mode, also send the bearer token
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  } else if (currentMode === 'none') {
    return Promise.reject('Not paired');
  }

  const resp = await fetch(BROKER_URL + '/proxy' + path, {
    ...opts,
    headers,
  });

  if (resp.status === 401) {
    const err: ApiError = new Error('Session expired — re-pair in Studio');
    err.status = 401;
    throw err;
  }

  if (resp.ok) return resp.json();

  const raw = await resp.text();
  let detail = raw;
  try {
    const payload = raw ? JSON.parse(raw) : null;
    detail = payload && (payload.detail || payload.message || payload.error || payload.reason) || raw;
  } catch {
    detail = raw;
  }

  if (resp.status === 402) {
    const err: ApiError = new Error(detail || 'This request requires an active plan or available credits.');
    err.status = 402;
    err.upgradeUrl = 'https://agilebot.dev/upgrade';
    throw err;
  }

  const err: ApiError = new Error(detail || ('Request failed (' + resp.status + ')'));
  err.status = resp.status;
  throw err;
}

// ----------------------------------------------------------------------------
// Legacy heartbeat — kept for back-compat with App.tsx's old call sites
// ----------------------------------------------------------------------------
export async function heartbeat(): Promise<HeartbeatData> {
  if (currentMode === 'lemonade') {
    const r = await sendHeartbeat();
    return { ok: r.ok, connected: r.connected };
  }
  // device-code / none mode: hit the legacy /api/heartbeat endpoint
  const resp = await fetch(BROKER_URL + '/api/heartbeat');
  return resp.json();
}

// ----------------------------------------------------------------------------
// Conversations
// ----------------------------------------------------------------------------
export async function listConversations(): Promise<{ conversations: unknown[] }> {
  return api('/conversations') as Promise<{ conversations: unknown[] }>;
}

export async function createConversation(body: { message: string; model?: string; attachments?: unknown[] }): Promise<WorkspaceProfile> {
  return api('/conversations', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Promise<WorkspaceProfile>;
}

export async function sendMessage(cid: string, body: { message: string; model?: string; attachments?: unknown[] }): Promise<WorkspaceProfile> {
  return api('/conversations/' + encodeURIComponent(cid) + '/messages', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Promise<WorkspaceProfile>;
}

export async function getMessages(cid: string): Promise<WorkspaceProfile> {
  return api('/conversations/' + encodeURIComponent(cid) + '/messages') as Promise<WorkspaceProfile>;
}

export async function deleteConversation(cid: string): Promise<void> {
  await api('/conversations/' + encodeURIComponent(cid), { method: 'DELETE' });
}

// ----------------------------------------------------------------------------
// Operations / streaming
// ----------------------------------------------------------------------------
export async function getOperationEvents(opId: string, afterSeq: number): Promise<OperationsResponse> {
  return api('/operations/' + encodeURIComponent(opId) + '/events?after_seq=' + afterSeq) as Promise<OperationsResponse>;
}

export async function abortOperation(opId: string): Promise<void> {
  await api('/operations/' + encodeURIComponent(opId) + '/abort', { method: 'POST' });
}

export async function submitToolDecision(opId: string, decision: ToolDecision): Promise<void> {
  const body: Record<string, unknown> = {
    conversation_id: decision.conversation_id,
    tool_request_id: decision.tool_request_id,
    decision: decision.decision,
  };
  if (decision.decision === 'tool_resolved') {
    body.tool_output = '';
  }
  await api('/operations/' + encodeURIComponent(opId) + '/tool_results', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ----------------------------------------------------------------------------
// Workspace profile
// ----------------------------------------------------------------------------
export async function getWorkspace(): Promise<WorkspaceProfile> {
  return api('/workspace') as Promise<WorkspaceProfile>;
}

// /modders/me — direct (works in device-code mode where we have a token)
export async function getModderMe(): Promise<{ username: string; id?: string }> {
  return api('/modders/me') as Promise<{ username: string; id?: string }>;
}

// ----------------------------------------------------------------------------
// Roblox avatar lookup (CORS-safe via broker /roblox-proxy)
// ----------------------------------------------------------------------------
async function robloxProxy(path: string): Promise<unknown> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'X-Client-Id': getClientId(),
  };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const resp = await fetch(BROKER_URL + '/roblox-proxy/' + path, { headers });
  if (!resp.ok) throw new Error('roblox proxy ' + resp.status);
  return resp.json();
}

export async function fetchModderProfile(): Promise<{
  roblox_username: string;
  roblox_user_id: string;
  roblox_profile_image?: string;
} | null> {
  try {
    // Try Lemonade mode first
    let me: { username: string; id?: string } | null = null;
    if (currentMode === 'lemonade' || currentMode === 'none') {
      try {
        me = await whoami();
      } catch {
        me = null;
      }
    }
    if (!me && getToken()) {
      me = await getModderMe();
    }
    if (!me) return null;

    const username = me.username;
    if (!username) return null;

    const search = (await robloxProxy(
      'users.roblox.com/v1/users/search?keyword=' + encodeURIComponent(username) + '&limit=10'
    )) as { data?: { id: number; name: string }[] };
    const user =
      (Array.isArray(search.data) && search.data.find((u) => u.name && u.name.toLowerCase() === username.toLowerCase())) ||
      (Array.isArray(search.data) ? search.data[0] : undefined);
    if (!user || !user.id) return null;

    let image: string | undefined;
    try {
      const thumb = (await robloxProxy(
        'thumbnails.roblox.com/v1/users/avatar-headshot?userIds=' + user.id + '&size=150x150&format=Png'
      )) as { data?: { imageUrl?: string }[] };
      image = thumb.data && thumb.data[0] && thumb.data[0].imageUrl;
    } catch {
      image = undefined;
    }
    return { roblox_username: username, roblox_user_id: String(user.id), roblox_profile_image: image };
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Disconnect — clears local state in both modes
// ----------------------------------------------------------------------------
export function disconnectLocal(): void {
  currentSessionId = null;
  currentMode = 'none';
  sessionStorage.removeItem(TOKEN_KEY);
  // Keep CLIENT_ID_KEY so reconnects reuse the same id
}
