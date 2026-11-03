import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  X,
  Package,
  ShieldCheck,
  Wrench,
  Shirt,
  Layers,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  Trash2,
  HardHat,
  User,
  Loader2,
  DollarSign,
  ArrowLeft,
  MoreVertical,
  Edit3,
  FileText,
  History as HistoryIcon
} from 'lucide-react';
import type { InventoryItem } from './InventoryView';

interface InventoryItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onEditItem?: (item: InventoryItem) => void;
  onQuickMovement?: (item: InventoryItem) => void;
}

interface ItemMovement {
  id: string;
  movement_type: string;
  quantity: number;
  size?: string | null;
  previous_stock: number;
  new_stock: number;
  unit_cost?: number | null;
  document_number?: string | null;
  notes?: string | null;
  created_at: string;
  work?: { title: string; code?: string | null } | null;
  recipient?: { full_name: string } | null;
}

const formatCurrency = (val: number) => {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const InventoryItemDetailModal: React.FC<InventoryItemDetailModalProps> = ({
  isOpen,
  onClose,
  item,
  onEditItem,
  onQuickMovement
}) => {
  const { user } = useAuth();
  const { permissions } = usePermissions();

  const canSeePrices = Boolean(
    permissions?.isOwnerOrAdmin ||
    permissions?.canManageWorkFinancial ||
    permissions?.canViewWorkPrices ||
    permissions?.canManageSalariesBenefits
  );

  const [loadingMovements, setLoadingMovements] = useState(false);
  const [movements, setMovements] = useState<ItemMovement[]>([]);

  // Responsividade
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [targetMainEl, setTargetMainEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const main = document.querySelector('main');
    if (main && !isMobile) {
      main.style.position = 'relative';
      setTargetMainEl(main);
    }
    return () => {
      if (main) main.style.position = '';
    };
  }, [isMobile]);

  // Abas ('dados' | 'historico')
  const [activeTab, setActiveTab] = useState<'dados' | 'historico'>('dados');

  // Menu de opções (...) Mobile
  const [isMobileTopMenuOpen, setIsMobileTopMenuOpen] = useState(false);

  const loadItemMovements = useCallback(async () => {
    if (!item?.id || !user?.company?.id) return;

    try {
      setLoadingMovements(true);
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`
          id,
          movement_type,
          quantity,
          size,
          previous_stock,
          new_stock,
          unit_cost,
          document_number,
          notes,
          created_at,
          work:works!work_id (title, code),
          recipient:profiles!recipient_profile_id (full_name)
        `)
        .eq('item_id', item.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted: ItemMovement[] = (data || []).map((m: any) => ({
        ...m,
        work: Array.isArray(m.work) ? m.work[0] : m.work,
        recipient: Array.isArray(m.recipient) ? m.recipient[0] : m.recipient
      }));

      setMovements(formatted);
    } catch (err) {
      console.warn('Erro ao carregar movimentações do item:', err);
    } finally {
      setLoadingMovements(false);
    }
  }, [item?.id, user?.company?.id]);

  useEffect(() => {
    if (isOpen && item?.id) {
      setActiveTab('dados');
      setIsMobileTopMenuOpen(false);
      loadItemMovements();
    }
  }, [isOpen, item?.id, loadItemMovements]);

  if (!isOpen || !item) return null;

  const currentStockNum = Number(item.current_stock) || 0;
  const unitCostNum = Number(item.unit_cost) || 0;
  const totalValue = currentStockNum * unitCostNum;
  const minStockNum = Number(item.min_stock) || 0;
  const isLowStock = currentStockNum <= minStockNum && minStockNum > 0;

  const sizesMap = (item as any).sizes_stock && typeof (item as any).sizes_stock === 'object'
    ? (item as any).sizes_stock
    : {};
  const hasSizes = (item as any).requires_size && Object.keys(sizesMap).length > 0;

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'saida_obra':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md">
            <ArrowUpRight size={11} />
            <span>Saída p/ Obra</span>
          </span>
        );
      case 'saida_epi':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded-md">
            <ShieldCheck size={11} />
            <span>Cautela de EPI</span>
          </span>
        );
      case 'entrada_compra':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
            <ArrowDownLeft size={11} />
            <span>Compra / Entrada</span>
          </span>
        );
      case 'devolucao':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-md">
            <RotateCcw size={11} />
            <span>Devolução</span>
          </span>
        );
      case 'descarte':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-md">
            <Trash2 size={11} />
            <span>Descarte</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md">
            <span>{type}</span>
          </span>
        );
    }
  };

  const content = (
    <div className={`bg-slate-100 flex flex-col z-40 overflow-hidden animate-in fade-in duration-150 ${
      isMobile ? 'fixed inset-0 z-[150] w-screen h-screen' : 'absolute inset-0'
    }`}>

      {/* 1. TOPBAR NO MOBILE (< lg) */}
      <div className="flex lg:hidden items-center justify-between px-3.5 py-2.5 bg-white border-b border-slate-200/90 shrink-0 z-30 shadow-2xs">
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-900 transition cursor-pointer shadow-2xs"
          title="Voltar"
        >
          <ArrowLeft size={16} />
        </button>

        <span className="text-xs font-bold text-slate-800 tracking-tight uppercase">
          Detalhes do Item
        </span>

        <button
          type="button"
          onClick={() => setIsMobileTopMenuOpen(true)}
          className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-900 transition cursor-pointer shadow-2xs"
          title="Opções"
        >
          <MoreVertical size={16} />
        </button>
      </div>

      {/* 2. BLOCO DE IDENTIFICAÇÃO DO ITEM NO MOBILE (< lg) */}
      <div className="lg:hidden bg-white px-4 py-3 border-b border-slate-200/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
            {item.item_type === 'epi' ? (
              <ShieldCheck size={20} />
            ) : item.item_type === 'ferramenta' ? (
              <Wrench size={20} />
            ) : item.item_type === 'uniforme' ? (
              <Shirt size={20} />
            ) : (
              <Package size={20} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm font-black text-slate-900 leading-tight truncate">
                {item.name}
              </h2>
              <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                {item.item_type}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 block truncate mt-0.5">
              {item.code ? `Cód: ${item.code} • ` : ''}Categoria: {item.category}
            </span>
          </div>
        </div>
      </div>

      {/* 3. BARRA DE NAVEGAÇÃO DE ABAS NO MOBILE (< lg) */}
      <div className="flex lg:hidden bg-white border-b border-slate-200/90 px-3 shrink-0 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('dados')}
          className={`flex-1 py-3 border-b-2 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'dados' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500'
          }`}
        >
          <FileText size={14} />
          <span>Dados & Saldo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('historico')}
          className={`flex-1 py-3 border-b-2 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'historico' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500'
          }`}
        >
          <HistoryIcon size={14} />
          <span>Histórico ({movements.length})</span>
        </button>
      </div>

      {/* 4. CABEÇALHO DESKTOP EM LARGURA TOTAL (lg: em diante) */}
      <header className="hidden lg:block bg-white border-b border-slate-200/90 px-6 py-4 shrink-0 shadow-2xs z-30">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer border border-slate-200 shrink-0"
              title="Voltar ao almoxarifado"
            >
              <ArrowLeft size={16} />
            </button>

            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
              {item.item_type === 'epi' ? (
                <ShieldCheck size={20} />
              ) : item.item_type === 'ferramenta' ? (
                <Wrench size={20} />
              ) : item.item_type === 'uniforme' ? (
                <Shirt size={20} />
              ) : (
                <Package size={20} />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-black text-slate-900 leading-tight truncate">
                  {item.name}
                </h1>
                {item.code && (
                  <span className="font-mono text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-lg shrink-0">
                    Cód: {item.code}
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                  {item.item_type}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                Categoria: <strong className="text-slate-600 font-semibold">{item.category}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onEditItem && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditItem(item);
                }}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Editar Item
              </button>
            )}
            {onQuickMovement && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onQuickMovement(item);
                }}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer active:scale-98"
              >
                Movimentar Estoque
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="Fechar detalhes"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* 5. BARRA DE NAVEGAÇÃO DE ABAS NO DESKTOP (lg) */}
      <div className="hidden lg:flex bg-white border-b border-slate-200/90 px-6 shrink-0 shadow-2xs">
        <div className="flex items-center gap-6 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('dados')}
            className={`py-3.5 border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'dados' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText size={15} />
            <span>Dados & Saldo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('historico')}
            className={`py-3.5 border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'historico' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HistoryIcon size={15} />
            <span>Histórico de Movimentações ({movements.length})</span>
          </button>
        </div>
      </div>

      {/* 6. CORPO COM O CONTEÚDO DAS ABAS EM LARGURA TOTAL */}
      <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pb-24 lg:pb-6 bg-slate-50/70">
        
        {/* ABA: DADOS & SALDO */}
        {activeTab === 'dados' && (
          <div className="max-w-5xl mx-auto space-y-4">
            
            {/* CARDS DE RESUMO DO ITEM */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Saldo em Estoque
                </span>
                <div className="flex items-baseline gap-1.5">
                  <strong className={`text-xl font-black font-mono ${isLowStock ? 'text-amber-700' : 'text-slate-900'}`}>
                    {currentStockNum}
                  </strong>
                  <span className="text-xs text-slate-500 font-bold">{item.unit}</span>
                </div>
                {isLowStock && (
                  <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                    <AlertTriangle size={11} />
                    Abaixo do mín. ({minStockNum})
                  </span>
                )}
              </div>

              <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Custo Unitário Médio
                </span>
                <strong className="text-xl font-black font-mono text-slate-900 block truncate">
                  {canSeePrices ? formatCurrency(unitCostNum) : 'R$ •••••'}
                </strong>
                <span className="text-[10px] text-slate-400">Ponderado móvel</span>
              </div>

              <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block flex items-center gap-1">
                  <DollarSign size={11} className="text-emerald-600" />
                  Valor Total
                </span>
                <strong className="text-xl font-black font-mono text-emerald-900 block truncate">
                  {canSeePrices ? formatCurrency(totalValue) : 'R$ •••••'}
                </strong>
                <span className="text-[10px] text-emerald-600">Total imobilizado</span>
              </div>

              <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Estoque Mínimo
                </span>
                <div className="flex items-baseline gap-1.5">
                  <strong className="text-xl font-black font-mono text-slate-900">
                    {minStockNum}
                  </strong>
                  <span className="text-xs text-slate-500 font-bold">{item.unit}</span>
                </div>
                <span className="text-[10px] text-slate-400">Ponto de reposição</span>
              </div>
            </div>

            {/* GRADE DE TAMANHOS */}
            {hasSizes && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-sky-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Disponibilidade por Grade
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    Total: <strong className="text-slate-900">{currentStockNum} {item.unit}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {Object.entries(sizesMap).map(([sz, qty]) => {
                    const qtyVal = Number(qty) || 0;
                    const isZero = qtyVal === 0;

                    return (
                      <div
                        key={sz}
                        className={`p-2.5 rounded-xl border text-center transition ${
                          isZero
                            ? 'bg-slate-100/60 border-slate-200 opacity-60'
                            : 'bg-white border-slate-200 shadow-2xs'
                        }`}
                      >
                        <span className="block text-[11px] font-bold text-slate-500 uppercase">
                          Tam. {sz}
                        </span>
                        <strong className={`block text-sm font-black font-mono mt-0.5 ${isZero ? 'text-slate-400' : 'text-slate-900'}`}>
                          {qtyVal}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DADOS ESPECÍFICOS: EPI ou FERRAMENTA */}
            {item.item_type === 'epi' && (
              <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-sky-900 uppercase tracking-wider block flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-sky-600" />
                  <span>Conformidade Regulamentar (NR-06)</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Nº do CA</span>
                    <strong className="text-xs font-mono font-bold text-slate-900">
                      {item.ca_number ? `CA ${item.ca_number}` : 'Não informado'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Validade do CA</span>
                    <strong className="text-xs font-medium text-slate-900">
                      {item.ca_expiry_date
                        ? new Date(item.ca_expiry_date + 'T00:00:00').toLocaleDateString('pt-BR')
                        : 'Não informada'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Ciclo de Troca</span>
                    <strong className="text-xs font-medium text-slate-900">
                      {item.lifespan_days ? `${item.lifespan_days} dias estimados` : 'Não definido'}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {item.item_type === 'ferramenta' && (
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block flex items-center gap-1.5">
                  <Wrench size={14} className="text-amber-600" />
                  <span>Identificação Patrimonial</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Marca / Fabricante</span>
                    <strong className="text-xs font-semibold text-slate-900">
                      {item.brand || 'Não informado'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Nº de Série / Plaqueta</span>
                    <strong className="text-xs font-mono font-bold text-slate-900">
                      {item.serial_number || 'Não informado'}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA: HISTÓRICO DE MOVIMENTAÇÕES */}
        {activeTab === 'historico' && (
          <div className="max-w-5xl mx-auto space-y-3">
            <span className="font-extrabold text-slate-800 uppercase tracking-wider text-xs block">
              Registro Completo de Entradas, Saídas e Cautelas ({movements.length})
            </span>

            {/* CARDS NO MOBILE (< lg) */}
            <div className="block lg:hidden space-y-2">
              {loadingMovements ? (
                <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 text-xs">
                  <Loader2 size={16} className="animate-spin mx-auto mb-2 text-sky-600" />
                  Carregando histórico...
                </div>
              ) : movements.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic bg-white rounded-2xl border border-slate-200 text-xs">
                  Nenhuma movimentação registrada para este item.
                </div>
              ) : (
                movements.map(mov => {
                  const isSaida = mov.movement_type.startsWith('saida') || mov.movement_type === 'descarte';

                  return (
                    <div key={mov.id} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        {getMovementBadge(mov.movement_type)}
                        <span className="font-mono text-[10px] text-slate-400">
                          {new Date(mov.created_at).toLocaleDateString('pt-BR')} às{' '}
                          {new Date(mov.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100">
                        <span className="text-slate-600 text-xs truncate max-w-[200px]">
                          {mov.work ? (
                            <span className="flex items-center gap-1 font-semibold text-slate-800">
                              <HardHat size={12} className="text-sky-600 shrink-0" /> {mov.work.title}
                            </span>
                          ) : mov.recipient ? (
                            <span className="flex items-center gap-1 font-semibold text-slate-800">
                              <User size={12} className="text-slate-400 shrink-0" /> {mov.recipient.full_name}
                            </span>
                          ) : (
                            'Ajuste Geral de Saldo'
                          )}
                        </span>

                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-bold ${isSaida ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {isSaida ? `-${mov.quantity}` : `+${mov.quantity}`}
                          </span>
                          <span className="text-slate-400 text-[10px] font-mono">Saldo: {mov.new_stock}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* TABELA NO DESKTOP (lg: em diante) */}
            <div className="hidden lg:block border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
              {loadingMovements ? (
                <div className="p-10 text-center text-slate-400 text-xs">
                  <Loader2 size={18} className="animate-spin mx-auto mb-2 text-sky-600" />
                  Carregando histórico do item...
                </div>
              ) : movements.length === 0 ? (
                <div className="p-10 text-center text-slate-400 italic text-xs">
                  Nenhuma movimentação registrada para este item até o momento.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600 min-w-[700px]">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-4">Data / Hora</th>
                        <th className="py-3 px-4">Operação</th>
                        <th className="py-3 px-4 text-center">Tam.</th>
                        <th className="py-3 px-4 text-center">Qtd.</th>
                        <th className="py-3 px-4 text-center">Saldo Resultante</th>
                        <th className="py-3 px-4">Destino / Responsável</th>
                        <th className="py-3 px-4">Doc / Romaneio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {movements.map(mov => {
                        const isSaida = mov.movement_type.startsWith('saida') || mov.movement_type === 'descarte';

                        return (
                          <tr key={mov.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {new Date(mov.created_at).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(mov.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </td>

                            <td className="py-3 px-4">{getMovementBadge(mov.movement_type)}</td>

                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                              {mov.size ? `Tam. ${mov.size}` : '—'}
                            </td>

                            <td className="py-3 px-4 text-center font-mono font-bold">
                              <span className={isSaida ? 'text-rose-600' : 'text-emerald-700'}>
                                {isSaida ? `-${mov.quantity}` : `+${mov.quantity}`}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                              {mov.new_stock}
                            </td>

                            <td className="py-3 px-4 text-slate-800">
                              {mov.work ? (
                                <div className="flex items-center gap-1.5">
                                  <HardHat size={13} className="text-sky-600 shrink-0" />
                                  <span className="truncate max-w-[200px]">
                                    {mov.work.code ? `[${mov.work.code}] ` : ''}{mov.work.title}
                                  </span>
                                </div>
                              ) : mov.recipient ? (
                                <div className="flex items-center gap-1.5">
                                  <User size={13} className="text-slate-400 shrink-0" />
                                  <span className="truncate">{mov.recipient.full_name}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500 truncate max-w-[150px]">
                              {mov.document_number || mov.notes || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* 7. ACTION SHEET MOBILE (ABERTO PELO MENU DO TOPO ...) */}
      {isMobileTopMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[180] flex flex-col justify-end bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setIsMobileTopMenuOpen(false)} />

          <div className="relative bg-white rounded-t-3xl p-5 space-y-3 animate-in slide-in-from-bottom duration-200 border-t border-slate-200 shadow-2xl">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2" />

            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
              Opções do Item
            </h3>

            <div className="space-y-2 pt-1">
              {onEditItem && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileTopMenuOpen(false);
                    onClose();
                    onEditItem(item);
                  }}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Edit3 size={18} />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">Editar Item</p>
                    <p className="text-[11px] text-slate-500 font-normal truncate">
                      Alterar especificações, CA e saldo mínimo
                    </p>
                  </div>
                </button>
              )}

              {onQuickMovement && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileTopMenuOpen(false);
                    onClose();
                    onQuickMovement(item);
                  }}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center shrink-0">
                    <ArrowUpRight size={18} />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">Movimentar Estoque</p>
                    <p className="text-[11px] text-slate-500 font-normal truncate">
                      Lançar entrada com NF ou saída para obra
                    </p>
                  </div>
                </button>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsMobileTopMenuOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (isMobile || !targetMainEl)
    ? createPortal(content, document.body)
    : createPortal(content, targetMainEl);
};

export default InventoryItemDetailModal;