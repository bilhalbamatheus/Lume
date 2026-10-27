import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  Printer,
  Calendar,
  Layers,
  CheckSquare,
  Building2,
  FileText,
  Loader2,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface WorkSchedulePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  workTitle: string;
  workCode?: string | null;
  tasks: Array<{
    id: string;
    title: string;
    task_type?: string | null;
    status: string;
    start_date?: string | null;
    due_date?: string | null;
    quantity_planned: number;
    quantity_executed: number;
    unit: string;
    work_item_id: string;
  }>;
  allItems: Array<{
    id: string;
    title: string;
    code?: string | null;
    location?: string | null;
  }>;
  getHierarchyBreadcrumb: (itemId: string | null | undefined, taskTitle?: string) => string;
}

type PeriodType = 'this_week' | 'next_week' | 'this_month' | 'custom';

export const WorkSchedulePrintModal: React.FC<WorkSchedulePrintModalProps> = ({
  isOpen,
  onClose,
  workTitle,
  workCode,
  tasks,
  allItems,
  getHierarchyBreadcrumb
}) => {
  const { user } = useAuth();
  const [periodType, setPeriodType] = useState<PeriodType>('this_week');
  const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending'>('pending');

  const [company, setCompany] = useState<any>(null);
  const [clientData, setClientData] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadCompanyAndClient = async () => {
      try {
        const companyId = user?.company?.id;
        if (!companyId) return;

        const { data: comp } = await supabase
          .from('companies')
          .select('*')
          .eq('id', companyId)
          .maybeSingle();
        
        if (comp) setCompany(comp);

        if (workCode) {
          const { data: workRes } = await supabase
            .from('works')
            .select('contact:contacts!contact_id(display_name, document, phone, email, type)')
            .eq('code', workCode)
            .maybeSingle();

          if (workRes?.contact) {
            const c = Array.isArray(workRes.contact) ? workRes.contact[0] : workRes.contact;
            setClientData(c);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar dados institucionais para impressão:', err);
      }
    };

    loadCompanyAndClient();
  }, [isOpen, user?.company?.id, workCode]);

  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (periodType === 'this_week') {
      const day = start.getDay();
      const diffToMonday = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diffToMonday);
      end.setDate(start.getDate() + 6);
    } else if (periodType === 'next_week') {
      const day = now.getDay();
      const diffToNextMonday = now.getDate() - day + (day === 0 ? -6 : 1) + 7;
      start.setDate(diffToNextMonday);
      end.setDate(start.getDate() + 6);
    } else if (periodType === 'this_month') {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    } else {
      return {
        startDate: customStart,
        endDate: customEnd,
        label: `${new Date(customStart + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(customEnd + 'T00:00:00').toLocaleDateString('pt-BR')}`
      };
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const labelMap: Record<PeriodType, string> = {
      this_week: `Semana Atual (${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')})`,
      next_week: `Próxima Semana (${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')})`,
      this_month: `Mês Vigente (${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')})`,
      custom: ''
    };

    return { startDate: startStr, endDate: endStr, label: labelMap[periodType] };
  }, [periodType, customStart, customEnd]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (statusFilter === 'pending' && t.status === 'concluida') return false;

      const tStart = t.start_date || t.due_date;
      const tDue = t.due_date || t.start_date;

      if (!tStart && !tDue) {
        return statusFilter === 'all';
      }

      const overlaps = (!tStart || tStart <= dateRange.endDate) && (!tDue || tDue >= dateRange.startDate);
      return overlaps;
    });
  }, [tasks, dateRange, statusFilter]);

  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const progressCount = filteredTasks.filter(t => t.has_progress_tracking).length;
    const checklistCount = total - progressCount;
    return { total, progressCount, checklistCount };
  }, [filteredTasks]);

  const formatDoc = (doc?: string) => {
    if (!doc) return '—';
    const clean = doc.replace(/\D/g, '');
    if (clean.length === 14) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return doc;
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return createPortal(
    <div id="schedule-print-modal-root" className="fixed inset-0 z-[200] flex flex-col bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      {/* CSS DE IMPRESSÃO RIGOROSO: SEM QUEBRA INICIAL EM BRANCO */}
      <style>{`
        @media print {
          html, body {
            background: #ffffff !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Oculta tudo na tela */
          body > *:not(#schedule-print-modal-root) {
            display: none !important;
          }

          #schedule-print-modal-root {
            position: static !important;
            display: block !important;
            overflow: visible !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Oculta elementos de navegação do próprio modal */
          .print-hide {
            display: none !important;
          }

          #printable-schedule-doc {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }

          thead {
            display: table-header-group !important;
          }

          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          @page {
            size: A4 portrait;
            margin: 12mm 10mm;
          }
        }
      `}</style>

      {/* BARRA SUPERIOR DO MODAL */}
      <header className="sticky top-0 z-50 bg-slate-900 text-white border-b border-slate-800 px-6 py-3 flex items-center justify-between shadow-lg print-hide shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30">
            <FileText size={18} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <span>Folha de Programação de Campo</span>
              <span className="font-mono text-xs text-sky-400 font-bold bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                {workCode || 'OBRA'}
              </span>
            </h3>
            <span className="text-[11px] text-slate-400">
              Formato oficial de prancheta e acompanhamento físico no canteiro.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer active:scale-98"
          >
            <Printer size={15} />
            <span>Imprimir / Salvar PDF</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* PAINEL DE CONTROLE DE FILTROS */}
      <div className="bg-slate-800 border-b border-slate-700/80 px-6 py-2.5 shrink-0 print-hide">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">Período:</span>
              <select
                value={periodType}
                onChange={e => setPeriodType(e.target.value as PeriodType)}
                className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-medium cursor-pointer outline-none focus:border-sky-500"
              >
                <option value="this_week">Esta Semana</option>
                <option value="next_week">Próxima Semana</option>
                <option value="this_month">Este Mês</option>
                <option value="custom">Personalizado...</option>
              </select>
            </div>

            {periodType === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs"
                />
                <span className="text-slate-500">até</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">Situação:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-medium cursor-pointer outline-none focus:border-sky-500"
              >
                <option value="pending">Apenas Pendentes / Em Execução</option>
                <option value="all">Todas as Atividades do Período</option>
              </select>
            </div>
          </div>

          <span className="text-slate-400 font-medium text-[11px]">
            {filteredTasks.length} {filteredTasks.length === 1 ? 'atividade selecionada' : 'atividades selecionadas'}
          </span>
        </div>
      </div>

      {/* ÁREA DE VISUALIZAÇÃO / FOLHA A4 */}
      <main className="flex-1 flex justify-center p-4 sm:p-8 print:p-0">
        <div
          id="printable-schedule-doc"
          className="bg-white w-full max-w-4xl p-8 sm:p-12 shadow-2xl border border-slate-200 text-slate-800 font-sans space-y-5 print:shadow-none print:border-none print:p-0 print:max-w-none"
        >
          
          {/* 1. CABEÇALHO IDÊNTICO AO BOLETIM DE MEDIÇÃO */}
          <div className="flex items-start justify-between gap-6 pb-5 border-b border-slate-200 print-avoid-break">
            <div className="space-y-1.5 max-w-md">
              {company?.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={company.trade_name || company.name}
                  className="max-h-16 max-w-[220px] object-contain mb-2"
                />
              ) : (
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {company?.trade_name || company?.name || 'CICLO ELETRICIDADE E ENERGIA'}
                </h2>
              )}
              <div className="text-[11px] text-slate-500 leading-relaxed font-medium">
                <p className="font-bold text-slate-800">{company?.corporate_name || company?.name || 'Ciclo Eletricidade e Energia LTDA'}</p>
                {company?.cnpj && <p>CNPJ: {formatDoc(company.cnpj)}</p>}
                {company?.commercial_phone && <p>Contato: {company.commercial_phone}</p>}
                {company?.commercial_email && <p>E-mail: {company.commercial_email}</p>}
                {company?.city && company?.state && (
                  <p>{company.street ? `${company.street}, ` : ''}{company.city} / {company.state}</p>
                )}
              </div>
            </div>

            <div className="text-right space-y-1 shrink-0">
              <span className="inline-block px-3 py-1 bg-sky-50 text-sky-800 font-black text-[11px] tracking-wider uppercase rounded-full border border-sky-200">
                Programação de Campo
              </span>
              <h3 className="text-2xl font-black text-slate-900 font-mono tracking-tight pt-1">
                {workCode || 'OBRA'}
              </h3>
              <div className="text-[11px] text-slate-500 font-medium pt-1">
                <p>Emissão: <strong>{new Date().toLocaleDateString('pt-BR')}</strong></p>
                <p>Período: <strong>{dateRange.label}</strong></p>
              </div>
            </div>
          </div>

          {/* 2. DADOS DA OBRA E CLIENTE */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200/90 rounded-2xl text-xs print-avoid-break">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Dados da Obra
              </span>
              <strong className="text-slate-900 font-black text-sm block">
                {workTitle}
              </strong>
              <div className="text-[11px] text-slate-600 font-medium space-y-0.5">
                <p>Código da Obra: <strong className="font-mono text-slate-800">{workCode || '—'}</strong></p>
                <p>Status: <span className="font-semibold text-emerald-700">Homologado em Execução</span></p>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Cliente / Contratante
              </span>
              <strong className="text-slate-900 font-black text-sm block">
                {clientData?.display_name || clientData?.name || 'OTIMIZA RENTAVEIS'}
              </strong>
              <div className="text-[11px] text-slate-600 font-medium space-y-0.5">
                <p>Documento: {formatDoc(clientData?.document || clientData?.cpf_cnpj)}</p>
                {clientData?.phone && <p>Telefone: {clientData.phone}</p>}
                {clientData?.email && <p>E-mail: {clientData.email}</p>}
              </div>
            </div>
          </div>

          {/* 3. RESUMO DO PERÍODO */}
          <div className="grid grid-cols-4 gap-3 p-4 bg-sky-50/40 border border-sky-100 rounded-2xl print-avoid-break text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Total Previsto
              </span>
              <strong className="text-slate-900 text-sm font-black block">
                {stats.total} {stats.total === 1 ? 'atividade' : 'atividades'}
              </strong>
              <span className="text-[9px] text-slate-400 font-medium block">Neste Período</span>
            </div>

            <div className="space-y-0.5 border-l border-sky-200/60 pl-3">
              <span className="text-[10px] text-sky-800 font-bold uppercase tracking-wider block">
                Quantitativo
              </span>
              <strong className="text-sky-900 text-sm font-black block">
                {stats.progressCount}
              </strong>
              <span className="text-[9px] text-sky-600 font-bold block">Com medição física</span>
            </div>

            <div className="space-y-0.5 border-l border-sky-200/60 pl-3">
              <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider block">
                Checklists
              </span>
              <strong className="text-slate-900 text-sm font-black block">
                {stats.checklistCount}
              </strong>
              <span className="text-[9px] text-slate-500 font-medium block">Etapas simples</span>
            </div>

            <div className="space-y-0.5 border-l border-sky-200/60 pl-3">
              <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block">
                Prazo Limite
              </span>
              <strong className="text-amber-900 text-sm font-black block">
                {new Date(dateRange.endDate + 'T00:00:00').toLocaleDateString('pt-BR')}
              </strong>
              <span className="text-[9px] text-amber-700 font-medium block">Fechamento do ciclo</span>
            </div>
          </div>

          {/* 4. TABELA DE ATIVIDADES NO PADRÃO LIMPO DO BM */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">Visto</th>
                  <th className="py-2.5 px-3">Subitem / Item / Item Raiz</th>
                  <th className="py-2.5 px-3 w-24 text-center">Tipo</th>
                  <th className="py-2.5 px-3 w-24 text-center">Prazo Limite</th>
                  <th className="py-2.5 px-3 w-28 text-right">Meta Prevista</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 italic">
                      Nenhuma atividade programada para este período.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((t, idx) => {
                    const breadcrumb = getHierarchyBreadcrumb(t.work_item_id, t.title);
                    return (
                      <tr key={t.id || idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-center align-middle">
                          <div className="w-4 h-4 border-2 border-slate-400 rounded-sm mx-auto" />
                        </td>

                        <td className="py-2.5 px-3 font-bold text-slate-900 leading-snug">
                          {breadcrumb || t.title}
                        </td>

                        <td className="py-2.5 px-3 text-center text-[10px]">
                          {t.task_type ? (
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-semibold border border-slate-200">
                              {t.task_type}
                            </span>
                          ) : '—'}
                        </td>

                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                          {t.due_date ? new Date(t.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                        </td>

                        <td className="py-2.5 px-3 text-right font-black text-slate-900">
                          {t.has_progress_tracking ? `${t.quantity_planned} ${t.unit || 'un'}` : 'Checklist'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 5. QUADRO DE ANOTAÇÕES DO CANTEIRO */}
          <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl text-xs space-y-1 print-avoid-break">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Ocorrências do Canteiro de Obras (Clima, Materiais, Interferências)
            </span>
            <div className="h-16 border-b border-dashed border-slate-300" />
          </div>

          {/* 6. ASSINATURAS IDÊNTICAS AO BOLETIM DE MEDIÇÃO */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs print-avoid-break">
            <div className="space-y-1.5">
              <div className="border-b border-slate-400 w-3/4 mx-auto pb-1" />
              <strong className="block text-slate-900 font-bold">
                {company?.corporate_name || company?.name || 'Ciclo Eletricidade e Energia LTDA'}
              </strong>
              <span className="text-[11px] text-slate-500">Responsável Técnico / Contratada</span>
            </div>

            <div className="space-y-1.5">
              <div className="border-b border-slate-400 w-3/4 mx-auto pb-1" />
              <strong className="block text-slate-900 font-bold">
                {clientData?.display_name || clientData?.name || 'OTIMIZA RENTAVEIS'}
              </strong>
              <span className="text-[11px] text-slate-500">Aprovação Técnica / Contratante</span>
            </div>
          </div>

        </div>
      </main>
    </div>,
    document.body
  );
};

export default WorkSchedulePrintModal;