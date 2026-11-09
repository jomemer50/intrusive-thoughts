"use client";

import { createContext, useContext, ReactNode } from 'react';
import { useAnonymousUser } from '@/hooks/useAnonymousUser';

type UserContextType = {
  displayName: string | null;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  retry: () => void;
};

const UserContext = createContext<UserContextType>({
  displayName: null,
  isLoading: true,
  isReady: false,
  error: null,
  retry: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const user = useAnonymousUser();

  return (
    <UserContext.Provider value={user}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
