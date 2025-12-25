import React, { createContext, useContext } from 'react';
import { User, Permission } from './types';

export interface AuthContextType {
  user: User | null;
  currentStoreId: number | null; 
  login: (u: User, storeId?: number) => void;
  logout: () => Promise<void>;
  switchStore: (storeId: number) => void;
  hasPermission: (permission: Permission) => boolean;
  openProfile: () => void;
}

export const AuthContext = createContext<AuthContextType>(null!);

export const useAuth = () => useContext(AuthContext);
