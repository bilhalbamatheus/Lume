import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  Printer,
  FileText,
  Calendar,
  Filter,
  CheckSquare,
  Square,
  Loader2
} from 'lucide-react';
import type { EmployeeItem } from './HRView';

interface PrintEpiTermModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeItem;
  movements: Array<{
    id: string;
    item_id: string;
    quantity: number;
    size?: string | null;
    created_at: string;
    notes?: string | null;
    item?: {
      name: string;
      ca_number?: string | null;
      lifespan_days?: number | null;
      unit?: string;
    } | null;
  }>;
}

interface CompanyData {
  name: string;
  trade_name?: string | null;
  corporate_name?: string | null;
  cnpj?: string | null;
  document?: string | null;
  commercial_email?: string | null;
  commercial_phone?: string | null;
  logo_url?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
}

const formatDocument = (doc: string | null | undefined): string => {
  if (!doc) return '';
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (clean.length === 14) {
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc;
};

const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

export const PrintEpiTermModal: React.FC<PrintEpiTermModalProps> = ({
  isOpen,
  onClose,
  employee,
  movements
}) => {
  const { user } = useAuth();
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [company, setCompany] = useState<CompanyData | null>(null);

  // Filtros de emissão
  const [filterPeriod, setFilterPeriod] = useState<'current_month' | 'last_30_days' | 'active_lifespan' | 'all'>('current_month');
  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>({});

  // Busca dados completos da empresa para o cabeçalho timbrado
  useEffect(() => {
    if (!isOpen) return;

    const loadCompany = async () => {
      try {
        setLoadingCompany(true);
        const companyId = user?.company?.id || (user as any)?.company_id || user?.profile?.company_id;

        if (companyId) {
          const { data } = await supabase
            .from('companies')
            .select('*')
            .eq('id', companyId)
            .maybeSingle();

          if (data) setCompany(data);
        }
      } catch (err) {
        console.warn('Erro ao carregar dados da empresa:', err);
      } finally {
        setLoadingCompany(false);
      }
    };

    loadCompany();
  }, [isOpen, user]);

  // Filtro de movimentos baseado na periodicidade
  const filteredMovements = useMemo(() => {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return movements.filter(m => {
      const mDate = new Date(m.created_at);

      if (filterPeriod === 'current_month') {
        const mMonthStr = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}`;
        return mMonthStr === currentMonthStr;
      }

      if (filterPeriod === 'last_30_days') {
        return mDate >= thirtyDaysAgo;
      }

      if (filterPeriod === 'active_lifespan') {
        const lifespanDays = m.item?.lifespan_days || 180; // padrão de 180 dias se não definido
        const expiryDate = new Date(mDate);
        expiryDate.setDate(expiryDate.getDate() + lifespanDays);
        return expiryDate >= now;
      }

      return true; // 'all'
    });
  }, [movements, filterPeriod]);

  // Reseta seleção manual ao trocar de filtro
  useEffect(() => {
    const initSelected: Record<string, boolean> = {};
    filteredMovements.forEach(m => {
      initSelected[m.id] = true;
    });
    setSelectedItemIds(initSelected);
  }, [filteredMovements]);

  // Itens finais que irão para a folha timbrada
  const printableMovements = useMemo(() => {
    return filteredMovements.filter(m => selectedItemIds[m.id]);
  }, [filteredMovements, selectedItemIds]);

  const toggleItemSelection = (id: string) => {
    setSelectedItemIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllItems = () => {
    const allSelected = filteredMovements.every(m => selectedItemIds[m.id]);
    const updated: Record<string, boolean> = {};
    filteredMovements.forEach(m => {
      updated[m.id] = !allSelected;
    });
    setSelectedItemIds(updated);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const todayStr = new Date().toLocaleDateString('pt-BR');

  return createPortal(
    <div id="epi-print-modal-root" className="fixed inset-0 z-[220] flex flex-col bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-epi-term, #printable-epi-term * {
            visibility: visible !important;
          }
          #printable-epi-term {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 12mm 15mm !important;
            box-shadow: none !important;
            border: none !important;
          }
          .break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>

      {/* Barra de Ações Superior Limpa */}
      <header className="sticky top-0 z-50 bg-slate-900 text-white border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between shadow-lg print:hidden shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30 shrink-0">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2 truncate">
              <span>Ficha de Cautela & Entrega de EPI</span>
              <span className="font-mono text-xs text-sky-400 font-bold bg-sky-950 px-2 py-0.5 rounded border border-sky-800 shrink-0">
                NR-06
              </span>
            </h3>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Emissão formal para arquivamento e coleta de assinatura do colaborador.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Seletor de Período do Termo */}
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-xl text-xs text-slate-200">
            <Filter size={13} className="text-slate-400" />
            <select
              value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value as any)}
              className="bg-transparent focus:outline-none cursor-pointer text-xs font-semibold"
            >
              <option value="current_month" className="bg-slate-900 text-white">Mês Atual ({new Date().toLocaleDateString('pt-BR', { month: 'short' })})</option>
              <option value="last_30_days" className="bg-slate-900 text-white">Últimos 30 Dias</option>
              <option value="active_lifespan" className="bg-slate-900 text-white">Itens em Vigência (Dentro da Validade)</option>
              <option value="all" className="bg-slate-900 text-white">Todo o Histórico</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            disabled={printableMovements.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer active:scale-98 disabled:opacity-50"
          >
            <Printer size={15} />
            <span>Imprimir ({printableMovements.length})</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer ml-1"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Conteúdo Centralizado no Formato A4 */}
      <main className="flex-1 flex justify-center p-4 sm:p-8 print:p-0">
        {loadingCompany ? (
          <div className="py-32 text-center text-slate-400 text-xs">
            <Loader2 size={24} className="animate-spin mx-auto mb-2 text-sky-500" />
            Carregando layout timbrado...
          </div>
        ) : (
          <div
            id="printable-epi-term"
            className="bg-white w-full max-w-4xl min-h-[297mm] p-8 sm:p-12 rounded-3xl shadow-2xl border border-slate-200 flex flex-col justify-between text-slate-800 font-sans space-y-6"
          >
            <div className="space-y-6">
              
              {/* 1. CABEÇALHO PADRÃO CICLO */}
              <div className="flex items-start justify-between gap-6 pb-6 border-b border-slate-200">
                <div className="space-y-2 max-w-md">
                  {company?.logo_url ? (
                    <img
                      src={company.logo_url}
                      alt={company.trade_name || company.name}
                      className="max-h-16 max-w-[220px] object-contain mb-2.5"
                    />
                  ) : (
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">
                      {company?.trade_name || company?.name || 'CICLO ELETRICIDADE E ENERGIA'}
                    </h2>
                  )}

                  <div className="text-[11px] text-slate-500 leading-relaxed font-medium space-y-0.5">
                    <p className="font-bold text-slate-800 text-xs">
                      {company?.corporate_name || company?.name || 'Ciclo Eletricidade e Energia LTDA'}
                    </p>
                    {company?.cnpj && (
                      <p>CNPJ: {formatDocument(company.cnpj)}</p>
                    )}
                    {company?.commercial_phone && (
                      <p>Contato: {formatPhone(company.commercial_phone)}</p>
                    )}
                    {company?.commercial_email && (
                      <p>E-mail: {company.commercial_email}</p>
                    )}
                    {company?.city && company?.state && (
                      <p>
                        {company.street ? `${company.street}, ${company.number || 'S/N'}` : ''}
                        {company.neighborhood ? ` - ${company.neighborhood}` : ''}
                        {` • ${company.city}/${company.state}`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right space-y-1.5 shrink-0">
                  <span className="inline-block px-3 py-1 bg-sky-50 text-sky-700 font-extrabold text-[11px] tracking-wider uppercase rounded-full border border-sky-200">
                    FICHA DE CAUTELA (NR-06)
                  </span>

                  <h3 className="text-2xl font-black text-slate-900 tracking-tight pt-1">
                    TERMO DE ENTREGA
                  </h3>

                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-1.5">
                    <p>
                      Emissão: <strong>{todayStr}</strong>
                    </p>
                    <p>
                      Referência: <strong>
                        {filterPeriod === 'current_month'
                          ? `Mês Atual (${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })})`
                          : filterPeriod === 'last_30_days'
                          ? 'Últimos 30 Dias'
                          : filterPeriod === 'active_lifespan'
                          ? 'Equipamentos em Vigência'
                          : 'Histórico Consolidado'}
                      </strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. BLOCO DO COLABORADOR */}
              <div className="bg-slate-50/70 rounded-2xl border border-slate-200/90 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 break-inside-avoid">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Colaborador / Recebedor
                  </span>
                  <p className="font-extrabold text-sm text-slate-900">
                    {employee.full_name}
                  </p>
                  {employee.cpf && (
                    <p className="text-xs text-slate-500 font-mono">
                      CPF: {formatDocument(employee.cpf)}
                    </p>
                  )}
                  {employee.role_title && (
                    <p className="text-xs text-slate-500">
                      Função: <strong>{employee.role_title}</strong>
                    </p>
                  )}
                </div>

                <div className="sm:border-l sm:border-slate-200 sm:pl-5 space-y-1 text-xs text-slate-600 flex flex-col justify-center">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Dados Operacionais
                  </span>
                  <p>
                    Admissão: <strong>{employee.admission_date ? new Date(employee.admission_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</strong>
                  </p>
                  <p>
                    Situação Atual: <strong className="capitalize">{employee.work_status}</strong>
                  </p>
                  {employee.boot_size && (
                    <p className="text-[11px] text-slate-400 pt-0.5">
                      Grade Pessoal: Botina {employee.boot_size} • Camisa {employee.uniform_shirt_size || '—'}
                    </p>
                  )}
                </div>
              </div>

              {/* 3. TABELA DE EQUIPAMENTOS */}
              <div className="space-y-2 break-inside-avoid">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                    Equipamentos Entregues & Termo de Responsabilidade
                  </span>

                  <button
                    type="button"
                    onClick={toggleAllItems}
                    className="text-[11px] text-sky-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer no-print"
                  >
                    {filteredMovements.every(m => selectedItemIds[m.id]) ? (
                      <>
                        <CheckSquare size={13} />
                        <span>Desmarcar Todos</span>
                      </>
                    ) : (
                      <>
                        <Square size={13} />
                        <span>Selecionar Todos</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3 w-8 text-center text-slate-400 no-print">Sel.</th>
                        <th className="py-2.5 px-3 w-8 text-center text-slate-400">#</th>
                        <th className="py-2.5 px-3">Descrição do Equipamento (EPI)</th>
                        <th className="py-2.5 px-2 w-24 text-center">Nº do CA</th>
                        <th className="py-2.5 px-2 w-16 text-center">Tam.</th>
                        <th className="py-2.5 px-2 w-16 text-center">Qtd.</th>
                        <th className="py-2.5 px-3 w-24 text-center">Data Entrega</th>
                        <th className="py-2.5 px-4 w-36 text-center">Visto do Colaborador</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMovements.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                            Nenhum equipamento entregue no período selecionado.
                          </td>
                        </tr>
                      ) : (
                        filteredMovements.map((mov, idx) => {
                          const isChecked = Boolean(selectedItemIds[mov.id]);

                          return (
                            <tr
                              key={mov.id}
                              className={`transition ${isChecked ? 'hover:bg-slate-50/50' : 'opacity-40 bg-slate-50/30'}`}
                            >
                              <td className="py-2.5 px-3 text-center no-print">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleItemSelection(mov.id)}
                                  className="accent-sky-600 rounded cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {mov.item?.name || 'Equipamento'}
                                {mov.notes && (
                                  <span className="block text-[10px] text-slate-400 font-normal">
                                    {mov.notes}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-800">
                                {mov.item?.ca_number ? `CA ${mov.item.ca_number}` : '—'}
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono text-slate-700">
                                {mov.size ? `Tam. ${mov.size}` : 'Único'}
                              </td>
                              <td className="py-2.5 px-2 text-center font-bold text-slate-900">
                                {mov.quantity} {mov.item?.unit || 'un'}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-600 whitespace-nowrap">
                                {new Date(mov.created_at).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <div className="h-6 border-b border-dashed border-slate-300 w-full" />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. DECLARAÇÃO JURÍDICA NR-06 */}
              <div className="w-full p-4.5 bg-slate-50/70 rounded-2xl border border-slate-200/90 text-xs space-y-1.5 break-inside-avoid">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                  Declaração de Recebimento e Termo de Compromisso (NR-06)
                </span>
                <p className="text-slate-700 leading-relaxed text-[11px] text-justify font-medium">
                  Declaro ter recebido da empresa <strong>{company?.corporate_name || company?.name || 'EMPRESA'}</strong>, gratuitamente, os Equipamentos de Proteção Individual (EPIs) relacionados neste termo, novos e em perfeitas condições de uso, contendo os devidos Certificados de Aprovação (CA) válidos expedidos pelo Ministério do Trabalho e Emprego. Comprometo-me a utilizá-los estritamente durante a execução de minhas atividades profissionais, a zelar pela sua guarda e higienização, e a comunicar imediatamente qualquer avaria, extravio ou desgaste que os torne impróprios para uso, estando ciente de que a recusa injustificada ao seu uso constitui ato faltoso passível das sanções disciplinares previstas no Art. 482 da CLT e nas normas regulamentadoras de segurança vigentes.
                </p>
              </div>

            </div>

            {/* 5. ASSINATURAS FORMAIS */}
            <div className="pt-14 border-t border-slate-200 grid grid-cols-2 gap-12 text-center text-xs break-inside-avoid">
              <div className="space-y-1">
                <div className="border-t border-slate-400 pt-2 mx-auto max-w-xs">
                  <p className="font-extrabold text-slate-900 truncate">
                    {employee.full_name}
                  </p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Assinatura do Colaborador</p>
                  <p className="text-[9px] text-slate-400 font-mono">CPF: {formatDocument(employee.cpf)}</p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="border-t border-slate-400 pt-2 mx-auto max-w-xs">
                  <p className="font-extrabold text-slate-900 truncate">
                    {company?.trade_name || company?.corporate_name || 'CICLO ELETRICIDADE E ENERGIA'}
                  </p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Responsável pela Entrega / SST</p>
                  <p className="text-[9px] text-slate-400 font-mono">Almoxarifado Central</p>
                </div>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>,
    document.body
  );
};

export default PrintEpiTermModal;