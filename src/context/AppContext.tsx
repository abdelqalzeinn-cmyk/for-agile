import { createContext, useContext, useState, ReactNode } from 'react';
import type { Conversation, ActiveStream, UsageData, ModelInfo, WorkspaceProfile } from '../lib/types';
import type { AppState, AppActions } from './AppContext.types';

interface AppContextValue {
  state: AppState;
  actions: AppActions;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [pairingStatus, setPairingStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<ActiveStream | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [account, setAccount] = useState<WorkspaceProfile | null>(null);
  const [modelCatalog, setModelCatalog] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [sidebarFilter, setSidebarFilter] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [statusText, setStatusText] = useState('connecting...');

  const value: AppContextValue = {
    state: { pairingStatus, conversations, activeId, activeStream, usage, account, modelCatalog, selectedModel, sidebarFilter, showSettings, showUsage, statusText },
    actions: {
      setConversations,
      setActiveId,
      setActiveStream,
      setUsage,
      setAccount,
      setModelCatalog,
      setSelectedModel,
      setSidebarFilter,
      setShowSettings,
      setShowUsage,
      setStatusText,
      setPairingStatus,
    },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }
  return ctx;
}
