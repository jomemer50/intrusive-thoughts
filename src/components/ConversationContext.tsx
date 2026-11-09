"use client";

import { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import type { UIMessage } from 'ai';

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
  initialMessages: UIMessage[];
  setInitialMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>;
  loadedInitial: boolean;
  setLoadedInitial: React.Dispatch<React.SetStateAction<boolean>>;
  hasInitializedRef: React.RefObject<boolean>;
  creatingRef: React.RefObject<boolean>;
};

const ConversationContext = createContext<ConversationContextType | null>(null);

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<ConversationInfo[]>([]);
  const [activeConversationId, _setActiveConversationId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [loadedInitial, setLoadedInitial] = useState(false);

  // These refs live here so they survive navigation (context never unmounts)
  const hasInitializedRef = useRef(false);
  const creatingRef = useRef(false);

  const setActiveConversationId = useCallback((id: string | null) => {
    _setActiveConversationId(id);
    try {
      if (id) sessionStorage.setItem('activeConversationId', id);
      else sessionStorage.removeItem('activeConversationId');
    } catch {}
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
      hasInitializedRef,
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
