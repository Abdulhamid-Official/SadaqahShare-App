import React, { createContext, useContext, useState, useCallback } from 'react';
import { AppState, Donor, MosqueAccount, UserRole } from './types';

interface AppContextType extends AppState {
  setRole: (role: UserRole) => void;
  setDonor: (donor: Donor | null) => void;
  setMosqueAccount: (account: MosqueAccount | null) => void;
  setMosqueName: (name: string | null) => void;
  setMosqueCity: (city: string | null) => void;
  setMosqueState: (state: string | null) => void;
  setIsPaid: (paid: boolean) => void;
  setIsAdmin: (admin: boolean) => void;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>(null);
  const [donor, setDonor] = useState<Donor | null>(null);
  const [mosqueAccount, setMosqueAccount] = useState<MosqueAccount | null>(null);
  const [mosqueName, setMosqueName] = useState<string | null>(null);
  const [mosqueCity, setMosqueCity] = useState<string | null>(null);
  const [mosqueState, setMosqueState] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const logout = useCallback(() => {
    setRole(null);
    setDonor(null);
    setMosqueAccount(null);
    setMosqueName(null);
    setMosqueCity(null);
    setMosqueState(null);
    setIsPaid(false);
    setIsAdmin(false);
  }, []);

  return (
    <AppContext.Provider
      value={{
        role,
        donor,
        mosqueAccount,
        mosqueName,
        mosqueCity,
        mosqueState,
        isPaid,
        isAdmin,
        setRole,
        setDonor,
        setMosqueAccount,
        setMosqueName,
        setMosqueCity,
        setMosqueState,
        setIsPaid,
        setIsAdmin,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
