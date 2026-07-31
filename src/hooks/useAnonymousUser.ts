"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'rungtatron_user_id';

function generateDisplayName(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `Thinker-${suffix}`;
}

export function useAnonymousUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initUser() {
      try {
        const existingId = localStorage.getItem(STORAGE_KEY);

        if (existingId) {
          // Returning user — fetch their display name
          const { data, error } = await supabase
            .from('users')
            .select('id, display_name')
            .eq('id', existingId)
            .single();

          if (data && !error) {
            setUserId(data.id);
            setDisplayName(data.display_name);
            setIsLoading(false);
            return;
          }
          // If user not found in DB (maybe tables were reset), fall through to create new
        }

        // New user — generate identity and persist
        const newDisplayName = generateDisplayName();
        const { data, error } = await supabase
          .from('users')
          .insert({ display_name: newDisplayName })
          .select('id, display_name')
          .single();

        if (data && !error) {
          localStorage.setItem(STORAGE_KEY, data.id);
          setUserId(data.id);
          setDisplayName(data.display_name);
        } else {
          console.error('Failed to create anonymous user:', error);
          // Fallback: generate a local-only identity so the app still works
          const fallbackId = crypto.randomUUID();
          localStorage.setItem(STORAGE_KEY, fallbackId);
          setUserId(fallbackId);
          setDisplayName(newDisplayName);
        }
      } catch (err) {
        console.error('Anonymous user init error:', err);
        // Fallback for offline/error scenarios
        const fallbackId = crypto.randomUUID();
        const fallbackName = generateDisplayName();
        localStorage.setItem(STORAGE_KEY, fallbackId);
        setUserId(fallbackId);
        setDisplayName(fallbackName);
      } finally {
        setIsLoading(false);
      }
    }

    initUser();
  }, []);

  return { userId, displayName, isLoading };
}
