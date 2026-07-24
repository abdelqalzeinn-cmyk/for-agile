import type { Conversation, ActiveStream, UsageData, ModelInfo, WorkspaceProfile } from '../lib/types';

export interface AppState {
  pairingStatus: 'disconnected' | 'connecting' | 'connected';
  conversations: Conversation[];
  activeId: string | null;
  activeStream: ActiveStream | null;
  usage: UsageData | null;
  account: WorkspaceProfile | null;
  modelCatalog: ModelInfo[];
  selectedModel: string;
  sidebarFilter: string;
  showSettings: boolean;
  showUsage: boolean;
  statusText: string;
}

export interface AppActions {
  setConversations: (updater: (prev: Conversation[]) => Conversation[]) => void;
  setActiveId: (id: string | null) => void;
  setActiveStream: (s: ActiveStream | null) => void;
  setUsage: (u: UsageData | null) => void;
  setAccount: (a: WorkspaceProfile | null) => void;
  setModelCatalog: (m: ModelInfo[]) => void;
  setSelectedModel: (m: string) => void;
  setSidebarFilter: (f: string) => void;
  setShowSettings: (v: boolean) => void;
  setShowUsage: (v: boolean) => void;
  setStatusText: (s: string) => void;
  setPairingStatus: (s: 'disconnected' | 'connecting' | 'connected') => void;
}
