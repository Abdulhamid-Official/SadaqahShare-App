import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { AppState, Donor, MosqueAccount, Mosque, UserRole, Profile } from './types';

interface AppContextType extends AppState {
  setRole: (role: UserRole) => void;
  setDonor: (donor: Donor | null) => void;
  setMosqueAccount: (account: MosqueAccount | null) => void;
  setMosqueName: (name: string | null) => void;
  setMosqueCity: (city: string | null) => void;
  setMosqueState: (state: string | null) => void;
  setIsPaid: (paid: boolean) => void;
  setIsAdmin: (admin: boolean) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
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
  const [session, setSession] = useState<{ user: { id: string; email: string; emailConfirmed: boolean } | null; profile: Profile | null } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Track which user ID we've loaded profile data for, to avoid redundant loads
  const loadedUserId = useRef<string | null>(null);

  const clearAppState = useCallback(() => {
    setRole(null);
    setDonor(null);
    setMosqueAccount(null);
    setMosqueName(null);
    setMosqueCity(null);
    setMosqueState(null);
    setIsPaid(false);
    setIsAdmin(false);
    setSession(null);
    loadedUserId.current = null;
  }, []);

  const loadProfileData = useCallback(async (user: User) => {
    // Skip if already loaded for this same user
    if (loadedUserId.current === user.id) {
      setAuthLoading(false);
      return;
    }
    loadedUserId.current = user.id;

    try {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileErr) {
        console.error('Profile fetch error:', profileErr);
        setAuthLoading(false);
        return;
      }

      const typedProfile = profile as Profile | null;

      setSession({
        user: {
          id: user.id,
          email: user.email ?? '',
          emailConfirmed: user.email_confirmed_at != null,
        },
        profile: typedProfile,
      });

      if (typedProfile) {
        if (typedProfile.role === 'donor' && typedProfile.donor_id) {
          const { data: donorData } = await supabase
            .from('donors')
            .select('*')
            .eq('id', typedProfile.donor_id)
            .maybeSingle();
          if (donorData) {
            setDonor(donorData as Donor);
            setRole('donor');
          }
        } else if (typedProfile.role === 'mosque' && typedProfile.mosque_account_id) {
          const { data: accountData } = await supabase
            .from('mosque_accounts')
            .select('*')
            .eq('id', typedProfile.mosque_account_id)
            .maybeSingle();
          if (accountData) {
            const account = accountData as MosqueAccount;
            setMosqueAccount(account);
            setRole('mosque');
            setIsPaid(account.is_paid);

            const { data: mosqueData } = await supabase
              .from('mosques')
              .select('*')
              .eq('id', account.mosque_id)
              .maybeSingle();
            if (mosqueData) {
              const mosque = mosqueData as Mosque;
              setMosqueName(mosque.name);
              setMosqueCity(mosque.city);
              setMosqueState(mosque.state);
            }
          }
        }
      }
    } catch (err) {
      console.error('loadProfileData error:', err);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // Session restoration on mount + onAuthStateChange
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (existingSession?.user) {
          await loadProfileData(existingSession.user);
        } else {
          setAuthLoading(false);
        }
      } catch (err) {
        console.error('Session restoration error:', err);
        if (mounted) setAuthLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || !newSession?.user) {
        clearAppState();
        setAuthLoading(false);
        return;
      }

      // Only reload on actual sign-in or user update, not token refresh
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        loadProfileData(newSession.user);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfileData, clearAppState]);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
    clearAppState();
  }, [clearAppState]);

  const refreshSession = useCallback(async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.user) {
        // Force reload by clearing the loaded user ID
        loadedUserId.current = null;
        await loadProfileData(currentSession.user);
      }
    } catch (err) {
      console.error('Refresh session error:', err);
    }
  }, [loadProfileData]);

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
        session,
        authLoading,
        setRole,
        setDonor,
        setMosqueAccount,
        setMosqueName,
        setMosqueCity,
        setMosqueState,
        setIsPaid,
        setIsAdmin,
        logout,
        refreshSession,
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
