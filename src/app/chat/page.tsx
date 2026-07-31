import { Suspense } from 'react';
import ChatClient from './ChatClient';

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-white dark:bg-zinc-950">
        <p className="text-zinc-500 text-sm">Loading...</p>
      </div>
    }>
      <ChatClient />
    </Suspense>
  );
}