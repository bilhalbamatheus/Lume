import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  HardHat,
  Plus,
  Trash2,
  FileCheck2,
  Loader2,
  AlertCircle,
  Layers
} from 'lucide-react';

export interface InventoryEpiItem {
  id: string;
  name: string;
  ca_number?: string | null;
  ca_expiry_date?: string | null;
  current_stock: number;
  unit: string;
  lifespan_days?: number | null;
  requires_size?: boolean;
  sizes_stock?: Record<string, number> | null;
}

export interface EpiRowItem {
  id: string;
  inventory_item_id?: string | null;
  epi_name: string;
  ca_number: string;
  size: string;
  requiresSize: boolean;
  availableSizes: string[];
  sizesStock: Record<string, number>;
  current_stock: number;
  unit: string;
  quantity: string;
  condition: string;
  searchText: string;
  isMenuOpen: boolean;
}

interface DeliverEpiModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeRecordId: string;
  employeeName: string;
  onSaved: () => void;
}

export const DeliverEpiModal: React.FC<DeliverEpiModalProps> = ({
  isOpen,
  onClose,
  employeeRecordId,
  employeeName,
  onSaved
}) => {
  const { user } = useAuth();

  // Cabeçalho da Ficha de Cautela / Entrega
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryReason, setDeliveryReason] = useState('admissao');
  const [generalNotes, setGeneralNotes] = useState('');

  // Catálogo carregado do Almoxarifado
  const [catalogEpis, setCatalogEpis] = useState<InventoryEpiItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Linhas da Grade de Entrega
  const [rows, setRows] = useState<EpiRowItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const createInitialRow = (): EpiRowItem => ({
    id: crypto.randomUUID(),
    inventory_item_id: null,
    epi_name: '',
    ca_number: '',
    size: '',
    requiresSize: false,
    availableSizes: [],
    sizesStock: {},
    current_stock: 0,
    unit: 'un',
    quantity: '1',
    condition: 'novo',
    searchText: '',
    isMenuOpen: false
  });

  // Fecha menus inline de itens ao clicar fora
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.epi-search-container')) {
        setRows(prev => prev.map(r => (r.isMenuOpen ? { ...r, isMenuOpen: false } : r)));
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Carrega os EPIs cadastrados e ativos no Almoxarifado trazendo a grade sizes_stock
  useEffect(() => {
    if (!isOpen || !user?.company?.id) return;

    const fetchEpis = async () => {
      try {
        setLoadingCatalog(true);
        const { data, error } = await supabase
          .from('inventory_items')
          .select('id, name, ca_number, ca_expiry_date, current_stock, unit, lifespan_days, requires_size, sizes_stock')
          .eq('company_id', user.company.id)
          .eq('item_type', 'epi')
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (error) throw error;
        setCatalogEpis(data || []);
      } catch (err: any) {
        console.warn('Erro ao carregar catálogo de EPIs do almoxarifado:', err.message);
      } finally {
        setLoadingCatalog(false);
      }
    };

    fetchEpis();
  }, [isOpen, user?.company?.id]);

  // Reset ao abrir
  useEffect(() => {
    if (isOpen) {
      setDeliveryDate(new Date().toISOString().split('T')[0]);
      setDeliveryReason('admissao');
      setGeneralNotes('');
      setErrorMsg('');
      setRows([createInitialRow()]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handlers da Grade
  const handleAddRow = () => {
    setRows(prev => [...prev, createInitialRow()]);
  };

  const handleRemoveRow = (rowId: string) => {
    if (rows.length === 1) {
      setRows([createInitialRow()]);
      return;
    }
    setRows(prev => prev.filter(r => r.id !== rowId));
  };

  const handleUpdateRow = (rowId: string, fields: Partial<EpiRowItem>) => {
    setRows(prev => prev.map(r => (r.id === rowId ? { ...r, ...fields } : r)));
  };

  const handleSelectEpiInRow = (rowId: string, epi: InventoryEpiItem) => {
    const reqSize = Boolean(epi.requires_size);
    const sStock = epi.sizes_stock && typeof epi.sizes_stock === 'object' ? epi.sizes_stock : {};
    const sizeKeys = Object.keys(sStock);

    handleUpdateRow(rowId, {
      inventory_item_id: epi.id,
      epi_name: epi.name,
      ca_number: epi.ca_number || '',
      requiresSize: reqSize,
      availableSizes: sizeKeys,
      sizesStock: sStock,
      size: sizeKeys.length > 0 ? sizeKeys[0] : '',
      current_stock: Number(epi.current_stock) || 0,
      unit: epi.unit || 'un',
      searchText: epi.name,
      isMenuOpen: false
    });
  };

  // Total de unidades no termo
  const totalUnits = rows.reduce((acc, r) => {
    return acc + (parseInt(r.quantity, 10) || 0);
  }, 0);

  // Salvar entrega em lote e debitar do almoxarifado
  const handleSaveBatchDelivery = async () => {
    const validRows = rows.filter(r => r.epi_name.trim() && (parseInt(r.quantity, 10) || 0) > 0);

    if (validRows.length === 0) {
      setErrorMsg('Adicione pelo menos um EPI válido com quantidade maior que zero.');
      return;
    }

    if (!user?.company?.id || !employeeRecordId) return;

    try {
      setSaving(true);
      setErrorMsg('');

      const batchId = crypto.randomUUID();

      // 1. Grava os itens na cautela do colaborador (employee_epi_deliveries)
      const payload = validRows.map(row => ({
        company_id: user.company.id,
        employee_record_id: employeeRecordId,
        delivery_batch_id: batchId,
        inventory_item_id: row.inventory_item_id || null,
        epi_id: row.inventory_item_id || null,
        epi_name: row.epi_name.trim(),
        ca_number: row.ca_number.trim() || null,
        size: row.requiresSize ? row.size.trim() || null : null,
        quantity: parseInt(row.quantity, 10) || 1,
        delivery_date: deliveryDate,
        condition: row.condition,
        reason: deliveryReason,
        notes: generalNotes.trim() || null,
        delivered_by: user.id
      }));

      const { error: deliveryErr } = await supabase
        .from('employee_epi_deliveries')
        .insert(payload);

      if (deliveryErr) throw deliveryErr;

      // 2. Atualiza os saldos no Almoxarifado para os itens catalogados
      for (const row of validRows) {
        if (!row.inventory_item_id) continue;

        const qtyNum = parseInt(row.quantity, 10) || 1;

        const { data: freshItem } = await supabase
          .from('inventory_items')
          .select('current_stock, sizes_stock, requires_size')
          .eq('id', row.inventory_item_id)
          .single();

        if (freshItem) {
          const prevStock = Number(freshItem.current_stock) || 0;
          const newStock = Math.max(0, prevStock - qtyNum);
          let updatedSizesStock = freshItem.sizes_stock && typeof freshItem.sizes_stock === 'object' ? { ...freshItem.sizes_stock } : {};

          if (row.requiresSize && row.size) {
            const currentSizeQty = Number(updatedSizesStock[row.size]) || 0;
            updatedSizesStock[row.size] = Math.max(0, currentSizeQty - qtyNum);
          }

          await supabase
            .from('inventory_items')
            .update({
              current_stock: newStock,
              sizes_stock: row.requiresSize ? updatedSizesStock : freshItem.sizes_stock,
              updated_at: new Date().toISOString()
            })
            .eq('id', row.inventory_item_id);

          await supabase.from('inventory_movements').insert({
            company_id: user.company.id,
            item_id: row.inventory_item_id,
            movement_type: 'saida_epi',
            quantity: qtyNum,
            size: row.requiresSize ? row.size || null : null,
            previous_stock: prevStock,
            new_stock: newStock,
            notes: `Entrega de Cautela para ${employeeName}`,
            created_by: user.id
          });
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg('Erro ao salvar termo de entrega: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[360] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150">
        {/* CABEÇALHO */}
        <header className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
              <HardHat size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Ficha de Entrega de EPIs (Cautela NR-06)
              </h3>
              <p className="text-xs text-slate-500">
                Colaborador: <strong className="text-slate-800">{employeeName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </header>

        {/* CORPO */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* DADOS GERAIS DO TERMO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Data da Entrega *</label>
              <input
                type="date"
                required
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Motivo do Pedido *</label>
              <select
                value={deliveryReason}
                onChange={e => setDeliveryReason(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="admissao">Admissão (Kit Inicial)</option>
                <option value="troca_periodica">Troca Periódica (Desgaste)</option>
                <option value="danificado">Substituição por Dano</option>
                <option value="extraviado">Extravio / Perda</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Observações do Termo</label>
              <input
                type="text"
                placeholder="Ex: Canteiro Obra Solar 01..."
                value={generalNotes}
                onChange={e => setGeneralNotes(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* GRADE DE ITENS DINÂMICA COM VISIBILIDADE LIVRE */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs">
            {/* Header da Tabela */}
            <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center">
                  <Layers size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">EPIs da Ficha de Cautela ({rows.length})</h4>
                  <p className="text-[10px] text-slate-400">Selecione os equipamentos do almoxarifado para entrega nominal.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer active:scale-98 transition"
              >
                <Plus size={13} />
                <span>Adicionar Linha</span>
              </button>
            </div>

            {/* Cabeçalho das Colunas */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider items-center">
              <span className="col-span-1 text-center">#</span>
              <span className="col-span-4">Descrição do EPI (Catálogo)</span>
              <span className="col-span-2 text-center">Nº do CA</span>
              <span className="col-span-2 text-center">Tam. / Grade</span>
              <span className="col-span-1 text-center">Saldo</span>
              <span className="col-span-1 text-center">Qtd.</span>
              <span className="col-span-1 text-center"></span>
            </div>

            {/* Linhas Editáveis */}
            <div className="divide-y divide-slate-100">
              {rows.map((row, idx) => {
                const rowFilteredItems = catalogEpis.filter(
                  e =>
                    !row.searchText ||
                    e.name.toLowerCase().includes(row.searchText.toLowerCase().trim()) ||
                    (e.ca_number && e.ca_number.includes(row.searchText.trim()))
                );

                const currentSizeStock = row.requiresSize && row.size ? (row.sizesStock[row.size] ?? 0) : row.current_stock;
                const isStockInsufficient = row.inventory_item_id && currentSizeStock < (parseInt(row.quantity, 10) || 0);

                return (
                  <div
                    key={row.id}
                    className={`grid grid-cols-12 gap-2 px-3 py-2 items-center hover:bg-slate-50/60 transition text-xs ${
                      row.isMenuOpen ? 'relative z-30' : 'relative z-0'
                    }`}
                  >
                    {/* Index */}
                    <span className="col-span-1 text-center font-bold text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </span>

                    {/* Descrição com Autocomplete Inline */}
                    <div className="col-span-4 relative epi-search-container">
                      <div className="relative flex items-center bg-white border border-slate-200 rounded-xl focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/10">
                        <input
                          type="text"
                          placeholder="Digite para buscar..."
                          value={row.searchText}
                          onFocus={() => {
                            setRows(prev => prev.map(r => ({ ...r, isMenuOpen: r.id === row.id })));
                          }}
                          onChange={e => {
                            handleUpdateRow(row.id, {
                              searchText: e.target.value,
                              epi_name: e.target.value,
                              isMenuOpen: true,
                              inventory_item_id: null,
                              requiresSize: false,
                              availableSizes: [],
                              sizesStock: {},
                              size: ''
                            });
                          }}
                          className="w-full px-2.5 py-1.5 text-xs text-slate-900 font-semibold bg-transparent focus:outline-none"
                        />
                        {row.searchText && (
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateRow(row.id, {
                                searchText: '',
                                epi_name: '',
                                inventory_item_id: null,
                                ca_number: '',
                                size: '',
                                requiresSize: false,
                                availableSizes: [],
                                sizesStock: {},
                                current_stock: 0,
                                isMenuOpen: false
                              });
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      {/* Dropdown de Sugestões Inline */}
                      {row.isMenuOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-1.5 max-h-52 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                          {rowFilteredItems.length === 0 ? (
                            <div className="p-2.5 text-center text-[11px] text-slate-400 italic">
                              Nenhum EPI encontrado no almoxarifado. (Item será cadastrado como avulso)
                            </div>
                          ) : (
                            rowFilteredItems.map(epi => (
                              <div
                                key={epi.id}
                                onClick={() => handleSelectEpiInRow(row.id, epi)}
                                className="p-2 rounded-xl text-xs cursor-pointer hover:bg-slate-50 flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-semibold text-slate-800 block">{epi.name}</span>
                                  <span className="text-[10px] text-slate-400 block">
                                    CA: {epi.ca_number || 'Sem CA'} {epi.requires_size ? '• Item com Grade' : ''}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                                  Saldo: {epi.current_stock} {epi.unit}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Nº do CA */}
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Ex: 34567"
                        value={row.ca_number}
                        onChange={e => handleUpdateRow(row.id, { ca_number: e.target.value })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-center text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold"
                      />
                    </div>

                    {/* Tamanho (Dropdown se houver grade, senão input livre) */}
                    <div className="col-span-2">
                      {row.requiresSize ? (
                        <select
                          value={row.size}
                          onChange={e => handleUpdateRow(row.id, { size: e.target.value })}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer focus:ring-2 focus:ring-sky-500"
                        >
                          {row.availableSizes.map(s => (
                            <option key={s} value={s}>
                              Tam. {s} ({row.sizesStock[s] ?? 0} {row.unit})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="Tam. (opcional)"
                          value={row.size}
                          onChange={e => handleUpdateRow(row.id, { size: e.target.value.toUpperCase() })}
                          className="w-full px-1.5 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-center text-xs text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold"
                        />
                      )}
                    </div>

                    {/* Saldo Atual */}
                    <div className="col-span-1 text-center">
                      <span
                        className={`font-mono font-bold px-1.5 py-0.5 rounded-lg text-[10px] block truncate ${
                          row.inventory_item_id
                            ? isStockInsufficient
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700'
                            : 'text-slate-400 italic'
                        }`}
                        title={row.inventory_item_id ? `Saldo atual em estoque: ${currentSizeStock} ${row.unit}` : 'Item avulso'}
                      >
                        {row.inventory_item_id ? `${currentSizeStock}` : '—'}
                      </span>
                    </div>

                    {/* Quantidade */}
                    <div className="col-span-1">
                      <input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={e => handleUpdateRow(row.id, { quantity: e.target.value })}
                        className="w-full px-1 py-1.5 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-900 text-center text-xs focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    {/* Ações */}
                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition"
                        title="Remover linha"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rodapé da Grade */}
            <div className="p-3 bg-slate-50/80 border-t border-slate-200 rounded-b-2xl flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">
                Linhas ativas: <strong className="text-slate-800">{rows.length}</strong>
              </span>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total de Peças no Termo</span>
                <strong className="text-sm font-black font-mono text-slate-900">
                  {totalUnits} un
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ DO MODAL */}
        <footer className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Itens preenchidos: <strong className="text-slate-900">{rows.filter(r => r.epi_name.trim()).length}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl cursor-pointer text-xs"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving || rows.filter(r => r.epi_name.trim()).length === 0}
              onClick={handleSaveBatchDelivery}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-98 text-xs transition"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <FileCheck2 size={14} />}
              <span>Concluir e Registrar Entrega ({totalUnits})</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default DeliverEpiModal;