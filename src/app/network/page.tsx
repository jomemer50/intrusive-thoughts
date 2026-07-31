"use client";

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Moon, Sun, RefreshCw, Globe } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import NetworkGraph, { type GraphNode } from '@/components/NetworkGraph';
import ConversationPanel from '@/components/ConversationPanel';
import { useUser } from '@/components/UserContext';
import { supabase } from '@/lib/supabase';

export default function NetworkPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { displayName } = useUser();

  const fetchNetwork = useCallback(async () => {
    try {
      const res = await fetch('/api/network');
      if (!res.ok) throw new Error('Failed to fetch network');
      const data = await res.json();
      setNodes(data.nodes || []);
    } catch (err) {
      console.error('Failed to fetch network:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchNetwork();

    // Realtime subscription for new conversations
    const channel = supabase
      .channel('network-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        () => {
          // Refetch when new conversations are created
          fetchNetwork();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        () => {
          fetchNetwork();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNetwork]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
  }, []);

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex-col relative overflow-hidden">
      {/* Top bar */}
      <div className="p-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm z-40 flex-shrink-0">
        <div className="flex items-center space-x-4">
          <Link href="/chat" className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center text-zinc-600 dark:text-zinc-300">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="font-medium text-sm">Chat</span>
          </Link>
          <div className="flex items-center space-x-2 border-l pl-4 border-zinc-200 dark:border-zinc-800">
            <Globe className="w-5 h-5 text-zinc-500" />
            <h1 className="font-semibold">Thought Network</h1>
            <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-1 rounded-full">
              Last 24h · {nodes.length} thoughts
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => { setLoading(true); fetchNetwork(); }}
            className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {mounted && (
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              {resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Graph area */}
      <div className="flex-1 relative overflow-hidden">
        {loading && nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-10 h-10 border-3 border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-300 rounded-full animate-spin" />
              <p className="text-zinc-500 font-medium">Loading the network...</p>
            </div>
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center space-y-4 text-center px-6">
              <Globe className="w-16 h-16 text-zinc-300 dark:text-zinc-700" />
              <h2 className="text-xl font-bold text-zinc-700 dark:text-zinc-300">No thoughts yet</h2>
              <p className="text-zinc-500 max-w-md">
                The network is empty. Be the first to share a thought — 
                start a conversation and it will appear here for others to discover.
              </p>
              <Link
                href="/chat"
                className="mt-2 px-6 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                Start a Thought
              </Link>
            </div>
          </div>
        ) : (
          <NetworkGraph nodes={nodes} onNodeClick={handleNodeClick} />
        )}

        {/* Conversation panel overlay */}
        {selectedNode && (
          <ConversationPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>

      {/* Bottom identity bar */}
      {displayName && (
        <div className="absolute bottom-4 left-4 z-40 text-xs text-zinc-400 dark:text-zinc-600 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800">
          Viewing as <span className="font-medium text-zinc-600 dark:text-zinc-400">{displayName}</span>
        </div>
      )}
    </div>
  );
}
