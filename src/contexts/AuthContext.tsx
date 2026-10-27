import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AuthUser } from '../types/auth';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ error?: string }>;
  signUp: (email: string, pass: string, fullName: string, companyName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (userId: string, isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      }

      // 1. Busca perfil do usuário
      const { data: profile, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profError || !profile) {
        setUser(null);
        return;
      }

      // Bloqueio imediato se o perfil estiver desativado
      if (profile.is_active === false) {
        await supabase.auth.signOut();
        setUser(null);
        return;
      }

      let activeCompany: any = null;
      let activeRole = 'member';

      // 2. Tenta recuperar empresa e cargo através de memberships ATIVAS
      try {
        const { data: memberData, error: memError } = await supabase
          .from('memberships')
          .select('*, company:companies(*)')
          .eq('profile_id', userId)
          .limit(1)
          .maybeSingle();

        if (!memError && memberData) {
          // SE O VÍNCULO ESTIVER INATIVO, DERRUBA O LOGIN IMEDIATAMENTE
          if (memberData.status === 'inativo' || memberData.status === 'inactive') {
            await supabase.auth.signOut();
            setUser(null);
            return;
          }

          activeCompany = memberData.company;
          activeRole = memberData.role || 'member';
        }
      } catch (e) {
        console.warn('Consulta em memberships ignorada:', e);
      }

      // 3. Fallback: Se não encontrou empresa via membership ativa, busca direto pelo company_id do perfil
      if (!activeCompany && (profile as any).company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', (profile as any).company_id)
          .maybeSingle();

        if (companyData) {
          activeCompany = companyData;
        }
      }

      // 4. Bloqueio caso no RH (employee_records) conste como DESLIGADO ou sem acesso
      if (activeCompany) {
        const { data: empRecord } = await supabase
          .from('employee_records')
          .select('work_status, has_system_access')
          .eq('user_id', userId)
          .eq('company_id', activeCompany.id)
          .maybeSingle();

        if (empRecord && (empRecord.work_status === 'desligado' || empRecord.has_system_access === false)) {
          await supabase.auth.signOut();
          setUser(null);
          return;
        }
      }

      if (!activeCompany) {
        setUser(null);
        return;
      }

      setUser({
        profile,
        company: activeCompany,
        role: activeRole as any,
      });
    } catch (err) {
      console.error('Erro no loadUserData:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isSubscribed = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && isSubscribed) {
        loadUserData(session.user.id, true);
      } else if (isSubscribed) {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        return;
      }

      if (event === 'SIGNED_OUT') {
        if (isSubscribed) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      if (session?.user && isSubscribed) {
        loadUserData(session.user.id, false);
      } else if (isSubscribed) {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) return { error: error.message };

    // Se o login foi aceito pelo Auth, verifica se o usuário está inativo/desligado antes de liberar a tela
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', data.user.id)
        .maybeSingle();

      const { data: membership } = await supabase
        .from('memberships')
        .select('status')
        .eq('profile_id', data.user.id)
        .maybeSingle();

      const { data: empRecord } = await supabase
        .from('employee_records')
        .select('work_status, has_system_access')
        .eq('user_id', data.user.id)
        .maybeSingle();

      const isInactive = 
        profile?.is_active === false ||
        membership?.status === 'inativo' ||
        empRecord?.work_status === 'desligado' ||
        empRecord?.has_system_access === false;

      if (isInactive) {
        await supabase.auth.signOut();
        return { error: 'Seu acesso ao sistema foi revogado ou sua conta está desligada.' };
      }
    }

    return {};
  };

  const signUp = async (email: string, pass: string, fullName: string, companyName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password: pass });
    if (error) return { error: error.message };
    if (!data.user) return { error: 'Falha ao registrar usuário.' };

    const { error: rpcError } = await supabase.rpc('handle_new_signup', {
      user_id: data.user.id,
      user_email: email,
      user_full_name: fullName,
      company_name: companyName,
    });

    if (rpcError) return { error: rpcError.message };
    await loadUserData(data.user.id, true);
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);