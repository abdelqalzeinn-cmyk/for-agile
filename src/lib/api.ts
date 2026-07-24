/* ============================================================
   API CLIENT — preserves the exact /proxy split from source.
   - api() -> BROKER_URL + "/proxy" + path
   - exchangeCode -> BROKER_URL + "/device-code/exchange"
   - heartbeat -> BROKER_URL + "/api/heartbeat"
   ============================================================ */
import type {
  WorkspaceProfile,
  PairingData,
  HeartbeatData,
  OperationsResponse,
  ToolDecision,
  ApiError,
} from './types';

// Broker URL — read from Vite env (set in Render dashboard as VITE_BROKER_URL),
// falls back to the live broker if unset.
export const BROKER_URL: string =
  (import.meta.env.VITE_BROKER_URL as string | undefined) ||
  'https://for-agile-broker.onrender.com';
export const BACKEND_URL = 'https://api.agilebot.dev';
export const CLIENT_VERSION = '0.2.4';

// Token stored in sessionStorage (never localStorage, never URL, never logged)
export function getToken(): string | null {
  return sessionStorage.getItem('agilebot_device_token') || null;
}

export function setToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem('agilebot_device_token', token);
  } else {
    sessionStorage.removeItem('agilebot_device_token');
  }
}

// Authenticated API call — goes through broker /proxy prefix
export async function api(path: string, opts: RequestInit = {}): Promise<unknown> {
  const token = getToken();
  if (!token) {
    return Promise.reject('Not paired');
  }
  const resp = await fetch(BROKER_URL + '/proxy' + path, {
    ...opts,
    headers: {
      Authorization: 'Bearer ' + token,
      'X-AgileBot-Client-Version': CLIENT_VERSION,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

  if (resp.status === 401) {
    // Caller handles unpair — we just throw so the caller can react
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

// Pairing: exchange code -> token (no /proxy prefix)
export async function exchangeCode(code: string): Promise<PairingData> {
  const resp = await fetch(BROKER_URL + '/device-code/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  if (resp.ok) {
    const data = await resp.json();
    if (data.token) return data;
  }

  // 404/410 = waiting for plugin to mint the code — caller retries
  if (resp.status === 404 || resp.status === 410) {
    const err: ApiError = new Error('waiting');
    err.status = resp.status;
    throw err;
  }

  const err: ApiError = new Error('Broker error. Please try again.');
  err.status = resp.status;
  throw err;
}

// Heartbeat (no /proxy prefix — easy to miss, porting verbatim)
export async function heartbeat(): Promise<HeartbeatData> {
  const resp = await fetch(BROKER_URL + '/api/heartbeat');
  return resp.json();
}

// Conversations
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

// Operations / streaming
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
  // tool_output only sent for tool_resolved — omitted entirely for others
  if (decision.decision === 'tool_resolved') {
    body.tool_output = '';
  }
  await api('/operations/' + encodeURIComponent(opId) + '/tool_results', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// Workspace profile (account + models + usage)
export async function getWorkspace(): Promise<WorkspaceProfile> {
  return api('/workspace') as Promise<WorkspaceProfile>;
}

// Modder profile: GET /modders/me via broker proxy -> { username, id }
export async function getModderMe(): Promise<{ username: string; id?: string }> {
  return api('/modders/me') as Promise<{ username: string; id?: string }>;
}

// CORS-safe Roblox public-data proxy (broker /roblox-proxy/<host>/<path>).
// Forwards to users.roblox.com / thumbnails.roblox.com without browser CORS blocks.
async function robloxProxy(path: string): Promise<unknown> {
  const token = getToken();
  if (!token) throw new Error('Not paired');
  const resp = await fetch(BROKER_URL + '/roblox-proxy/' + path, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
  });
  if (!resp.ok) throw new Error('roblox proxy ' + resp.status);
  return resp.json();
}

// Resolve the modder's Roblox avatar headshot + id from their username.
export async function fetchModderProfile(): Promise<{
  roblox_username: string;
  roblox_user_id: string;
  roblox_profile_image?: string;
} | null> {
  try {
    const me = await getModderMe();
    const username = me && me.username;
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
