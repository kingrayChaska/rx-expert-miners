
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  isOwner: boolean;
  isAdmin: boolean;
  isViewer: boolean;
  isApproved: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkUserStatus = async (userId: string) => {
    try {
      const [ownerRes, adminRes, viewerRes, profileRes] = await Promise.all([
        supabase.rpc('has_role', { _user_id: userId, _role: 'owner' }),
        supabase.rpc('has_role', { _user_id: userId, _role: 'admin' }),
        supabase.rpc('has_role', { _user_id: userId, _role: 'viewer' as any }),
        supabase.from('profiles').select('is_approved').eq('user_id', userId).single(),
      ]);
      setIsOwner(!!ownerRes.data);
      setIsAdmin(!!adminRes.data);
      setIsViewer(!!viewerRes.data);
      setIsApproved(!!profileRes.data?.is_approved);
    } catch {
      setIsOwner(false);
      setIsAdmin(false);
      setIsViewer(false);
      setIsApproved(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        setTimeout(() => {
          if (mounted) checkUserStatus(currentUser.id).finally(() => {
            if (mounted) setLoading(false);
          });
        }, 0);
      } else {
        setIsOwner(false);
        setIsAdmin(false);
        setIsViewer(false);
        setIsApproved(false);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsOwner(false);
    setIsAdmin(false);
    setIsViewer(false);
    setIsApproved(false);
  };

  return (
    <AuthContext.Provider value={{ user, isOwner, isAdmin, isViewer, isApproved, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};



