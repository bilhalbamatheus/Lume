import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Phone, MapPin, Briefcase, ArrowRight } from 'lucide-react';
import logoImg from '../assets/logo.png';

interface OnboardingScreenProps {
  onComplete: () => void;
}

// Lista contendo apenas as siglas oficiais das 27 UFs do Brasil
const BRAZILIAN_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

// Função utilitária para aplicar máscara de CNPJ
const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

// Função utilitária para aplicar máscara de Telefone / WhatsApp
const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const [cnpj, setCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Pelotas');
  const [state, setState] = useState('RS');
  const [segment, setSegment] = useState('Instalações Elétricas e Hidráulicas');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCnpj(formatCNPJ(e.target.value));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.company?.id) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase
        .from('companies')
        .update({
          document: cnpj,
          phone,
          city: city.trim(),
          state,
          segment,
          onboarded: true,
        })
        .eq('id', user.company.id);

      if (error) throw error;
      onComplete();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar os dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 text-slate-800">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xl">
        
        {/* Cabeçalho da Marca Lume */}
        <div className="text-center mb-8">
          <div 
            style={{ backgroundColor: '#0D243D' }} 
            className="px-6 py-3 rounded-2xl inline-flex items-center justify-center mb-4 shadow-md border border-[#0D243D]/50"
          >
            <img src={logoImg} alt="Lume" className="h-10 w-auto object-contain" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Configure sua Empresa
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Complete os dados de <strong>{user?.company?.name}</strong> para emitir orçamentos e gerenciar seu funil comercial.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* Segmento */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Segmento de Atuação *
            </label>
            <div className="relative">
              <Briefcase size={18} className="absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="w-full pl-11 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm cursor-pointer"
              >
                <option value="Instalações Elétricas e Hidráulicas">Instalações Elétricas e Hidráulicas</option>
                <option value="Energia Solar Fotovoltaica">Energia Solar Fotovoltaica</option>
                <option value="Construção Civil Geral">Construção Civil Geral</option>
                <option value="Reformas e Acabamentos">Reformas e Acabamentos</option>
                <option value="Estruturas Metálicas e Pré-moldados">Estruturas Metálicas e Pré-moldados</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* CNPJ com Máscara */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                CNPJ (opcional)
              </label>
              <div className="relative">
                <Building2 size={18} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={handleCnpjChange}
                  maxLength={18}
                  className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm font-mono text-xs"
                />
              </div>
            </div>

            {/* Telefone / WhatsApp com Máscara */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Telefone / WhatsApp Comercial *
              </label>
              <div className="relative">
                <Phone size={18} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={handlePhoneChange}
                  maxLength={15}
                  className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Cidade */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Cidade *
              </label>
              <div className="relative">
                <MapPin size={18} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Pelotas"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
                />
              </div>
            </div>

            {/* Dropdown de Estado / UF apenas com Sigla */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                UF *
              </label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-2.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 font-semibold text-center focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm cursor-pointer"
              >
                {BRAZILIAN_UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 rounded-xl shadow-md shadow-sky-600/25 transition-all disabled:opacity-50 cursor-pointer active:scale-98"
          >
            {loading ? 'Salvando...' : 'Concluir e Ir para o Pipeline'}
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};