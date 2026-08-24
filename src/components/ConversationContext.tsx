"use client";

import { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';

export type ConversationInfo = {
  id: string;
  title: string;
  updated_at: string;
  parent_conversation_id: string | null;
};

type ConversationContextType = {
  conversations: ConversationInfo[];
  setConversations: React.Dispatch<React.SetStateAction<ConversationInfo[]>>;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  initialMessages: any[];
  setInitialMessages: React.Dispatch<React.SetStateAction<any[]>>;
  loadedInitial: boolean;
  setLoadedInitial: React.Dispatch<React.SetStateAction<boolean>>;
  hasInitialized: React.MutableRefObject<boolean>;
  creatingRef: React.MutableRefObject<boolean>;
};

const ConversationContext = createContext<ConversationContextType | null>(null);

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<ConversationInfo[]>([]);
  const [activeConversationId, _setActiveConversationId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [loadedInitial, setLoadedInitial] = useState(false);

  // These refs live here so they survive navigation (context never unmounts)
  const hasInitialized = useRef(false);
  const creatingRef = useRef(false);

  const setActiveConversationId = useCallback((id: string | null) => {
    _setActiveConversationId(id);
    if (id) sessionStorage.setItem('activeConversationId', id);
    else sessionStorage.removeItem('activeConversationId');
  }, []);

  return (
    <ConversationContext.Provider value={{
      conversations,
      setConversations,
      activeConversationId,
      setActiveConversationId,
      initialMessages,
      setInitialMessages,
      loadedInitial,
      setLoadedInitial,
      hasInitialized,
      creatingRef,
    }}>
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversations() {
  const ctx = useContext(ConversationContext);
  if (!ctx) throw new Error('useConversations must be used within ConversationProvider');
  return ctx;
}
