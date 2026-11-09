"use client";

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { FormEvent, useRef, useEffect, useState, useSyncExternalStore } from 'react';
import { SendIcon, Loader2, Moon, Sun, Trash2, Plus, MessageSquare, User, Menu, X, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from 'next-themes';
import { useUser } from '@/components/UserContext';
import { useConversations, type ConversationInfo } from '@/components/ConversationContext';
import { useSearchParams } from 'next/navigation';
import { makeTitle, textOf, toUIMessage } from '@/lib/messages';

type StoredMessage = { id: string; conversation_id: string; role: 'user' | 'assistant'; content: string };
type MessageMeta = { conversationId?: string };

// true on the client after hydration, false during SSR — without a setState-in-effect.
const subscribeNoop = () => () => {};
function useIsClient() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

/** Error bodies are JSON `{ error }` from our routes, or a plain string from the stream. */
function friendlyError(err: Error | undefined): string {
  if (!err) return '';
  try {
    const parsed = JSON.parse(err.message);
    if (parsed && typeof parsed.error === 'string') return parsed.error;
  } catch {}
  return err.message || 'Something went wrong.';
}

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
    hasInitializedRef,
    creatingRef,
  } = useConversations();

  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useIsClient();
  const { displayName, isLoading: userLoading, isReady, error: sessionError, retry: retrySession } = useUser();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const loadMessages = async (conversationId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (!res.ok) throw new Error(`Failed to fetch messages (${res.status})`);
      const data: StoredMessage[] = await res.json();
      // Tag each message with the conversation it belongs to, so the chat can tell
      // replied-to history apart from this conversation's own messages.
      setInitialMessages(data.map((m) => ({ ...toUIMessage(m), metadata: { conversationId: m.conversation_id } })));
      return true;
    } catch (err) {
      console.error('Failed to load messages:', err);
      setListError("Couldn't load that conversation.");
      return false;
    }
  };

  const createNewChat = async (parentConversationId?: string): Promise<void> => {
    if (!isReady || creatingRef.current) return;
    creatingRef.current = true;
    setListError(null);

    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: parentConversationId ? 'Reply Thought' : 'New Thought',
          parentConversationId,
        }),
      });
      if (!res.ok) throw new Error(`Failed to create conversation (${res.status})`);
      const convo: ConversationInfo = await res.json();

      if (parentConversationId) {
        // A reply carries its parent's messages as context.
        await loadMessages(convo.id);
      } else {
        setInitialMessages([]);
      }
      setActiveConversationId(convo.id);
      setConversations((prev) => [{ ...convo, parent_conversation_id: convo.parent_conversation_id ?? null }, ...prev]);
      setSidebarOpen(false);
    } catch (err) {
      // No fake local id: a conversation that doesn't exist server-side can't be saved to.
      console.error('Failed to create conversation:', err);
      setListError("Couldn't start a new conversation.");
    } finally {
      creatingRef.current = false;
    }
  };

  // Load conversations once the session is ready.
  useEffect(() => {
    if (userLoading || !isReady) return;
    // hasInitializedRef lives in the context so it stays true across navigations —
    // returning from other pages skips the entire fetch and shows state instantly.
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    // Read replyTo synchronously before any awaits, then clear it from the URL
    // immediately so a second effect run (if it ever happens) won't see it.
    const replyTo = searchParams.get('replyTo') || null;
    if (replyTo) {
      window.history.replaceState({}, '', '/chat');
    }

    async function loadConversations() {
      try {
        const res = await fetch('/api/conversations');
        if (!res.ok) throw new Error(`Failed to fetch conversations (${res.status})`);
        const data: ConversationInfo[] = await res.json();
        setConversations(data);

        if (replyTo) {
          await createNewChat(replyTo);
          return;
        }
        let savedId: string | null = null;
        try {
          savedId = sessionStorage.getItem('activeConversationId');
        } catch {}
        const restored = data.find((c) => c.id === savedId) ?? data[0];
        if (restored) {
          if (await loadMessages(restored.id)) setActiveConversationId(restored.id);
        } else {
          await createNewChat();
        }
      } catch (err) {
        console.error('Failed to load conversations:', err);
        setListError("Couldn't load your conversations.");
        hasInitializedRef.current = false;
      } finally {
        setLoadedInitial(true);
      }
    }

    loadConversations();
    // Runs once per session; the guard above makes re-runs no-ops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, isReady]);

  const selectConversation = async (id: string) => {
    setSidebarOpen(false);
    if (await loadMessages(id)) setActiveConversationId(id);
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      setListError("Couldn't delete that conversation.");
      return;
    }

    const remaining = conversations.filter((c) => c.id !== id);
    setConversations(remaining);
    if (activeConversationId === id) {
      if (remaining.length > 0) selectConversation(remaining[0].id);
      else createNewChat();
    }
  };

  // Move the conversation to the top and, on its first message, give it a title.
  const onMessageSent = (id: string, firstMessageText: string | null) => {
    setConversations((prev) => {
      const existing = prev.find((c) => c.id === id);
      if (!existing) return prev;
      const updated = {
        ...existing,
        title: firstMessageText ? makeTitle(firstMessageText) : existing.title,
        updated_at: new Date().toISOString(),
      };
      return [updated, ...prev.filter((c) => c.id !== id)];
    });
  };

  if (sessionError) {
    return (
      <div className="flex h-dvh items-center justify-center bg-white dark:bg-zinc-950">
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
      <div className="flex h-dvh items-center justify-center bg-white dark:bg-zinc-950">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          <p className="text-zinc-500 text-sm">Initializing your identity...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Backdrop for the mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
      )}

      {/* Sidebar: a drawer on small screens, a column from md up */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-lg">Conversations</h2>
            <div className="flex items-center">
              <button
                onClick={() => createNewChat()}
                className="p-2 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                title="New Chat"
                aria-label="New chat"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors md:hidden"
                aria-label="Close conversations"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {/* User identity badge */}
          <div className="flex items-center space-x-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2">
            <User className="w-3.5 h-3.5" />
            <span className="font-medium">{displayName}</span>
          </div>
        </div>
        {listError && (
          <p className="mx-2 mt-2 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {listError}
          </p>
        )}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="text-sm text-zinc-500 italic p-2">No history yet.</p>
          ) : (
            conversations.map((c) => (
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
                  className="md:opacity-0 md:group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-opacity"
                  aria-label={`Delete ${c.title}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-dvh relative min-w-0">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden"
              aria-label="Open conversations"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-semibold">Thoughts</h1>
            <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded hidden sm:inline-block">*lights a cigarrete*</span>
          </div>
          {mounted && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                aria-label="Toggle theme"
              >
                {resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          )}
        </div>

        {/* The active chat app instance */}
        {activeConversationId && isReady ? (
          <ChatApp
            key={activeConversationId} // Force remount on conversation change
            conversationId={activeConversationId}
            initialMessages={initialMessages}
            onMessageSent={onMessageSent}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-sm text-zinc-500">
            <p>{listError ?? 'No conversation selected.'}</p>
            <button
              onClick={() => createNewChat()}
              className="px-4 py-2 rounded-lg bg-black text-white dark:bg-zinc-100 dark:text-black"
            >
              New conversation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatApp({
  conversationId,
  initialMessages,
  onMessageSent,
}: {
  conversationId: string;
  initialMessages: UIMessage[];
  onMessageSent: (id: string, firstMessageText: string | null) => void;
}) {
  const [input, setInput] = useState('');
  // Whether this conversation already has its own messages (as opposed to only
  // the history of the conversation it replies to); decides the first-message title.
  const [hasOwnMessages, setHasOwnMessages] = useState(() =>
    initialMessages.some((m) => (m.metadata as MessageMeta | undefined)?.conversationId === conversationId)
  );

  // The server keeps the history: send only the new message, never the thread.
  const [transport] = useState(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: '/api/chat',
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: { conversationId: id, message: messages[messages.length - 1] },
        }),
      })
  );

  const { messages, sendMessage, status, error, setMessages, clearError } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport,
  });

  const isLoading = status === 'streaming' || status === 'submitted';
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const send = (text: string) => {
    sendMessage({ text });
    onMessageSent(conversationId, hasOwnMessages ? null : text);
    setHasOwnMessages(true);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    send(text);
  };

  // A failed turn isn't stored server-side, so retrying means: drop it locally and resend.
  const retry = () => {
    const lastUserIndex = messages.findLastIndex((m) => m.role === 'user');
    if (lastUserIndex === -1) return;
    const text = textOf(messages[lastUserIndex]);
    setMessages(messages.slice(0, lastUserIndex));
    clearError();
    sendMessage({ text });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, error]);

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-6 max-w-4xl mx-auto w-full relative">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 dark:text-zinc-400 space-y-4">
            <p>Ask a profound question or present a moral dilemma. I Dare You.</p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`px-4 py-3 rounded-2xl max-w-[85%] ${
              m.role === 'user'
                ? 'bg-black text-white dark:bg-zinc-100 dark:text-black rounded-br-sm'
                : 'bg-zinc-100 text-black dark:bg-zinc-800 dark:text-zinc-100 rounded-bl-sm border border-zinc-200 dark:border-zinc-700'
            }`}>
              {m.role === 'user' ? (
                <div className="whitespace-pre-wrap font-medium">{textOf(m)}</div>
              ) : (
                <div className="prose prose-sm max-w-none text-black dark:text-zinc-100 prose-p:text-black dark:prose-p:text-zinc-100 prose-headings:text-black dark:prose-headings:text-zinc-100 prose-strong:text-black dark:prose-strong:text-zinc-100 prose-a:text-blue-600 dark:prose-a:text-blue-400">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{textOf(m)}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {status === 'submitted' && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center space-x-2 border border-zinc-200 dark:border-zinc-700">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500 dark:text-zinc-400" />
              <span className="text-zinc-500 dark:text-zinc-400 text-sm">Getting thoughts back...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="flex justify-start">
            <div role="alert" className="px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300 flex items-center gap-3">
              <span>{friendlyError(error)}</span>
              <button onClick={retry} className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
                <RotateCcw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
        <form onSubmit={onSubmit} className="max-w-4xl mx-auto flex space-x-4">
          <input
            className="flex-1 min-w-0 p-3 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-colors"
            value={input}
            placeholder="What your thinking be like..."
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            maxLength={8000}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-black text-white dark:bg-zinc-100 dark:text-black p-3 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex shrink-0 items-center justify-center w-12 h-12"
            aria-label="Send"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </form>
      </div>
    </>
  );
}
