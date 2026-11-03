import React, { useState, useRef, useEffect } from 'react';
import { useFloatingActions } from '../contexts/FloatingActionsContext';
import { Plus, X } from 'lucide-react';

export const UnifiedFloatingButton: React.FC = () => {
  const { actions, sheetTitle } = useFloatingActions();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fecha popover ao clicar fora (desktop)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Se a tela atual não tiver ações registradas, oculta o FAB
  if (!actions || actions.length === 0) return null;

  const handleFabClick = () => {
    // Se tiver apenas 1 ação no mobile/desktop, executa direto sem abrir menu
    if (actions.length === 1) {
      actions[0].onClick();
      return;
    }
    setIsOpen(prev => !prev);
  };

  const handleActionSelect = (actionFn: () => void) => {
    setIsOpen(false);
    actionFn();
  };

  return (
    <>
      {/* 1. BOTÃO FLUTUANTE (FAB) */}
      <div className="fixed bottom-6 right-6 z-[100]" ref={popoverRef}>
        
        {/* POPOVER FLUTUANTE PARA DESKTOP (md:flex) */}
        {isOpen && (
          <div className="hidden md:flex flex-col absolute bottom-full right-0 mb-3 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="px-3 py-1.5 border-b border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {sheetTitle}
              </span>
            </div>

            {actions.map(action => (
              <button
                key={action.id}
                type="button"
                onClick={() => handleActionSelect(action.onClick)}
                className="w-full p-2.5 rounded-xl text-left hover:bg-slate-50 transition-colors flex items-center gap-3 cursor-pointer group"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    action.iconBgColor || 'bg-sky-100 text-sky-700'
                  }`}
                >
                  {action.icon}
                </div>
                <div>
                  <strong className="text-xs font-bold text-slate-900 block group-hover:text-sky-700">
                    {action.label}
                  </strong>
                  {action.description && (
                    <span className="text-[10px] text-slate-500 block truncate max-w-[150px]">
                      {action.description}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* BOTÃO PRINCIPAL (Redondo no Mobile | Pílula no Desktop) */}
        <button
          type="button"
          onClick={handleFabClick}
          className={`flex items-center justify-center text-white shadow-2xl transition-all duration-200 cursor-pointer active:scale-95 group border border-sky-400/30 ${
            isOpen ? 'bg-slate-900 hover:bg-slate-800' : 'bg-sky-600 hover:bg-sky-500'
          } w-14 h-14 rounded-full md:w-auto md:h-auto md:px-4 md:py-3 md:rounded-2xl`}
          title={sheetTitle}
        >
          <div className={`transition-transform duration-200 ${isOpen ? 'rotate-45' : 'rotate-0'}`}>
            <Plus size={24} strokeWidth={2.5} />
          </div>
          <span className="hidden md:inline font-bold text-xs tracking-wide ml-2">
            {isOpen ? 'Fechar' : actions.length === 1 ? actions[0].label : 'Ações Rápidas'}
          </span>
        </button>
      </div>

      {/* 2. ACTION SHEET DESLIZANTE PARA MOBILE (< md) */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-[150] flex flex-col justify-end bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

          <div className="relative bg-white rounded-t-3xl p-5 space-y-3 animate-in slide-in-from-bottom duration-200 border-t border-slate-200 shadow-2xl">
            {/* Puxador Cinza (Pill) */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2" />

            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
              {sheetTitle}
            </h3>

            {/* Lista de Ações no Estilo Card com Ícones */}
            <div className="space-y-2 pt-1 max-h-[60vh] overflow-y-auto">
              {actions.map(action => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleActionSelect(action.onClick)}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors cursor-pointer active:scale-98"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      action.iconBgColor || 'bg-sky-100 text-sky-700'
                    }`}
                  >
                    {action.icon}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{action.label}</p>
                    {action.description && (
                      <p className="text-[11px] text-slate-500 font-normal truncate">
                        {action.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};