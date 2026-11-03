import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  ShieldCheck,
  Package,
  HardHat,
  User,
  Calendar,
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileCheck,
  Link2,
  PlusCircle,
  Search,
  Check
} from 'lucide-react';
import type { MaterialRequest, InventoryItem } from './InventoryView';

interface FulfillRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  request: MaterialRequest | null;
  allItems: InventoryItem[];
}

interface FulfillItemRow {
  index: number;
  itemId?: string | null;
  itemName: string;
  itemType: 'epi' | 'uniforme' | 'material' | 'ferramenta' | 'consumivel';
  unit: string;
  size?: string | null;
  requestedQty: number;
  fulfillQty: number;
  availableStock: number;
  requiresSize: boolean;
  sizesStock: Record<string, number>;
  unitCost: number;
  caNumber?: string | null;
  isUncataloged: boolean;
}

export const FulfillRequestModal: React.FC<FulfillRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  request,
  allItems: initialAllItems
}) => {
  const { user } = useAuth();
  const [catalogItems, setCatalogItems] = useState<InventoryItem[]>(initialAllItems);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fulfillmentNotes, setFulfillmentNotes] = useState('');
  const [itemsRows, setItemsRows] = useState<FulfillItemRow[]>([]);

  // Estados para vinculação rápida
  const [linkingRowIndex, setLinkingRowIndex] = useState<number | null>(null);
  const [linkSearchTerm, setLinkSearchTerm] = useState('');

  // Estados para cadastro rápido de novo item
  const [quickCreateRowIndex, setQuickCreateRowIndex] = useState<number | null>(null);
  const [quickItemName, setQuickItemName] = useState('');
  const [quickItemType, setQuickItemType] = useState<'epi' | 'material' | 'ferramenta' | 'uniforme' | 'consumivel'>('material');
  const [quickUnit, setQuickUnit] = useState('un');
  const [quickCaNumber, setQuickCaNumber] = useState('');
  const [quickInitialStock, setQuickInitialStock] = useState('10');
  const [savingQuickItem, setSavingQuickItem] = useState(false);

  useEffect(() => {
    setCatalogItems(initialAllItems);
  }, [initialAllItems]);

  useEffect(() => {
    if (isOpen && request) {
      setErrorMsg('');
      setFulfillmentNotes('');
      setLinkingRowIndex(null);
      setQuickCreateRowIndex(null);

      const parsed: FulfillItemRow[] = (request.items || []).map((reqItem, idx) => {
        const found = catalogItems.find(
          i => i.id === reqItem.item_id || i.name.toLowerCase() === reqItem.item_name.toLowerCase()
        );

        const isUncataloged = !found;
        const reqSize = Boolean(found?.requires_size);
        const sStock = found?.sizes_stock && typeof found.sizes_stock === 'object' ? found.sizes_stock : {};
        const chosenSize = reqItem.size || '';
        const currentStock = reqSize && chosenSize
          ? (sStock[chosenSize] ?? 0)
          : Number(found?.current_stock) || 0;

        return {
          index: idx,
          itemId: found?.id || null,
          itemName: found?.name || reqItem.item_name,
          itemType: (found?.item_type as any) || 'material',
          unit: found?.unit || reqItem.unit || 'un',
          size: chosenSize,
          requestedQty: Number(reqItem.quantity) || 1,
          fulfillQty: Number(reqItem.quantity) || 1,
          availableStock: currentStock,
          requiresSize: reqSize,
          sizesStock: sStock,
          unitCost: Number(found?.unit_cost) || 0,
          caNumber: found?.ca_number || null,
          isUncataloged
        };
      });

      setItemsRows(parsed);
    }
  }, [isOpen, request, catalogItems]);

  const epiRows = useMemo(
    () => itemsRows.filter(r => r.itemType === 'epi' || r.itemType === 'uniforme'),
    [itemsRows]
  );

  const materialRows = useMemo(
    () => itemsRows.filter(r => r.itemType !== 'epi' && r.itemType !== 'uniforme'),
    [itemsRows]
  );

  const handleUpdateQty = (index: number, val: string) => {
    const num = Math.max(0, parseFloat(val.replace(',', '.')) || 0);
    setItemsRows(prev => prev.map(r => (r.index === index ? { ...r, fulfillQty: num } : r)));
  };

  // Vincular linha a um item já existente no catálogo
  const handleSelectLinkItem = (index: number, item: InventoryItem) => {
    const reqSize = Boolean(item.requires_size);
    const sStock = item.sizes_stock && typeof item.sizes_stock === 'object' ? item.sizes_stock : {};
    const chosenSize = itemsRows[index]?.size || '';
    const currentStock = reqSize && chosenSize ? (sStock[chosenSize] ?? 0) : Number(item.current_stock) || 0;

    setItemsRows(prev =>
      prev.map(r =>
        r.index === index
          ? {
              ...r,
              itemId: item.id,
              itemName: item.name,
              itemType: item.item_type,
              unit: item.unit || 'un',
              availableStock: currentStock,
              requiresSize: reqSize,
              sizesStock: sStock,
              unitCost: Number(item.unit_cost) || 0,
              caNumber: item.ca_number || null,
              isUncataloged: false
            }
          : r
      )
    );

    setLinkingRowIndex(null);
    setLinkSearchTerm('');
  };

  // Abrir mini modal de criação rápida
  const handleOpenQuickCreate = (row: FulfillItemRow) => {
    setQuickCreateRowIndex(row.index);
    setQuickItemName(row.itemName);
    setQuickItemType(row.itemType);
    setQuickUnit(row.unit || 'un');
    setQuickCaNumber('');
    setQuickInitialStock(String(row.requestedQty || 1));
  };

  // Cadastrar item no catálogo diretamente
  const handleSaveQuickItem = async (rowIndex: number) => {
    if (!user?.company?.id) return;
    if (!quickItemName.trim()) {
      alert('Informe o nome do item.');
      return;
    }

    try {
      setSavingQuickItem(true);
      const companyId = user.company.id;
      const initialStockNum = parseFloat(quickInitialStock.replace(',', '.')) || 0;

      const { data: newItem, error } = await supabase
        .from('inventory_items')
        .insert({
          company_id: companyId,
          name: quickItemName.trim(),
          item_type: quickItemType,
          category: quickItemType === 'epi' ? 'Segurança' : 'Geral',
          unit: quickUnit.trim() || 'un',
          current_stock: initialStockNum,
          min_stock: 1,
          unit_cost: 0,
          ca_number: quickItemType === 'epi' ? quickCaNumber.trim() || null : null,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      // Adiciona ao catálogo local
      setCatalogItems(prev => [newItem, ...prev]);

      // Vincula à linha atual
      setItemsRows(prev =>
        prev.map(r =>
          r.index === rowIndex
            ? {
                ...r,
                itemId: newItem.id,
                itemName: newItem.name,
                itemType: newItem.item_type,
                unit: newItem.unit,
                availableStock: initialStockNum,
                caNumber: newItem.ca_number,
                isUncataloged: false
              }
            : r
        )
      );

      setQuickCreateRowIndex(null);
    } catch (err: any) {
      alert('Erro ao cadastrar item no catálogo: ' + err.message);
    } finally {
      setSavingQuickItem(false);
    }
  };

  const totalDelivered = useMemo(
    () => itemsRows.reduce((acc, r) => acc + (r.fulfillQty || 0), 0),
    [itemsRows]
  );

  const isPartial = useMemo(() => {
    return itemsRows.some(r => r.fulfillQty < r.requestedQty && r.fulfillQty > 0);
  }, [itemsRows]);

  const hasUncatalogedPending = useMemo(() => {
    return itemsRows.some(r => r.isUncataloged && r.fulfillQty > 0);
  }, [itemsRows]);

  const handleConfirmFulfillment = async () => {
    if (!user?.company?.id || !request) return;

    if (hasUncatalogedPending) {
      setErrorMsg('Vincule ou cadastre todos os itens no catálogo antes de concluir o atendimento.');
      return;
    }

    const rowsWithDelivery = itemsRows.filter(r => r.fulfillQty > 0);

    if (rowsWithDelivery.length === 0) {
      setErrorMsg('Informe ao menos um item com quantidade a entregar maior que zero.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');
      const companyId = user.company.id;
      const recipientId = request.beneficiary_profile_id || request.requester_profile_id;

      for (const row of rowsWithDelivery) {
        if (!row.itemId) continue;

        const { data: freshItem, error: fetchErr } = await supabase
          .from('inventory_items')
          .select('current_stock, sizes_stock, requires_size, unit_cost')
          .eq('id', row.itemId)
          .single();

        if (fetchErr || !freshItem) throw new Error(`Item ${row.itemName} não encontrado no estoque.`);

        const prevStock = Number(freshItem.current_stock) || 0;
        const newStock = Math.max(0, prevStock - row.fulfillQty);
        let updatedSizes = freshItem.sizes_stock && typeof freshItem.sizes_stock === 'object' ? { ...freshItem.sizes_stock } : {};

        if (row.requiresSize && row.size) {
          const currentSizeQty = Number(updatedSizes[row.size]) || 0;
          updatedSizes[row.size] = Math.max(0, currentSizeQty - row.fulfillQty);
        }

        await supabase
          .from('inventory_items')
          .update({
            current_stock: newStock,
            sizes_stock: row.requiresSize ? updatedSizes : freshItem.sizes_stock,
            updated_at: new Date().toISOString()
          })
          .eq('id', row.itemId);

        const isEpi = row.itemType === 'epi' || row.itemType === 'uniforme';
        const movementType = isEpi ? 'saida_epi' : 'saida_obra';

        await supabase.from('inventory_movements').insert({
          company_id: companyId,
          item_id: row.itemId,
          movement_type: movementType,
          quantity: row.fulfillQty,
          size: row.requiresSize ? row.size || null : null,
          previous_stock: prevStock,
          new_stock: newStock,
          unit_cost: Number(freshItem.unit_cost) || 0,
          work_id: request.work_id || null,
          recipient_profile_id: recipientId,
          notes: `Atendimento de Solicitação #${request.id.slice(0, 8)} ${fulfillmentNotes ? `• ${fulfillmentNotes.trim()}` : ''}`,
          created_by: user.id
        });
      }

      const allZero = itemsRows.every(r => r.fulfillQty === 0);
      const allFull = itemsRows.every(r => r.fulfillQty >= r.requestedQty);
      const finalStatus = allZero ? 'pendente' : allFull ? 'entregue' : 'atendido_parcial';

      await supabase
        .from('material_requests')
        .update({
          status: finalStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao atender solicitação:', err);
      setErrorMsg('Erro ao atender solicitação: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !request) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl max-w-3xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[92vh]">
        
        {/* CABEÇALHO */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
              <FileCheck size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Atendimento de Solicitação
              </h2>
              <p className="text-xs text-slate-500">
                Confira os itens solicitados e defina as quantidades a baixar do estoque.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* CORPO */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* DADOS GERAIS DO PEDIDO */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50/80 border border-slate-200 rounded-2xl">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <User size={11} className="text-sky-600" />
                Destinatário
              </span>
              <strong className="text-xs font-bold text-slate-900 block truncate mt-0.5">
                {request.beneficiary?.full_name || request.requester?.full_name || 'Não informado'}
              </strong>
              {request.requester && request.beneficiary && request.requester.full_name !== request.beneficiary.full_name && (
                <span className="text-[10px] text-slate-400 block truncate">
                  Por: {request.requester.full_name}
                </span>
              )}
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <HardHat size={11} className="text-sky-600" />
                Obra
              </span>
              <strong className="text-xs font-bold text-slate-900 block truncate mt-0.5">
                {request.work ? `${request.work.code ? `[${request.work.code}] ` : ''}${request.work.title}` : 'Uso Geral / Sem Obra'}
              </strong>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <Calendar size={11} className="text-slate-400" />
                Data do Pedido
              </span>
              <strong className="text-xs font-medium text-slate-800 block mt-0.5 font-mono">
                {new Date(request.created_at).toLocaleDateString('pt-BR')}
              </strong>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <Clock size={11} className="text-slate-400" />
                Urgência
              </span>
              <span
                className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                  request.urgency === 'urgente'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : request.urgency === 'baixa'
                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                    : 'bg-sky-50 text-sky-800 border-sky-200'
                }`}
              >
                {request.urgency}
              </span>
            </div>
          </div>

          {/* TABELA 1: EPIS & UNIFORMES (CAUTELA NOMINAL) */}
          {epiRows.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
              <div className="px-4 py-2.5 bg-sky-50/70 border-b border-sky-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-sky-700" />
                  <span className="font-bold text-xs text-sky-950 uppercase tracking-wider">
                    Equipamentos de Proteção & Uniforme (Cautela NR-06)
                  </span>
                </div>
                <span className="text-[10px] font-bold text-sky-700 bg-white border border-sky-200 px-2 py-0.5 rounded-md">
                  Gera Cautela Nominal
                </span>
              </div>

              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <span className="col-span-5">Item / EPI</span>
                <span className="col-span-2 text-center">Tam. / Grade</span>
                <span className="col-span-2 text-center">Saldo em Estoque</span>
                <span className="col-span-1 text-center">Pedido</span>
                <span className="col-span-2 text-center">Entregar</span>
              </div>

              <div className="divide-y divide-slate-100">
                {epiRows.map(row => {
                  const isInsufficient = row.availableStock < row.fulfillQty;

                  return (
                    <div key={row.index} className="px-3 py-2.5 hover:bg-slate-50/60 transition space-y-2">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <strong className="text-slate-900 font-bold text-xs truncate">
                              {row.itemName}
                            </strong>
                            {row.isUncataloged && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
                                Não Catalogado
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {row.caNumber ? `CA: ${row.caNumber}` : 'Equipamento Nominal'}
                          </span>
                        </div>

                        <div className="col-span-2 text-center">
                          <span className="font-mono font-bold text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {row.size ? `Tam. ${row.size}` : 'Único'}
                          </span>
                        </div>

                        <div className="col-span-2 text-center">
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] border ${
                              row.isUncataloged
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : isInsufficient
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {row.isUncataloged ? '—' : `${row.availableStock} ${row.unit}`}
                          </span>
                        </div>

                        <div className="col-span-1 text-center font-mono font-bold text-slate-500">
                          {row.requestedQty}
                        </div>

                        <div className="col-span-2 flex items-center justify-center gap-1">
                          <input
                            type="text"
                            value={row.fulfillQty}
                            onChange={e => handleUpdateQty(row.index, e.target.value)}
                            className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-xl font-mono font-bold text-center text-xs text-slate-900 focus:ring-2 focus:ring-sky-500"
                          />
                          <span className="text-[10px] text-slate-400">{row.unit}</span>
                        </div>
                      </div>

                      {/* Opções de Vinculação ou Cadastro de Item Não Catalogado */}
                      {row.isUncataloged && (
                        <div className="pt-1.5 flex items-center gap-2 border-t border-dashed border-amber-200 bg-amber-50/50 p-2 rounded-xl">
                          <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                          <span className="text-[11px] text-amber-900 font-semibold">
                            Item não encontrado no estoque:
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setLinkingRowIndex(row.index);
                              setLinkSearchTerm(row.itemName);
                              setQuickCreateRowIndex(null);
                            }}
                            className="text-[11px] font-bold text-sky-700 hover:text-sky-800 bg-white border border-sky-200 px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer transition active:scale-95"
                          >
                            <Link2 size={12} />
                            <span>Vincular Existente</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleOpenQuickCreate(row);
                              setLinkingRowIndex(null);
                            }}
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-white border border-emerald-200 px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer transition active:scale-95"
                          >
                            <PlusCircle size={12} />
                            <span>+ Cadastrar no Catálogo</span>
                          </button>
                        </div>
                      )}

                      {/* Dropdown de Vinculação Rápida */}
                      {linkingRowIndex === row.index && (
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-in fade-in duration-100">
                          <div className="flex items-center gap-2">
                            <Search size={14} className="text-slate-400" />
                            <input
                              type="text"
                              autoFocus
                              placeholder="Pesquise o item oficial no catálogo..."
                              value={linkSearchTerm}
                              onChange={e => setLinkSearchTerm(e.target.value)}
                              className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                            <button
                              type="button"
                              onClick={() => setLinkingRowIndex(null)}
                              className="p-1 text-slate-400 hover:text-slate-600"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-lg">
                            {catalogItems
                              .filter(it => it.name.toLowerCase().includes(linkSearchTerm.toLowerCase()))
                              .slice(0, 5)
                              .map(it => (
                                <div
                                  key={it.id}
                                  onClick={() => handleSelectLinkItem(row.index, it)}
                                  className="p-2 text-xs hover:bg-sky-50 cursor-pointer flex items-center justify-between"
                                >
                                  <div>
                                    <strong className="text-slate-900 block">{it.name}</strong>
                                    <span className="text-[10px] text-slate-400">
                                      {it.item_type} {it.ca_number ? `• CA ${it.ca_number}` : ''}
                                    </span>
                                  </div>
                                  <span className="font-mono text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                    Saldo: {it.current_stock} {it.unit}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Mini-Formulário de Cadastro Rápido Inline */}
                      {quickCreateRowIndex === row.index && (
                        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5 animate-in fade-in duration-100">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-emerald-950 text-[11px] uppercase tracking-wider">
                              Cadastrar Item no Estoque Agora
                            </span>
                            <button
                              type="button"
                              onClick={() => setQuickCreateRowIndex(null)}
                              className="p-1 text-slate-400 hover:text-slate-600"
                            >
                              <X size={13} />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Nome Oficial *</label>
                              <input
                                type="text"
                                value={quickItemName}
                                onChange={e => setQuickItemName(e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Tipo *</label>
                              <select
                                value={quickItemType}
                                onChange={e => setQuickItemType(e.target.value as any)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                              >
                                <option value="epi">EPI</option>
                                <option value="uniforme">Uniforme</option>
                                <option value="material">Material</option>
                                <option value="ferramenta">Ferramenta</option>
                                <option value="consumivel">Consumível</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Saldo Inicial *</label>
                              <input
                                type="text"
                                value={quickInitialStock}
                                onChange={e => setQuickInitialStock(e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-center"
                              />
                            </div>
                          </div>
                          {quickItemType === 'epi' && (
                            <div className="max-w-xs">
                              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Número do CA (NR-06)</label>
                              <input
                                type="text"
                                placeholder="Ex: 44555"
                                value={quickCaNumber}
                                onChange={e => setQuickCaNumber(e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                              />
                            </div>
                          )}
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              disabled={savingQuickItem}
                              onClick={() => handleSaveQuickItem(row.index)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                            >
                              {savingQuickItem ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              <span>Salvar no Catálogo & Vincular</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TABELA 2: MATERIAIS & FERRAMENTAS DE OBRA */}
          {materialRows.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package size={16} className="text-slate-700" />
                  <span className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                    Materiais, Ferramentas & Insumos de Canteiro
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                  Saída p/ Obra
                </span>
              </div>

              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <span className="col-span-5">Descrição do Material</span>
                <span className="col-span-2 text-center">Unidade</span>
                <span className="col-span-2 text-center">Saldo em Estoque</span>
                <span className="col-span-1 text-center">Pedido</span>
                <span className="col-span-2 text-center">Entregar</span>
              </div>

              <div className="divide-y divide-slate-100">
                {materialRows.map(row => {
                  const isInsufficient = row.availableStock < row.fulfillQty;

                  return (
                    <div key={row.index} className="px-3 py-2.5 hover:bg-slate-50/60 transition space-y-2">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <strong className="text-slate-900 font-bold text-xs truncate">
                              {row.itemName}
                            </strong>
                            {row.isUncataloged && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
                                Não Catalogado
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block capitalize">
                            {row.itemType}
                          </span>
                        </div>

                        <div className="col-span-2 text-center font-mono text-slate-600">
                          {row.unit}
                        </div>

                        <div className="col-span-2 text-center">
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] border ${
                              row.isUncataloged
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : isInsufficient
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {row.isUncataloged ? '—' : `${row.availableStock} ${row.unit}`}
                          </span>
                        </div>

                        <div className="col-span-1 text-center font-mono font-bold text-slate-500">
                          {row.requestedQty}
                        </div>

                        <div className="col-span-2 flex items-center justify-center gap-1">
                          <input
                            type="text"
                            value={row.fulfillQty}
                            onChange={e => handleUpdateQty(row.index, e.target.value)}
                            className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-xl font-mono font-bold text-center text-xs text-slate-900 focus:ring-2 focus:ring-sky-500"
                          />
                          <span className="text-[10px] text-slate-400">{row.unit}</span>
                        </div>
                      </div>

                      {/* Opções de Vinculação ou Cadastro de Item Não Catalogado */}
                      {row.isUncataloged && (
                        <div className="pt-1.5 flex items-center gap-2 border-t border-dashed border-amber-200 bg-amber-50/50 p-2 rounded-xl">
                          <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                          <span className="text-[11px] text-amber-900 font-semibold">
                            Item não encontrado no estoque:
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setLinkingRowIndex(row.index);
                              setLinkSearchTerm(row.itemName);
                              setQuickCreateRowIndex(null);
                            }}
                            className="text-[11px] font-bold text-sky-700 hover:text-sky-800 bg-white border border-sky-200 px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer transition active:scale-95"
                          >
                            <Link2 size={12} />
                            <span>Vincular Existente</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleOpenQuickCreate(row);
                              setLinkingRowIndex(null);
                            }}
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-white border border-emerald-200 px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer transition active:scale-95"
                          >
                            <PlusCircle size={12} />
                            <span>+ Cadastrar no Catálogo</span>
                          </button>
                        </div>
                      )}

                      {/* Dropdown de Vinculação Rápida */}
                      {linkingRowIndex === row.index && (
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-in fade-in duration-100">
                          <div className="flex items-center gap-2">
                            <Search size={14} className="text-slate-400" />
                            <input
                              type="text"
                              autoFocus
                              placeholder="Pesquise o material oficial no estoque..."
                              value={linkSearchTerm}
                              onChange={e => setLinkSearchTerm(e.target.value)}
                              className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                            <button
                              type="button"
                              onClick={() => setLinkingRowIndex(null)}
                              className="p-1 text-slate-400 hover:text-slate-600"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-lg">
                            {catalogItems
                              .filter(it => it.name.toLowerCase().includes(linkSearchTerm.toLowerCase()))
                              .slice(0, 5)
                              .map(it => (
                                <div
                                  key={it.id}
                                  onClick={() => handleSelectLinkItem(row.index, it)}
                                  className="p-2 text-xs hover:bg-sky-50 cursor-pointer flex items-center justify-between"
                                >
                                  <div>
                                    <strong className="text-slate-900 block">{it.name}</strong>
                                    <span className="text-[10px] text-slate-400 capitalize">{it.item_type}</span>
                                  </div>
                                  <span className="font-mono text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                    Saldo: {it.current_stock} {it.unit}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Mini-Formulário de Cadastro Rápido Inline */}
                      {quickCreateRowIndex === row.index && (
                        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5 animate-in fade-in duration-100">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-emerald-950 text-[11px] uppercase tracking-wider">
                              Cadastrar Material no Estoque Agora
                            </span>
                            <button
                              type="button"
                              onClick={() => setQuickCreateRowIndex(null)}
                              className="p-1 text-slate-400 hover:text-slate-600"
                            >
                              <X size={13} />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Descrição Oficial *</label>
                              <input
                                type="text"
                                value={quickItemName}
                                onChange={e => setQuickItemName(e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Tipo *</label>
                              <select
                                value={quickItemType}
                                onChange={e => setQuickItemType(e.target.value as any)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                              >
                                <option value="material">Material</option>
                                <option value="ferramenta">Ferramenta</option>
                                <option value="consumivel">Consumível</option>
                                <option value="epi">EPI</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Saldo Inicial *</label>
                              <input
                                type="text"
                                value={quickInitialStock}
                                onChange={e => setQuickInitialStock(e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-center"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              disabled={savingQuickItem}
                              onClick={() => handleSaveQuickItem(row.index)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                            >
                              {savingQuickItem ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              <span>Salvar no Catálogo & Vincular</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* OBSERVAÇÃO */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Observações do Atendimento
            </label>
            <input
              type="text"
              placeholder="Ex: Entregue parcialmente por falta de saldo, restante chegará amanhã..."
              value={fulfillmentNotes}
              onChange={e => setFulfillmentNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* RODAPÉ */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {isPartial && (
              <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1">
                <AlertTriangle size={13} />
                Será registrado como "Atendido em Parte"
              </span>
            )}
            {hasUncatalogedPending && (
              <span className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1">
                <AlertCircle size={13} />
                Existem itens avulsos pendentes de vínculo
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl cursor-pointer text-xs transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving || totalDelivered === 0 || hasUncatalogedPending}
              onClick={handleConfirmFulfillment}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-98 text-xs transition"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              <span>Concluir Atendimento ({totalDelivered} itens)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FulfillRequestModal;