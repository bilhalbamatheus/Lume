import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Lock, Mail, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import logoImg from '../assets/logo.png';

export const AuthScreen: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    if (isRegister) {
      if (!companyName.trim() || !fullName.trim()) {
        setErrorMsg('Preencha todos os campos obrigatórios.');
        setSubmitting(false);
        return;
      }
      const res = await signUp(email, password, fullName, companyName);
      if (res.error) setErrorMsg(res.error);
    } else {
      const res = await signIn(email, password);
      if (res.error) setErrorMsg(res.error);
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-50 text-slate-800">
      {/* ======================================================== */}
      {/* COLUNA ESQUERDA: Apresentação Visual (Desktop)           */}
      {/* ======================================================== */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-100 via-sky-50 to-slate-200 items-center justify-center p-12 overflow-hidden border-r border-slate-200/80">
        {/* Círculos Concorrentes Geométricos Sutis */}
        <div className="absolute w-[640px] h-[640px] rounded-full border border-sky-300/40 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[500px] rounded-full border border-sky-400/30 flex items-center justify-center">
            <div className="w-[360px] h-[360px] rounded-full border border-sky-500/25 flex items-center justify-center">
              <div className="w-[220px] h-[220px] rounded-full border border-sky-600/20" />
            </div>
          </div>
        </div>

        {/* Pontos de destaque nos círculos */}
        <div className="absolute w-3 h-3 rounded-full bg-sky-500 shadow-md shadow-sky-500/30 top-1/4 left-1/4 animate-pulse" />
        <div className="absolute w-2.5 h-2.5 rounded-full bg-sky-400 top-2/3 left-1/3" />
        <div className="absolute w-3.5 h-3.5 rounded-full bg-sky-600 bottom-1/4 right-1/4" />

        {/* Card Principal de Apresentação */}
        <div className="relative z-10 max-w-md w-full bg-white/90 backdrop-blur-md p-8 rounded-3xl shadow-xl border border-white/60 text-center">
          {/* Card da Logo Maior com fundo #0D243D */}
          <div 
            style={{ backgroundColor: '#0D243D' }} 
            className="px-10 py-6 rounded-3xl inline-flex items-center justify-center mb-6 shadow-xl border border-[#0D243D]/50"
          >
            <img 
              src={logoImg} 
              alt="Lume" 
              className="h-20 w-auto object-contain" 
            />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Gestão Descomplicada
          </h2>
          <p className="text-sm text-slate-500 mt-3 leading-relaxed">
            Centralize seus contatos, gerencie seu funil de vendas em tempo real e crie orçamentos para seus serviços. Entre para transformar seus resultados.
          </p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* COLUNA DIREITA: Formulário (Ocupa 100% no Celular)        */}
      {/* ======================================================== */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md">
          {/* Logo no topo apenas no celular (Maior) */}
          <div className="flex justify-center mb-6 lg:hidden">
            <div 
              style={{ backgroundColor: '#0D243D' }} 
              className="px-8 py-4 rounded-2xl shadow-lg border border-[#0D243D]/50"
            >
              <img 
                src={logoImg} 
                alt="Lume" 
                className="h-14 w-auto object-contain" 
              />
            </div>
          </div>

          {/* Título de Boas-Vindas */}
          <div className="text-center lg:text-left mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isRegister ? 'Crie sua Conta' : 'Bem-vindo de volta'}
            </h1>
            <p className="text-sm text-slate-500 mt-1.5">
              {isRegister 
                ? 'Cadastre sua empresa e comece a gerenciar hoje mesmo.' 
                : 'Acesse seu painel e continue suas negociações.'}
            </p>
          </div>

          {/* Seletor Estilo Pílula (Entrar / Criar Conta) */}
          <div className="flex bg-slate-200/70 p-1 rounded-xl mb-6 text-sm font-semibold">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setErrorMsg(''); }}
              className={`flex-1 py-2 rounded-lg text-center transition-all cursor-pointer ${
                !isRegister
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setErrorMsg(''); }}
              className={`flex-1 py-2 rounded-lg text-center transition-all cursor-pointer ${
                isRegister
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Criar Conta
            </button>
          </div>

          {/* Mensagem de Erro */}
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Formulário Principal */}
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Nome da Empresa / Construtora *
                  </label>
                  <div className="relative">
                    <Building2 size={18} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Ex: Alfa Construções"
                      className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Seu Nome Completo *
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ex: Matheus Silva"
                      className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all shadow-sm"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                E-mail *
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@gmail.com"
                  className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all shadow-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-600">
                  Senha *
                </label>
                {!isRegister && (
                  <button 
                    type="button" 
                    className="text-xs text-sky-600 hover:text-sky-700 font-medium cursor-pointer"
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 rounded-xl shadow-md shadow-sky-600/25 transition-all disabled:opacity-50 cursor-pointer active:scale-98"
            >
              {submitting ? 'Aguarde...' : isRegister ? 'Cadastrar Minha Empresa' : 'Entrar no Sistema'}
              <ArrowRight size={18} />
            </button>
          </form>

          {/* Rodapé Alternador */}
          <div className="mt-8 text-center text-xs text-slate-500">
            {isRegister ? (
              <p>
                Já possui uma conta?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegister(false); setErrorMsg(''); }}
                  className="text-sky-600 hover:text-sky-700 font-semibold cursor-pointer"
                >
                  Fazer login
                </button>
              </p>
            ) : (
              <p>
                Não tem uma conta?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegister(true); setErrorMsg(''); }}
                  className="text-sky-600 hover:text-sky-700 font-semibold cursor-pointer"
                >
                  Cadastre sua empresa
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};