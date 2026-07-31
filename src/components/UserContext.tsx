"use client";

import { createContext, useContext, ReactNode } from 'react';
import { useAnonymousUser } from '@/hooks/useAnonymousUser';

type UserContextType = {
  userId: string | null;
  displayName: string | null;
  isLoading: boolean;
};

const UserContext = createContext<UserContextType>({
  userId: null,
  displayName: null,
  isLoading: true,
});

export function UserProvider({ children }: { children: ReactNode }) {
  const { userId, displayName, isLoading } = useAnonymousUser();

  return (
    <UserContext.Provider value={{ userId, displayName, isLoading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
