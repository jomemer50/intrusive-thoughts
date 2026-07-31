"use client";

import { useState, useEffect } from 'react';
import { X, MessageSquare, Clock, User, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { GraphNode } from './NetworkGraph';

type Message = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

type Props = {
  node: GraphNode;
  onClose: () => void;
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function ConversationPanel({ node, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMessages() {
      try {
        const res = await fetch(`/api/conversations/${node.id}/messages`);
        if (!res.ok) throw new Error('Failed to fetch messages');
        const data = await res.json();
        setMessages(data);
      } catch (err) {
        console.error('Failed to load conversation messages:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMessages();
  }, [node.id]);

  return (
    <div className="absolute top-0 right-0 w-full max-w-md h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col z-50 shadow-2xl animate-slide-in">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base truncate text-zinc-900 dark:text-white">
            {node.title}
          </h3>
          <div className="flex items-center space-x-3 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center space-x-1">
              <User className="w-3 h-3" />
              <span>{node.displayName}</span>
            </span>
            <span className="flex items-center space-x-1">
              <MessageSquare className="w-3 h-3" />
              <span>{node.messageCount} messages</span>
            </span>
            <span className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{timeAgo(node.updatedAt)}</span>
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ml-2 flex-shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-6 h-6 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-300 rounded-full animate-spin" />
              <p className="text-sm text-zinc-500">Loading conversation...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-zinc-500 italic">No messages yet.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`px-3 py-2 rounded-xl max-w-[90%] text-sm ${
                m.role === 'user'
                  ? 'bg-black text-white dark:bg-zinc-100 dark:text-black rounded-br-sm'
                  : 'bg-zinc-100 text-black dark:bg-zinc-800 dark:text-zinc-100 rounded-bl-sm border border-zinc-200 dark:border-zinc-700'
              }`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                <p className={`text-xs mt-1 ${
                  m.role === 'user'
                    ? 'text-zinc-400 dark:text-zinc-500'
                    : 'text-zinc-400 dark:text-zinc-500'
                }`}>
                  {timeAgo(m.created_at)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Hop On button */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0">
        <Link
          href={`/chat?replyTo=${node.id}`}
          className="flex items-center justify-center space-x-2 w-full py-3 px-4 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
        >
          <span>Hop On This Thought</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
