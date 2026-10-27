import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  User, 
  Mail, 
  ShieldCheck, 
  ArrowRight 
} from 'lucide-react';

interface AcceptInviteScreenProps {
  token: string;
  onSuccess: () => void;
}

export const AcceptInviteScreen: React.FC<AcceptInviteScreenProps> = ({ token, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    async function verifyToken() {
      try {
        setLoading(true);
        setError('');

        const cleanToken = token.trim();

        // 1. Pesquisa direta pelo token
        const { data: invite, error: inviteErr } = await supabase
          .from('company_invites')
          .select('*')
          .eq('token', cleanToken)
          .maybeSingle();

        if (inviteErr || !invite) {
          setError('Convite inválido ou não encontrado.');
          return;
        }

        if (invite.status !== 'pending') {
          setError('Este convite já foi utilizado ou cancelado.');
          return;
        }

        if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
          setError('Este convite expirou. Solicite um novo convite ao administrador.');
          return;
        }

        // 2. Procura os dados da empresa (nome, logotipo)
        let companyData = null;
        if (invite.company_id) {
          const { data: comp } = await supabase
            .from('companies')
            .select('name, trade_name, logo_url')
            .eq('id', invite.company_id)
            .maybeSingle();
          companyData = comp;
        }

        setInviteData({
          ...invite,
          companies: companyData
        });
        setFullName(invite.full_name || '');
      } catch (err: any) {
        console.error('Falha na validação do convite:', err);
        setError('Ocorreu um erro ao validar o convite.');
      } finally {
        setLoading(false);
      }
    }

    verifyToken();
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A palavra-passe deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As palavras-passe não coincidem.');
      return;
    }

    try {
      setSubmitting(true);

      // 1. Cria a conta no Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: inviteData.email,
        password: password,
        options: {
          data: {
            full_name: fullName.trim()
          }
        }
      });

      let userId = authData?.user?.id;

      // Se já existia conta ou se precisa autenticar
      if (authErr) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: inviteData.email,
          password: password
        });

        if (signInErr) {
          setError(`Erro ao criar utilizador: ${authErr.message}`);
          return;
        }
        userId = signInData.user.id;
      } else if (!userId) {
        // Tenta pegar a sessão ativa criada
        const { data: sessionData } = await supabase.auth.getSession();
        userId = sessionData.session?.user?.id;
      }

      if (!userId) {
        setError('Não foi possível identificar a sua conta criada.');
        return;
      }

      // 2. Chama a RPC com SECURITY DEFINER (Grava profile, membership e aceita o convite sem bloqueio de RLS)
      const { data: rpcResponse, error: rpcErr } = await supabase.rpc('accept_company_invite', {
        p_invite_token: token.trim(),
        p_user_id: userId,
        p_full_name: fullName.trim()
      });

      if (rpcErr || (rpcResponse && !rpcResponse.success)) {
        console.error('Erro na RPC de aceite:', rpcErr || rpcResponse);
        setError(rpcResponse?.message || 'Erro ao vincular membro à empresa.');
        return;
      }

      // 3. Força o login com a senha recém-criada para entrar direto no sistema autenticado
      await supabase.auth.signInWithPassword({
        email: inviteData.email,
        password: password
      });

      onSuccess();
    } catch (err: any) {
      console.error('Erro ao aceitar convite:', err);
      setError('Ocorreu um erro ao concluir o registo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 gap-3">
        <Loader2 className="animate-spin text-sky-500" size={32} />
        <p className="text-sm font-medium">A carregar o seu convite...</p>
      </div>
    );
  }

  if (error && !inviteData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center space-y-4 shadow-2xl border border-slate-200">
          <div className="h-14 w-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Convite Inválido ou Expirado</h2>
          <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            Voltar à página de início
          </a>
        </div>
      </div>
    );
  }

  const company = inviteData?.companies;
  const companyName = company?.trade_name || company?.name || 'Empresa Convidante';
  const companyLogo = company?.logo_url;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Efeito de iluminação de fundo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden relative z-10 flex flex-col">
        {/* Cabeçalho da Empresa */}
        <div className="p-6 sm:p-7 text-center border-b border-slate-100 bg-slate-50/50">
          <div className="h-20 w-36 mx-auto rounded-2xl bg-white border border-slate-200/70 p-2.5 flex items-center justify-center shadow-2xs mb-3.5">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={companyName}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="flex items-center gap-1.5 text-sky-700 font-bold text-sm">
                <Building2 size={20} />
                <span className="truncate max-w-[100px]">{companyName}</span>
              </div>
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200/80 mb-2">
            <ShieldCheck size={13} />
            Convite de {companyName}
          </div>

          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Junte-se à nossa equipe
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Foi convidado para colaborar como{' '}
            <strong className="text-slate-800 font-semibold">{inviteData?.role_title || 'Membro'}</strong>.
          </p>
        </div>

        {/* Formulário */}
        <div className="p-6 sm:p-7 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAccept} className="space-y-4 text-xs sm:text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                O seu Nome *
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                E-mail de Acesso
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="email"
                  disabled
                  value={inviteData?.email}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Definir Senha *
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Mínimo de 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Confirmar Senha *
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Repetir a senha  "
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 mt-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  A configurar a sua conta...
                </>
              ) : (
                <>
                  Concluir Registo e Entrar
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Rodapé com contraste da marca Lume */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 text-center flex items-center justify-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-sky-600/30 flex items-center justify-center text-sky-400 font-black text-[11px]">
            L
          </div>
          <span className="text-[11px] text-slate-300 font-semibold tracking-wide">
            Lume <span className="text-slate-500 font-normal">| Hub de Gestão</span>
          </span>
        </div>
      </div>
    </div>
  );
};