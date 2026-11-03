import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  X,
  Printer,
  Boxes,
  ShieldCheck,
  Wrench,
  Package,
  Shirt,
  Layers,
  Loader2
} from 'lucide-react';
import type { InventoryItem } from './InventoryView';

interface PrintInventoryStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  initialTypeFilter?: string;
}

interface CompanyData {
  name: string;
  trade_name?: string | null;
  corporate_name?: string | null;
  cnpj?: string | null;
  commercial_email?: string | null;
  commercial_phone?: string | null;
  logo_url?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}

const formatCurrency = (val: number | null | undefined): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

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

export const PrintInventoryStockModal: React.FC<PrintInventoryStockModalProps> = ({
  isOpen,
  onClose,
  items,
  initialTypeFilter = 'all'
}) => {
  const { user } = useAuth();
  const { permissions } = usePermissions();

  const canSeePrices = Boolean(
    permissions?.isOwnerOrAdmin ||
    permissions?.canManageWorkFinancial ||
    permissions?.canViewWorkPrices ||
    permissions?.canManageSalariesBenefits
  );

  const [loadingCompany, setLoadingCompany] = useState(false);
  const [company, setCompany] = useState<CompanyData | null>(null);

  // Filtro de Categoria do Estoque
  const [selectedType, setSelectedType] = useState<string>(initialTypeFilter);
  const [showValues, setShowValues] = useState<boolean>(canSeePrices);

  useEffect(() => {
    if (isOpen) {
      setSelectedType(initialTypeFilter);
    }
  }, [isOpen, initialTypeFilter]);

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

  // Transforma itens com grade em linhas individuais alinhadas
  const flattenedItems = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      item_type: string;
      identifier: string;
      stock: number;
      unit: string;
      unitCost: number;
    }> = [];

    items.forEach(it => {
      if (selectedType !== 'all' && it.item_type !== selectedType) return;

      const sizesMap = it.requires_size && it.sizes_stock && typeof it.sizes_stock === 'object'
        ? it.sizes_stock
        : null;

      if (sizesMap && Object.keys(sizesMap).length > 0) {
        Object.entries(sizesMap).forEach(([sz, qty]) => {
          list.push({
            id: `${it.id}-${sz}`,
            name: `${it.name} (Tam. ${sz})`,
            item_type: it.item_type,
            identifier: it.ca_number ? `CA ${it.ca_number}` : it.brand || '—',
            stock: Number(qty) || 0,
            unit: it.unit || 'un',
            unitCost: Number(it.unit_cost) || 0
          });
        });
      } else {
        list.push({
          id: it.id,
          name: it.name,
          item_type: it.item_type,
          identifier: it.ca_number ? `CA ${it.ca_number}` : it.brand || '—',
          stock: Number(it.current_stock) || 0,
          unit: it.unit || 'un',
          unitCost: Number(it.unit_cost) || 0
        });
      }
    });

    return list;
  }, [items, selectedType]);

  const totals = useMemo(() => {
    let totalStockQty = 0;
    let totalImmobilizedValue = 0;

    flattenedItems.forEach(it => {
      totalStockQty += it.stock;
      totalImmobilizedValue += it.stock * it.unitCost;
    });

    return { totalStockQty, totalImmobilizedValue };
  }, [flattenedItems]);

  const filterLabel = useMemo(() => {
    switch (selectedType) {
      case 'epi': return 'Apenas EPIs (NR-06)';
      case 'ferramenta': return 'Apenas Ferramentas';
      case 'material': return 'Apenas Materiais de Obra';
      case 'uniforme': return 'Apenas Fardamentos';
      case 'consumivel': return 'Apenas Consumíveis';
      default: return 'Catálogo Completo';
    }
  }, [selectedType]);

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const todayStr = new Date().toLocaleDateString('pt-BR');

  return createPortal(
    <div id="inventory-print-modal-root" className="fixed inset-0 z-[220] flex flex-col bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-inventory-stock, #printable-inventory-stock * {
            visibility: visible !important;
          }
          #printable-inventory-stock {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm 15mm !important;
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

      {/* Barra de Ações e Filtros Superior */}
      <header className="sticky top-0 z-50 bg-slate-900 text-white border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg print:hidden shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30 shrink-0">
            <Boxes size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2 truncate">
              <span>Folha de Conferência de Estoque</span>
              <span className="font-mono text-xs text-sky-400 font-bold bg-sky-950 px-2 py-0.5 rounded border border-sky-800 shrink-0">
                Almoxarifado
              </span>
            </h3>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Filtre por tipo de item para focar a auditoria física.
            </span>
          </div>
        </div>

        {/* Seletores de Tipo com Estilo Chips */}
        <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-semibold gap-1">
          <button
            type="button"
            onClick={() => setSelectedType('all')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
              selectedType === 'all'
                ? 'bg-sky-600 text-white shadow-2xs font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('epi')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
              selectedType === 'epi'
                ? 'bg-sky-600 text-white shadow-2xs font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck size={12} />
            <span>EPIs</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('ferramenta')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
              selectedType === 'ferramenta'
                ? 'bg-sky-600 text-white shadow-2xs font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wrench size={12} />
            <span>Ferramentas</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('material')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
              selectedType === 'material'
                ? 'bg-sky-600 text-white shadow-2xs font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Package size={12} />
            <span>Materiais</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('uniforme')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
              selectedType === 'uniforme'
                ? 'bg-sky-600 text-white shadow-2xs font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shirt size={12} />
            <span>Uniformes</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {canSeePrices && (
            <label className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-xl text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showValues}
                onChange={e => setShowValues(e.target.checked)}
                className="accent-sky-500 rounded"
              />
              <span>Valores</span>
            </label>
          )}

          <button
            type="button"
            onClick={handlePrint}
            disabled={flattenedItems.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer active:scale-98 disabled:opacity-50"
          >
            <Printer size={15} />
            <span>Imprimir ({flattenedItems.length})</span>
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

      {/* Visualização da Folha A4 Centralizada */}
      <main className="flex-1 flex justify-center p-4 sm:p-8 print:p-0">
        {loadingCompany ? (
          <div className="py-32 text-center text-slate-400 text-xs">
            <Loader2 size={24} className="animate-spin mx-auto mb-2 text-sky-500" />
            Carregando layout timbrado...
          </div>
        ) : (
          <div
            id="printable-inventory-stock"
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
                    CONFERÊNCIA DE ESTOQUE
                  </span>

                  <h3 className="text-2xl font-black text-slate-900 tracking-tight pt-1">
                    {selectedType === 'epi' ? 'CONTROLE DE EPIS' : 'AUDITORIA FÍSICA'}
                  </h3>

                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-1.5">
                    <p>
                      Data da Emissão: <strong>{todayStr}</strong>
                    </p>
                    <p>
                      Filtro Aplicado: <strong className="text-slate-900">{filterLabel}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. CARDS RESUMO DO ESTOQUE */}
              <div className="bg-slate-50/70 rounded-2xl border border-slate-200/90 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 break-inside-avoid text-xs">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Itens na Lista</span>
                  <strong className="text-sm font-bold text-slate-900 block mt-0.5">{flattenedItems.length} registros</strong>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Saldo do Sistema</span>
                  <strong className="text-sm font-bold text-slate-900 block mt-0.5">{totals.totalStockQty} unidades</strong>
                </div>

                {showValues ? (
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Custo Total Imobilizado</span>
                    <strong className="text-sm font-bold text-emerald-700 block mt-0.5">{formatCurrency(totals.totalImmobilizedValue)}</strong>
                  </div>
                ) : (
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Valores de Custo</span>
                    <strong className="text-sm font-bold text-slate-500 block mt-0.5">Ocultos para conferência</strong>
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Responsável Auditoria</span>
                  <strong className="text-sm font-bold text-slate-900 block truncate mt-0.5">
                    {user?.profile?.full_name || 'Encarregado'}
                  </strong>
                </div>
              </div>

              {/* 3. TABELA PADRÃO DE CONFERÊNCIA */}
              <div className="space-y-2 break-inside-avoid">
                <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  Itens Cadastrados para Contagem Física
                </span>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3 w-8 text-center text-slate-400">#</th>
                        <th className="py-2.5 px-3">Descrição do Item / Equipamento</th>
                        <th className="py-2.5 px-2 w-20 text-center">Tipo</th>
                        <th className="py-2.5 px-2 w-24 text-center">CA / Ident.</th>
                        <th className="py-2.5 px-2 w-20 text-center">Saldo Sistema</th>
                        {showValues && <th className="py-2.5 px-2 w-24 text-right">Custo Unit.</th>}
                        <th className="py-2.5 px-3 w-28 text-center bg-slate-200/50">Contagem Física</th>
                        <th className="py-2.5 px-3 w-20 text-center">Batimento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {flattenedItems.length === 0 ? (
                        <tr>
                          <td colSpan={showValues ? 8 : 7} className="py-8 text-center text-slate-400 italic">
                            Nenhum item encontrado no estoque para o filtro de "{filterLabel}".
                          </td>
                        </tr>
                      ) : (
                        flattenedItems.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {item.name}
                            </td>
                            <td className="py-2.5 px-2 text-center text-[10px] font-bold uppercase text-slate-600">
                              {item.item_type}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-[11px] text-slate-700">
                              {item.identifier}
                            </td>
                            <td className="py-2.5 px-2 text-center font-bold text-slate-900 font-mono">
                              {item.stock} {item.unit}
                            </td>
                            {showValues && (
                              <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                                {formatCurrency(item.unitCost)}
                              </td>
                            )}
                            <td className="py-2.5 px-3 text-center bg-slate-50/50 border-l border-r border-slate-200">
                              <div className="h-6 border-b border-dashed border-slate-300 w-full" />
                            </td>
                            <td className="py-2.5 px-3 text-center text-[10px] text-slate-400">
                              [ &nbsp; ] OK
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. TERMO DE RESPONSABILIDADE & CONFERÊNCIA */}
              <div className="w-full p-4 bg-slate-50/70 rounded-2xl border border-slate-200/90 text-xs space-y-1 break-inside-avoid">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                  Declaração de Conferência e Apuração de Inventário Físico
                </span>
                <p className="text-slate-600 leading-relaxed text-[11px] text-justify font-medium">
                  Certificamos que na data de <strong>{todayStr}</strong> foi realizada a conferência física e checagem de integridade dos itens acima discriminados, pertencentes ao Almoxarifado da <strong>{company?.corporate_name || company?.name || 'Ciclo Eletricidade'}</strong>. As divergências ou itens avariados apurados deverão ser encaminhados para baixa ou reposição imediata.
                </p>
              </div>

            </div>

            {/* 5. ASSINATURAS FORMAIS */}
            <div className="pt-12 border-t border-slate-200 grid grid-cols-2 gap-12 text-center text-xs break-inside-avoid">
              <div className="space-y-1">
                <div className="border-t border-slate-400 pt-2 mx-auto max-w-xs">
                  <p className="font-extrabold text-slate-900 truncate">
                    {user?.profile?.full_name || 'Conferente'}
                  </p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Responsável pela Contagem Física</p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="border-t border-slate-400 pt-2 mx-auto max-w-xs">
                  <p className="font-extrabold text-slate-900 truncate">
                    {company?.trade_name || company?.corporate_name || 'CICLO ELETRICIDADE E ENERGIA'}
                  </p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Gestão de Almoxarifado & SST</p>
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

export default PrintInventoryStockModal;