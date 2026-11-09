"use client";

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { FormEvent, useRef, useEffect, useState } from 'react';
import { SendIcon, Loader2, Moon, Sun, Trash2, Plus, MessageSquare, User } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from 'next-themes';
import { useUser } from '@/components/UserContext';
import { useConversations } from '@/components/ConversationContext';
import { useSearchParams } from 'next/navigation';

export default function ChatClient() {
  // All conversation state lives in ConversationContext (root layout),
  // so it survives navigation between pages.
  const {
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
  } = useConversations();

  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { displayName, isLoading: userLoading, isReady, error: sessionError, retry: retrySession } = useUser();
  const searchParams = useSearchParams();

  // Load conversations from Supabase
  useEffect(() => {
    setMounted(true);

    if (userLoading || !isReady) return;
    // hasInitialized lives in the context so it stays true across navigations —
    // returning from other pages skips the entire fetch and shows state instantly.
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Read replyTo synchronously before any awaits, then clear it from the URL
    // immediately so a second effect run (if it ever happens) won't see it.
    const replyTo = searchParams.get('replyTo') || null;
    if (replyTo) {
      window.history.replaceState({}, '', '/chat');
    }

    async function loadConversations() {
      try {
        const res = await fetch('/api/conversations');
        if (!res.ok) throw new Error('Failed to fetch conversations');
        const data = await res.json();

        const mapped = data.map((c: any) => ({
          id: c.id,
          title: c.title,
          updated_at: c.updated_at,
          parent_conversation_id: c.parent_conversation_id,
        }));

        setConversations(mapped);

        if (replyTo) {
          // Branch off from a thought
          await createNewChat(replyTo);
        } else {
          // Try to restore the last active conversation from sessionStorage
          const savedId = sessionStorage.getItem('activeConversationId');
          const restored = savedId ? mapped.find((c: any) => c.id === savedId) : null;

          if (restored) {
            await loadMessages(restored.id);
            setActiveConversationId(restored.id);
          } else if (mapped.length > 0) {
            await loadMessages(mapped[0].id);
            setActiveConversationId(mapped[0].id);
          } else {
            await createNewChat();
          }
        }
      } catch (err) {
        console.error('Failed to load conversations:', err);
        await createNewChat();
      } finally {
        setLoadedInitial(true);
      }
    }

    loadConversations();
  }, [userLoading, isReady]);

  const loadMessages = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();

      // Transform Supabase messages to the format useChat expects
      const transformed = data.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        parts: [{ type: 'text', text: m.content }],
      }));

      setInitialMessages(transformed);
    } catch (err) {
      console.error('Failed to load messages:', err);
      setInitialMessages([]);
    }
  };

  const createNewChat = async (parentConversationId?: string) => {
    if (!isReady) return;
    if (creatingRef.current) return;
    creatingRef.current = true;

    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: parentConversationId ? 'Reply Thought' : 'New Thought',
          parentConversationId,
        }),
      });

      if (!res.ok) throw new Error('Failed to create conversation');
      const convo = await res.json();

      setInitialMessages([]);
      setActiveConversationId(convo.id);

      setConversations(prev => [{
        id: convo.id,
        title: convo.title,
        updated_at: convo.updated_at,
        parent_conversation_id: convo.parent_conversation_id || null,
      }, ...prev]);
    } catch (err) {
      console.error('Failed to create conversation:', err);
      const fallbackId = crypto.randomUUID();
      setActiveConversationId(fallbackId);
      setInitialMessages([]);
    } finally {
      creatingRef.current = false;
    }
  };

  const selectConversation = async (id: string) => {
    await loadMessages(id);
    setActiveConversationId(id);
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Remove from local state
    const newConvos = conversations.filter(c => c.id !== id);
    setConversations(newConvos);
    
    // Delete from Supabase
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }

    if (activeConversationId === id) {
      if (newConvos.length > 0) {
        selectConversation(newConvos[0].id);
      } else {
        createNewChat();
      }
    }
  };

  if (sessionError) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-zinc-950">
        <div className="flex flex-col items-center space-y-4">
          <p className="text-zinc-500 text-sm">Couldn&apos;t start your session.</p>
          <button
            onClick={retrySession}
            className="px-4 py-2 rounded-lg bg-black text-white dark:bg-zinc-100 dark:text-black text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (userLoading || !loadedInitial) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-zinc-950">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          <p className="text-zinc-500 text-sm">Initializing your identity...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Sidebar */}
      <div className="w-64 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-lg">Conversations</h2>
            <button 
              onClick={() => createNewChat()}
              className="p-2 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              title="New Chat"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          {/* User identity badge */}
          <div className="flex items-center space-x-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2">
            <User className="w-3.5 h-3.5" />
            <span className="font-medium">{displayName}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="text-sm text-zinc-500 italic p-2">No history yet.</p>
          ) : (
            conversations.map(c => (
              <div 
                key={c.id} 
                onClick={() => selectConversation(c.id)}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors group ${
                  activeConversationId === c.id 
                    ? 'bg-zinc-200 dark:bg-zinc-800' 
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <MessageSquare className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  <div className="truncate">
                    <span className="text-sm truncate block">{c.title}</span>
                    {c.parent_conversation_id && (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">↩ reply</span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={(e) => deleteConversation(c.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-screen relative">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h1 className="font-semibold">Thoughts</h1>
            <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded hidden sm:inline-block">*lights a cigarrete*</span>
          </div>
          {mounted && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          )}
        </div>

        {/* The active chat app instance */}
        {activeConversationId && isReady && (
          <ChatApp 
            key={activeConversationId} // Force remount on conversation change
            conversationId={activeConversationId} 
            initialMessages={initialMessages} 
            updateConversationsList={(id, title) => {
              setConversations(prev => {
                const existing = prev.find(c => c.id === id);
                if (existing && existing.title === title) return prev;
                let newList;
                if (existing) {
                  newList = prev.map(c => c.id === id ? { ...c, title, updated_at: new Date().toISOString() } : c);
                } else {
                  newList = [{ id, title, updated_at: new Date().toISOString(), parent_conversation_id: null }, ...prev];
                }
                return newList;
              });
            }}
          />
        )}
      </div>
    </div>
  );
}

function ChatApp({ conversationId, initialMessages, updateConversationsList }: { conversationId: string, initialMessages: any[], updateConversationsList: (id: string, title: string) => void }) {
  const [input, setInput] = useState('');
  const savedMsgIdsRef = useRef<Set<string>>(new Set(initialMessages.map((m: any) => m.id)));

  // Helper to persist a single message to Supabase
  const persistMessage = async (role: string, content: string) => {
    try {
      await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content }),
      });
    } catch (err) {
      console.error('Failed to persist message:', err);
    }
  };

  const { messages, sendMessage, status, setMessages } = useChat({
    id: conversationId,
    initialMessages,
    // useChat (AI SDK 5+) ignores a top-level `body`; request data goes through the transport.
    transport: new DefaultChatTransport({ api: '/api/chat', body: { conversationId } }),
    onFinish: async (msgOrEvent: any) => {
      // Persist the assistant's response when streaming completes
      const msg = msgOrEvent.message || msgOrEvent;
      const assistantText = msg?.content || msg?.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('') || '';
      if (assistantText) {
        await persistMessage('assistant', assistantText);
      }
    },
  } as any) as any;

  useEffect(() => {
    if (messages.length > 0) {
      // Update the conversations list title from the first user message
      const firstUserMessage = messages.find((m: any) => m.role === 'user');
      const title = firstUserMessage ? ((firstUserMessage as any).content || firstUserMessage.parts?.filter((p:any) => p.type === 'text').map((p:any) => p.text).join(''))?.substring(0, 30) + '...' : 'New Chat';
      updateConversationsList(conversationId, title);
    }
  }, [messages, conversationId]);

  const isLoading = status === 'streaming' || status === 'submitted';
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userText = input.trim();
    sendMessage({ role: 'user', parts: [{ type: 'text', text: userText }] });
    setInput('');

    // Persist the user message to Supabase
    await persistMessage('user', userText);

    // Update conversation title if this is the first message
    if (messages.length === 0) {
      try {
        const title = userText.substring(0, 30) + (userText.length > 30 ? '...' : '');
        await fetch(`/api/conversations/${conversationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        });
      } catch {}
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-6 max-w-4xl mx-auto w-full relative">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 dark:text-zinc-400 space-y-4">
            <p>Ask a profound question or present a moral dilemma. I Dare You.</p>
          </div>
        )}
        
        {messages.map((m: any) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`px-4 py-3 rounded-2xl max-w-[85%] ${
              m.role === 'user' 
                ? 'bg-black text-white dark:bg-zinc-100 dark:text-black rounded-br-sm' 
                : 'bg-zinc-100 text-black dark:bg-zinc-800 dark:text-zinc-100 rounded-bl-sm border border-zinc-200 dark:border-zinc-700'
            }`}>
              {m.role === 'user' ? (
                <div className="whitespace-pre-wrap font-medium">
                  {(m as any).content || m.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')}
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-black dark:text-zinc-100 prose-p:text-black dark:prose-p:text-zinc-100 prose-headings:text-black dark:prose-headings:text-zinc-100 prose-strong:text-black dark:prose-strong:text-zinc-100 prose-a:text-blue-600 dark:prose-a:text-blue-400">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {(m as any).content || m.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center space-x-2 border border-zinc-200 dark:border-zinc-700">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500 dark:text-zinc-400" />
              <span className="text-zinc-500 dark:text-zinc-400 text-sm">Getting thoughts back...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
        <form onSubmit={onSubmit} className="max-w-4xl mx-auto flex space-x-4">
          <input
            className="flex-1 p-3 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-colors"
            value={input || ''}
            placeholder="What your thinking be like..."
            onChange={handleInputChange}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !(input || '').trim()}
            className="bg-black text-white dark:bg-zinc-100 dark:text-black p-3 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex shrink-0 items-center justify-center w-12 h-12"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </form>
      </div>
    </>
  );
}