import React from 'react';
import {
  X,
  Building2,
  Sliders,
  Network,
  ChevronRight,
  ShieldCheck,
  Package,
  Layers
} from 'lucide-react';

interface SettingsHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOption: (option: 'company' | 'system' | 'organization') => void;
}

export const SettingsHubModal: React.FC<SettingsHubModalProps> = ({
  isOpen,
  onClose,
  onSelectOption
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
              Configurações da Empresa
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Selecione a área que deseja parametrizar no sistema.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 3 Opções de Acesso */}
        <div className="space-y-3">
          
          {/* Card 1: Dados Gerais */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectOption('company');
            }}
            className="w-full p-4 rounded-2xl border border-slate-200 hover:border-sky-300 bg-white hover:bg-sky-50/20 transition-all text-left flex items-center justify-between group cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Building2 size={20} />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-slate-900 text-sm group-hover:text-sky-700 transition-colors">
                  Dados Gerais da Empresa
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  Razão Social, CNPJ, contato, endereço e logomarca.
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-sky-600 transition-colors shrink-0 ml-2" />
          </button>

          {/* Card 2: Cadastros do Sistema */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectOption('system');
            }}
            className="w-full p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/20 transition-all text-left flex items-center justify-between group cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Sliders size={20} />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                  Cadastros & Catálogo do Sistema
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  Catálogo de insumos, tipos de serviços e funil comercial.
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-emerald-600 transition-colors shrink-0 ml-2" />
          </button>

          {/* Card 3: Estrutura Organizacional */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectOption('organization');
            }}
            className="w-full p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/20 transition-all text-left flex items-center justify-between group cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Network size={20} />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-slate-900 text-sm group-hover:text-indigo-700 transition-colors">
                  Estrutura Organizacional & Acessos
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  Setores, equipes operacionais, colaboradores e níveis de acesso.
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-600 transition-colors shrink-0 ml-2" />
          </button>

        </div>

      </div>
    </div>
  );
};

export default SettingsHubModal;