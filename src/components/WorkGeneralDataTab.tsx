import React from 'react';
import {
  Building2,
  Briefcase,
  ExternalLink,
  Star,
  Calendar,
  Clock,
  Scale,
  Zap,
  Users,
  FileCheck
} from 'lucide-react';
import type { WorkDetailData } from './WorkDetailView';

export interface AssignedWorker {
  id: string;
  full_name: string;
  role_title?: string;
  avatar_url?: string | null;
  is_foreman?: boolean;
}

interface WorkGeneralDataTabProps {
  work: WorkDetailData;
  assignedWorkers: AssignedWorker[];
  canCustomizeSystem: boolean;
  onOpenContactModal?: (contactId: string) => void;
  onOpenOpportunityModal?: (opportunityId: string) => void;
  onOpenSettings?: () => void;
}

const getInitials = (name: string) => {
  if (!name) return 'EX';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const WorkGeneralDataTab: React.FC<WorkGeneralDataTabProps> = ({
  work,
  assignedWorkers,
  canCustomizeSystem,
  onOpenContactModal,
  onOpenOpportunityModal,
  onOpenSettings
}) => {
  const foremenList = assignedWorkers.filter(w => w.is_foreman);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 animate-in fade-in duration-150">
      
      {/* 1. CARDS CADASTRAIS DE TOPO (Sem valores em R$ e sem barra de progresso) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        
        {/* Orçamento Fechado Homologado */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileCheck size={14} className="text-sky-600" />
              <span>Orçamento Fechado</span>
            </span>
            {work.opportunity?.service_type && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold">
                <Zap size={10} className="text-amber-500" />
                <span>{work.opportunity.service_type}</span>
              </span>
            )}
          </div>
          <strong className="text-sm sm:text-base font-extrabold text-slate-900 block truncate pt-0.5" title={work.opportunity?.title || 'Contrato Homologado'}>
            {work.opportunity?.title || 'Orçamento Homologado'}
          </strong>
          <span className="text-[11px] text-slate-400 font-mono block">
            {work.opportunity?.code ? `Ref: ${work.opportunity.code}` : 'Proposta aprovada vinculada'}
          </span>
        </div>

        {/* Data de Início Operacional */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Data de Início Prevista
          </span>
          <div className="flex items-center gap-2 pt-0.5 font-bold text-slate-800 text-sm sm:text-base">
            <Calendar size={16} className="text-sky-600" />
            <span>
              {work.start_date
                ? new Date(work.start_date + 'T00:00:00').toLocaleDateString('pt-BR')
                : 'Não definida'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block">Mobilização do canteiro</span>
        </div>

        {/* Previsão de Conclusão / Entrega */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Previsão de Conclusão
          </span>
          <div className="flex items-center gap-2 pt-0.5 font-bold text-slate-800 text-sm sm:text-base">
            <Clock size={16} className="text-amber-500" />
            <span>
              {work.estimated_completion_date
                ? new Date(work.estimated_completion_date + 'T00:00:00').toLocaleDateString('pt-BR')
                : 'Não definida'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block">Prazo contratual estipulado</span>
        </div>

      </div>

      {/* 2. GRADE DE BLOCOS PRINCIPAIS (DADOS OPERACIONAIS & VÍNCULOS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* COLUNA ESQUERDA: PARCEIROS, CLIENTE & CONTRATOS */}
        <div className="space-y-4">
          
          {/* Card: Cliente / Contratante */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Cliente / Contratante
            </span>

            {work.contact ? (
              <div
                onClick={() => work.contact?.id && onOpenContactModal?.(work.contact.id)}
                className="p-3 bg-slate-50/70 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 transition flex items-center justify-between gap-3 cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-sm shrink-0 border border-slate-200 group-hover:scale-105 transition-transform">
                    {work.contact.avatar_url ? (
                      <img src={work.contact.avatar_url} alt="" className="w-full h-full object-cover rounded-xl" />
                    ) : work.contact.type === 'company' ? (
                      <Building2 size={18} />
                    ) : (
                      work.contact.display_name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <strong className="block text-sm font-bold text-slate-900 group-hover:text-sky-600 transition truncate">
                      {work.contact.display_name}
                    </strong>
                    <span className="text-xs text-slate-400 truncate block">
                      {work.contact.type === 'company' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                    </span>
                  </div>
                </div>
                <ExternalLink size={15} className="text-slate-400 group-hover:text-sky-600 shrink-0" />
              </div>
            ) : (
              <p className="text-slate-400 italic text-xs">Nenhum cliente vinculado a esta obra.</p>
            )}
          </div>

          {/* Card: Negociação Comercial de Origem */}
          {work.opportunity && (
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Oportunidade Comercial de Origem
              </span>

              <div
                onClick={() => work.opportunity?.id && onOpenOpportunityModal?.(work.opportunity.id)}
                className="p-3 bg-slate-50/70 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 transition flex items-center justify-between gap-3 cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-slate-200 group-hover:scale-105 transition-transform">
                    <Briefcase size={18} />
                  </div>
                  <div className="min-w-0">
                    <strong className="block text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition truncate">
                      {work.opportunity.title}
                    </strong>
                    <span className="text-xs text-slate-400 font-mono truncate block">
                      {work.opportunity.code || 'Sem código comercial'}
                    </span>
                  </div>
                </div>
                <ExternalLink size={15} className="text-slate-400 group-hover:text-emerald-600 shrink-0" />
              </div>

              {work.opportunity.commercial_owner && (
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="text-slate-500 font-medium">Responsável Comercial:</span>
                  <span className="font-bold text-slate-800">{work.opportunity.commercial_owner.full_name}</span>
                </div>
              )}
            </div>
          )}

          {/* Card: Diretrizes e Observações Operacionais */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Observações Operacionais
            </span>
            {work.notes ? (
              <p className="text-slate-700 leading-relaxed bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/70 whitespace-pre-line text-xs">
                {work.notes}
              </p>
            ) : (
              <p className="text-slate-400 italic text-xs">Nenhuma observação operacional registrada.</p>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: REGRAS OPERACIONAIS & EQUIPE */}
        <div className="space-y-4">
          
          {/* Card: Critérios e Regras de Medição */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Parâmetros e Regra Operacional
            </span>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/60">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <Scale size={14} className="text-slate-400" />
                  Regra de Medição Contratual:
                </span>
                <span className="font-bold text-slate-800">
                  {work.measurement_type === 'por_subitem'
                    ? 'Por Subitem (Tarefa)'
                    : work.measurement_type === 'por_item'
                    ? 'Por Item (Macro)'
                    : 'Contrato Fechado'}
                </span>
              </div>

              {work.opportunity?.service_type && (
                <div className="flex items-center justify-between p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/60">
                  <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                    <Zap size={14} className="text-amber-500" />
                    Segmento / Escopo:
                  </span>
                  <span className="font-bold text-slate-800">{work.opportunity.service_type}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card: Liderança da Obra */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Liderança da Obra
            </span>

            {/* Responsável Técnico */}
            <div className="flex items-center justify-between p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/60 text-xs">
              <span className="text-slate-500 font-medium">Responsável Técnico (Engenheiro):</span>
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <div className="w-6 h-6 rounded-full overflow-hidden bg-sky-100 text-sky-800 text-[9px] font-bold flex items-center justify-center shrink-0 border border-slate-200">
                  {work.assignee?.avatar_url ? (
                    <img src={work.assignee.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    work.assignee?.full_name?.charAt(0).toUpperCase() || 'T'
                  )}
                </div>
                <span>{work.assignee?.full_name || 'Não atribuído'}</span>
              </div>
            </div>

            {/* Encarregados de Canteiro */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Star size={13} className="text-amber-500 fill-amber-500" />
                  {foremenList.length > 1 ? `Encarregados (${foremenList.length}):` : 'Encarregado:'}
                </span>
                {foremenList.length === 0 && (
                  <span className="text-slate-400 italic">Não definido</span>
                )}
              </div>

              {foremenList.length > 0 && (
                <div className="space-y-1.5">
                  {foremenList.map((foreman) => (
                    <div 
                      key={foreman.id}
                      className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs">
                          {foreman.avatar_url ? (
                            <img src={foreman.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            foreman.full_name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-amber-950 truncate">{foreman.full_name}</p>
                          <p className="text-[10px] text-amber-700 truncate">{foreman.role_title || 'Encarregado'}</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-amber-500 text-white px-2 py-0.5 rounded-md shadow-2xs shrink-0">
                        <Star size={10} className="fill-white" /> Líder de Campo
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Card: Colaboradores Alocados no Canteiro */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={13} className="text-sky-600" />
                <span>Colaboradores Alocados ({assignedWorkers.length})</span>
              </span>
              {canCustomizeSystem && onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline cursor-pointer"
                >
                  Gerenciar Equipe
                </button>
              )}
            </div>

            {assignedWorkers.length === 0 ? (
              <p className="text-slate-400 italic text-xs">Nenhum colaborador alocado nesta obra.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {assignedWorkers.map((w) => (
                  <div
                    key={w.id}
                    className="p-2 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-2.5 text-xs"
                  >
                    <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold flex items-center justify-center shrink-0 border border-slate-200">
                      {w.avatar_url ? (
                        <img src={w.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        getInitials(w.full_name)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{w.full_name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{w.role_title || 'Colaborador'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};