import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Trash2,
  HardHat,
  Save,
  Loader2,
  User,
  Building2,
  Search,
  ChevronDown,
  Plus,
  Layers,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';

interface InventoryMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item?: any | null;
  allItems: any[];
  defaultMovementType?: 'saida_obra' | 'saida_epi' | 'entrada_compra' | 'devolucao' | 'descarte';
  defaultRecipientId?: string;
  defaultRecipientName?: string;
}

type MovementType = 'saida_obra' | 'saida_epi' | 'entrada_compra' | 'devolucao' | 'descarte';

interface WorkOption {
  id: string;
  title: string;
  code?: string | null;
}

interface ProfileOption {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

interface SupplierOption {
  id: string;
  display_name: string;
}

interface RowItem {
  id: string;
  itemId: string;
  itemName: string;
  itemType: string;
  caNumber?: string | null;
  size: string;
  requiresSize: boolean;
  availableSizes: string[];
  sizesStock: Record<string, number>;
  category: string;
  unit: string;
  currentStock: number;
  quantity: string;
  unitCost: string;
  condition: string;
  searchText: string;
  isMenuOpen: boolean;
}

const formatCurrency = (val: number) => {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const InventoryMovementModal: React.FC<InventoryMovementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  item,
  allItems,
  defaultMovementType = 'saida_obra',
  defaultRecipientId = '',
  defaultRecipientName = ''
}) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Tipo de Operação
  const [movementType, setMovementType] = useState<MovementType>(defaultMovementType);

  // Destino / Origem / Responsáveis
  const [selectedWorkId, setSelectedWorkId] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState(defaultRecipientId);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [epiReason, setEpiReason] = useState('admissao');
  const [hasDocument, setHasDocument] = useState(false);
  const [documentNumber, setDocumentNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Linhas da Tabela Dinâmica
  const [rows, setRows] = useState<RowItem[]>([]);

  // Autocomplete: Obra
  const [workSearchText, setWorkSearchText] = useState('');
  const [isWorkMenuOpen, setIsWorkMenuOpen] = useState(false);
  const workRef = useRef<HTMLDivElement>(null);

  // Autocomplete: Responsável / Beneficiário
  const [profileSearchText, setProfileSearchText] = useState(defaultRecipientName);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Listas da empresa
  const [works, setWorks] = useState<WorkOption[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);

  // Fecha menus ao clicar fora
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (workRef.current && !workRef.current.contains(e.target as Node)) {
        setIsWorkMenuOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      const target = e.target as HTMLElement;
      if (!target.closest('.item-search-container')) {
        setRows(prev => prev.map(r => (r.isMenuOpen ? { ...r, isMenuOpen: false } : r)));
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const createInitialRow = (defaultItem?: any | null): RowItem => {
    const reqSize = Boolean(defaultItem?.requires_size);
    const sStock = defaultItem?.sizes_stock && typeof defaultItem.sizes_stock === 'object' ? defaultItem.sizes_stock : {};
    const sizeKeys = Object.keys(sStock);

    return {
      id: crypto.randomUUID(),
      itemId: defaultItem?.id || '',
      itemName: defaultItem?.name || '',
      itemType: defaultItem?.item_type || 'material',
      caNumber: defaultItem?.ca_number || null,
      size: sizeKeys.length > 0 ? sizeKeys[0] : '',
      requiresSize: reqSize,
      availableSizes: sizeKeys,
      sizesStock: sStock,
      category: defaultItem?.category || '',
      unit: defaultItem?.unit || 'un',
      currentStock: Number(defaultItem?.current_stock) || 0,
      quantity: '1',
      unitCost: String(defaultItem?.unit_cost || 0),
      condition: 'novo',
      searchText: defaultItem?.name || '',
      isMenuOpen: false
    };
  };

  // Reset do formulário ao abrir
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setMovementType(defaultMovementType);
      setSelectedWorkId('');
      setSelectedRecipientId(defaultRecipientId);
      setProfileSearchText(defaultRecipientName);
      setSelectedSupplierId('');
      setEpiReason('admissao');
      setHasDocument(false);
      setDocumentNumber('');
      setNotes('');
      setWorkSearchText('');
      setRows([createInitialRow(item)]);
    }
  }, [isOpen, item, defaultMovementType, defaultRecipientId, defaultRecipientName]);

  // Carrega Obras, Colaboradores e Fornecedores
  useEffect(() => {
    if (!isOpen || !user?.company?.id) return;

    const loadData = async () => {
      const companyId = user.company.id;
      const [wRes, pRes, sRes] = await Promise.all([
        supabase
          .from('works')
          .select('id, title, code')
          .eq('company_id', companyId)
          .neq('status', 'cancelada')
          .order('title', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('full_name', { ascending: true }),
        supabase
          .from('contacts')
          .select('id, display_name')
          .eq('company_id', companyId)
          .eq('business_relation_type', 'fornecedor')
          .order('display_name', { ascending: true })
      ]);

      setWorks(wRes.data || []);
      setProfiles(pRes.data || []);
      setSuppliers(sRes.data || []);
    };

    loadData();
  }, [isOpen, user?.company?.id]);

  const isIncoming = movementType === 'entrada_compra' || movementType === 'devolucao';
  const isEpiCautela = movementType === 'saida_epi';

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

  const handleUpdateRow = (rowId: string, fields: Partial<RowItem>) => {
    setRows(prev => prev.map(r => (r.id === rowId ? { ...r, ...fields } : r)));
  };

  const handleSelectItemInRow = (rowId: string, selectedItem: any) => {
    const reqSize = Boolean(selectedItem.requires_size);
    const sStock = selectedItem.sizes_stock && typeof selectedItem.sizes_stock === 'object' ? selectedItem.sizes_stock : {};
    const sizeKeys = Object.keys(sStock);

    handleUpdateRow(rowId, {
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      itemType: selectedItem.item_type || 'material',
      caNumber: selectedItem.ca_number || null,
      requiresSize: reqSize,
      availableSizes: sizeKeys,
      sizesStock: sStock,
      size: sizeKeys.length > 0 ? sizeKeys[0] : '',
      category: selectedItem.category,
      unit: selectedItem.unit,
      currentStock: Number(selectedItem.current_stock) || 0,
      unitCost: String(selectedItem.unit_cost || 0),
      searchText: selectedItem.name,
      isMenuOpen: false
    });
  };

  const filteredWorks = useMemo(() => {
    const q = workSearchText.toLowerCase().trim();
    if (!q) return works;
    return works.filter(
      w => w.title.toLowerCase().includes(q) || (w.code && w.code.toLowerCase().includes(q))
    );
  }, [works, workSearchText]);

  const filteredProfiles = useMemo(() => {
    const q = profileSearchText.toLowerCase().trim();
    if (!q) return profiles;
    return profiles.filter(p => p.full_name.toLowerCase().includes(q));
  }, [profiles, profileSearchText]);

  const totalBatchCost = useMemo(() => {
    return rows.reduce((acc, r) => {
      const q = parseFloat(r.quantity.replace(',', '.')) || 0;
      const c = parseFloat(r.unitCost.replace(',', '.')) || 0;
      return acc + q * c;
    }, 0);
  }, [rows]);

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.company?.id) return;

    const validRows = rows.filter(r => r.itemId && (parseFloat(r.quantity.replace(',', '.')) || 0) > 0);

    if (validRows.length === 0) {
      setErrorMsg('Adicione pelo menos um item válido com quantidade maior que zero.');
      return;
    }

    if ((movementType === 'saida_obra' || movementType === 'devolucao') && !selectedWorkId) {
      setErrorMsg('Selecione a obra de destino ou origem.');
      return;
    }

    if (movementType === 'saida_epi' && !selectedRecipientId) {
      setErrorMsg('Para entrega de EPI (Cautela NR-06), selecione o colaborador nominalmente.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');
      const companyId = user.company.id;

      for (const row of validRows) {
        const qtyNum = parseFloat(row.quantity.replace(',', '.'));
        const inputCost = parseFloat(row.unitCost.replace(',', '.')) || 0;

        const { data: freshItem, error: fetchErr } = await supabase
          .from('inventory_items')
          .select('current_stock, unit_cost, sizes_stock, requires_size')
          .eq('id', row.itemId)
          .single();

        if (fetchErr || !freshItem) throw new Error('Não foi possível verificar o estoque do item.');

        const prevStock = Number(freshItem.current_stock) || 0;
        let newStock = prevStock;
        let newUnitCost = inputCost;
        let updatedSizesStock = freshItem.sizes_stock && typeof freshItem.sizes_stock === 'object' ? { ...freshItem.sizes_stock } : {};

        if (isIncoming) {
          newStock = prevStock + qtyNum;
          if (row.requiresSize && row.size) {
            const currentSizeQty = Number(updatedSizesStock[row.size]) || 0;
            updatedSizesStock[row.size] = currentSizeQty + qtyNum;
          }
          if (movementType === 'entrada_compra' && inputCost > 0) {
            const prevTotal = Math.max(0, prevStock) * (Number(freshItem.unit_cost) || 0);
            const newTotal = qtyNum * inputCost;
            newUnitCost = Math.round(((prevTotal + newTotal) / newStock) * 100) / 100;
          }
        } else {
          newStock = Math.max(0, prevStock - qtyNum);
          if (row.requiresSize && row.size) {
            const currentSizeQty = Number(updatedSizesStock[row.size]) || 0;
            updatedSizesStock[row.size] = Math.max(0, currentSizeQty - qtyNum);
          }
        }

        // 1. Atualiza estoque físico e grade interna
        const { error: updErr } = await supabase
          .from('inventory_items')
          .update({
            current_stock: newStock,
            unit_cost: newUnitCost,
            sizes_stock: row.requiresSize ? updatedSizesStock : freshItem.sizes_stock,
            updated_at: new Date().toISOString()
          })
          .eq('id', row.itemId);

        if (updErr) throw updErr;

        // Monta texto de observações se for cautela
        let finalNotes = notes.trim();
        if (isEpiCautela) {
          const reasonLabel =
            epiReason === 'admissao'
              ? 'Admissão (Kit Inicial)'
              : epiReason === 'troca_periodica'
              ? 'Troca Periódica'
              : epiReason === 'danificado'
              ? 'Substituição por Dano'
              : 'Extravio';
          finalNotes = `Motivo: ${reasonLabel}${row.condition ? ` • Estado: ${row.condition}` : ''}${finalNotes ? ` • ${finalNotes}` : ''}`;
        }

        // 2. Grava histórico na tabela unificada de movimentações
        const { error: movErr } = await supabase.from('inventory_movements').insert({
          company_id: companyId,
          item_id: row.itemId,
          movement_type: movementType,
          quantity: qtyNum,
          size: row.requiresSize ? row.size || null : null,
          previous_stock: prevStock,
          new_stock: newStock,
          unit_cost: inputCost,
          work_id: selectedWorkId || null,
          recipient_profile_id: selectedRecipientId || null,
          supplier_contact_id: selectedSupplierId || null,
          document_number: hasDocument ? documentNumber.trim() || null : null,
          notes: finalNotes || null,
          created_by: user.id
        });

        if (movErr) throw movErr;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg('Erro ao registrar movimentação: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl max-w-4xl w-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 max-h-[92vh]">
        {/* TOPO */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Movimentação de Almoxarifado
            </h2>
            <p className="text-xs text-slate-500">
              Saídas para obras, cautela nominal de EPIs (NR-06) e entradas de compras com NF.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* CORPO */}
        <form onSubmit={handleSaveMovement} className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. SELETOR DE OPERAÇÃO */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Tipo de Movimentação *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setMovementType('saida_obra')}
                className={`py-2 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  movementType === 'saida_obra'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ArrowUpRight size={14} />
                <span>Saída p/ Obra</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType('saida_epi')}
                className={`py-2 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  movementType === 'saida_epi'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ShieldCheck size={14} />
                <span>Cautela de EPI</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType('entrada_compra')}
                className={`py-2 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  movementType === 'entrada_compra'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ArrowDownLeft size={14} />
                <span>Entrada / NF</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType('devolucao')}
                className={`py-2 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  movementType === 'devolucao'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <RotateCcw size={14} />
                <span>Devolução</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType('descarte')}
                className={`py-2 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer col-span-2 sm:col-span-1 ${
                  movementType === 'descarte'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Trash2 size={14} />
                <span>Baixa / Descarte</span>
              </button>
            </div>
          </div>

          {/* 2. CAMPOS CONDICIONAIS DE DESTINO E RESPONSÁVEL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Campo Colaborador (Obrigatório se for Cautela de EPI) */}
            {movementType !== 'entrada_compra' && (
              <div className="relative" ref={profileRef}>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <User size={13} className={isEpiCautela ? 'text-sky-600' : 'text-slate-500'} />
                  <span>
                    {isEpiCautela ? 'Colaborador (Destinatário da Cautela) *' : 'Responsável pela Retirada'}
                  </span>
                </label>

                <div
                  className={`relative flex items-center bg-slate-50 border rounded-xl transition-all ${
                    isProfileMenuOpen ? 'border-sky-500 ring-2 ring-sky-500/10 bg-white' : 'border-slate-200'
                  }`}
                >
                  <Search size={14} className="ml-3 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Pesquise o colaborador..."
                    value={profileSearchText}
                    onFocus={() => setIsProfileMenuOpen(true)}
                    onChange={e => {
                      setProfileSearchText(e.target.value);
                      setIsProfileMenuOpen(true);
                      if (selectedRecipientId) setSelectedRecipientId('');
                    }}
                    className="w-full pl-2 pr-7 py-2 text-xs sm:text-sm text-slate-800 font-medium bg-transparent focus:outline-none"
                  />
                  {profileSearchText && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileSearchText('');
                        setSelectedRecipientId('');
                      }}
                      className="absolute right-7 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X size={13} />
                    </button>
                  )}
                  <ChevronDown
                    size={15}
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="mr-2.5 text-slate-400 cursor-pointer"
                  />
                </div>

                {isProfileMenuOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-1.5 max-h-48 overflow-y-auto">
                    {!isEpiCautela && (
                      <div
                        onClick={() => {
                          setSelectedRecipientId('');
                          setProfileSearchText('');
                          setIsProfileMenuOpen(false);
                        }}
                        className="p-2 rounded-xl text-xs hover:bg-slate-50 text-slate-500 cursor-pointer"
                      >
                        Não atribuído
                      </div>
                    )}
                    {filteredProfiles.map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedRecipientId(p.id);
                          setProfileSearchText(p.full_name);
                          setIsProfileMenuOpen(false);
                        }}
                        className={`p-2 rounded-xl text-xs cursor-pointer transition flex items-center gap-2 ${
                          p.id === selectedRecipientId
                            ? 'bg-sky-50 text-sky-900 font-bold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-[10px] uppercase">
                            {p.full_name.charAt(0)}
                          </div>
                        )}
                        <span>{p.full_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Campo Obra */}
            {(movementType === 'saida_obra' || movementType === 'devolucao' || movementType === 'saida_epi') && (
              <div className="relative" ref={workRef}>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <HardHat size={13} className="text-sky-600" />
                  <span>
                    {movementType === 'devolucao'
                      ? 'Obra de Origem *'
                      : isEpiCautela
                      ? 'Obra de Destino (Opcional)'
                      : 'Obra de Destino *'}
                  </span>
                </label>

                <div
                  className={`relative flex items-center bg-slate-50 border rounded-xl transition-all ${
                    isWorkMenuOpen ? 'border-sky-500 ring-2 ring-sky-500/10 bg-white' : 'border-slate-200'
                  }`}
                >
                  <Search size={14} className="ml-3 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Pesquise a obra..."
                    value={workSearchText}
                    onFocus={() => setIsWorkMenuOpen(true)}
                    onChange={e => {
                      setWorkSearchText(e.target.value);
                      setIsWorkMenuOpen(true);
                      if (selectedWorkId) setSelectedWorkId('');
                    }}
                    className="w-full pl-2 pr-7 py-2 text-xs sm:text-sm text-slate-800 font-medium bg-transparent focus:outline-none"
                  />
                  {workSearchText && (
                    <button
                      type="button"
                      onClick={() => {
                        setWorkSearchText('');
                        setSelectedWorkId('');
                      }}
                      className="absolute right-7 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X size={13} />
                    </button>
                  )}
                  <ChevronDown
                    size={15}
                    onClick={() => setIsWorkMenuOpen(!isWorkMenuOpen)}
                    className="mr-2.5 text-slate-400 cursor-pointer"
                  />
                </div>

                {isWorkMenuOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-1.5 max-h-48 overflow-y-auto">
                    {isEpiCautela && (
                      <div
                        onClick={() => {
                          setSelectedWorkId('');
                          setWorkSearchText('');
                          setIsWorkMenuOpen(false);
                        }}
                        className="p-2 rounded-xl text-xs hover:bg-slate-50 text-slate-500 cursor-pointer"
                      >
                        Uso Geral / Sem Obra Fixa
                      </div>
                    )}
                    {filteredWorks.map(w => (
                      <div
                        key={w.id}
                        onClick={() => {
                          setSelectedWorkId(w.id);
                          setWorkSearchText(`${w.code ? `[${w.code}] ` : ''}${w.title}`);
                          setIsWorkMenuOpen(false);
                        }}
                        className={`p-2 rounded-xl text-xs cursor-pointer transition flex items-center justify-between ${
                          w.id === selectedWorkId
                            ? 'bg-sky-50 text-sky-900 font-bold'
                            : 'hover:bg-slate-50 text-slate-700 font-medium'
                        }`}
                      >
                        <span>{w.code ? `[${w.code}] ` : ''}{w.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Campo Motivo (Apenas se for Cautela de EPI) */}
            {isEpiCautela && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Motivo da Entrega de EPI *
                </label>
                <select
                  value={epiReason}
                  onChange={e => setEpiReason(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-sky-500"
                >
                  <option value="admissao">Admissão (Kit Inicial)</option>
                  <option value="troca_periodica">Troca Periódica (Desgaste Natural)</option>
                  <option value="danificado">Substituição por Dano / Avaria</option>
                  <option value="extraviado">Extravio / Perda</option>
                </select>
              </div>
            )}

            {/* Campo Fornecedor (Entrada / Compra) */}
            {movementType === 'entrada_compra' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Building2 size={13} className="text-emerald-600" />
                  <span>Fornecedor (Contato)</span>
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={e => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  <option value="">Selecione o fornecedor (opcional)...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.display_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 3. TABELA DE ITENS COM GRADE E VISIBILIDADE LIVRE */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs">
            <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center">
                  <Layers size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">
                    {isEpiCautela ? `EPIs da Ficha de Cautela (${rows.length})` : `Itens da Remessa (${rows.length})`}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {isEpiCautela
                      ? 'Selecione os equipamentos que entrarão na folha de assinatura do colaborador.'
                      : 'Monte a lista selecionando itens e numerações específicas.'}
                  </p>
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
              <span className={isEpiCautela ? 'col-span-4' : 'col-span-4'}>Descrição do Item</span>
              <span className="col-span-2 text-center">Tam. / Grade</span>
              <span className="col-span-2 text-center">Saldo Disponível</span>
              <span className="col-span-1 text-center">Qtd.</span>
              <span className="col-span-1 text-right">{isEpiCautela ? 'Estado' : 'Preço Unit.'}</span>
              <span className="col-span-1 text-center"></span>
            </div>

            {/* Linhas Editáveis */}
            <div className="divide-y divide-slate-100">
              {rows.map((row, idx) => {
                const rowFilteredItems = allItems.filter(
                  i =>
                    !row.searchText ||
                    i.name.toLowerCase().includes(row.searchText.toLowerCase().trim()) ||
                    (i.code && i.code.toLowerCase().includes(row.searchText.toLowerCase().trim())) ||
                    (i.ca_number && i.ca_number.includes(row.searchText.trim()))
                );

                const currentSizeStock = row.requiresSize && row.size ? (row.sizesStock[row.size] ?? 0) : row.currentStock;

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
                    <div className="col-span-4 relative item-search-container">
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
                              isMenuOpen: true,
                              itemId: '',
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
                                itemId: '',
                                itemName: '',
                                size: '',
                                requiresSize: false,
                                availableSizes: [],
                                sizesStock: {},
                                unit: 'un',
                                currentStock: 0,
                                isMenuOpen: false
                              });
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      {/* Dropdown de Sugestões com z-index alto */}
                      {row.isMenuOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-1.5 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                          {rowFilteredItems.length === 0 ? (
                            <div className="p-2.5 text-center text-[11px] text-slate-400 italic">
                              Nenhum item encontrado.
                            </div>
                          ) : (
                            rowFilteredItems.map(it => (
                              <div
                                key={it.id}
                                onClick={() => handleSelectItemInRow(row.id, it)}
                                className="p-2 rounded-xl text-xs cursor-pointer hover:bg-slate-50 flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-semibold text-slate-800 block">{it.name}</span>
                                  <span className="text-[10px] text-slate-400">
                                    {it.item_type === 'epi' ? `CA: ${it.ca_number || 'Sem CA'}` : `Categoria: ${it.category}`}
                                    {it.requires_size ? ' • Com Grade' : ''}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                                  Saldo: {it.current_stock} {it.unit}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Tamanho (Dropdown da grade se houver) */}
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
                        <span className="text-center block text-[11px] text-slate-400 italic">
                          Único / Sem grade
                        </span>
                      )}
                    </div>

                    {/* Saldo Disponível Específico */}
                    <div className="col-span-2 text-center">
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg text-[10px] block truncate">
                        {currentSizeStock} {row.unit}
                      </span>
                    </div>

                    {/* Quantidade */}
                    <div className="col-span-1">
                      <input
                        type="text"
                        value={row.quantity}
                        onChange={e => handleUpdateRow(row.id, { quantity: e.target.value })}
                        className="w-full px-1.5 py-1.5 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-900 text-center text-xs focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    {/* Preço Unitário ou Estado de Conservação */}
                    <div className="col-span-1">
                      {isEpiCautela ? (
                        <select
                          value={row.condition}
                          onChange={e => handleUpdateRow(row.id, { condition: e.target.value })}
                          className="w-full px-1 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-sky-500"
                        >
                          <option value="novo">Novo</option>
                          <option value="semi-novo">Seminovo</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          disabled={!isIncoming}
                          value={row.unitCost}
                          onChange={e => handleUpdateRow(row.id, { unitCost: e.target.value })}
                          className={`w-full px-1.5 py-1.5 border rounded-xl font-mono font-bold text-right text-xs ${
                            isIncoming
                              ? 'bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-sky-500'
                              : 'bg-slate-50 border-slate-200/80 text-slate-400'
                          }`}
                        />
                      )}
                    </div>

                    {/* Botão Remover Linha */}
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

            {/* Rodapé da Grade com Subtotal */}
            <div className="p-3 bg-slate-50/80 border-t border-slate-200 rounded-b-2xl flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">
                Linhas ativas: <strong className="text-slate-800">{rows.length}</strong>
              </span>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  {isEpiCautela ? 'Total de Peças Entregues' : 'Valor Total Estimado'}
                </span>
                <strong className="text-sm font-black font-mono text-slate-900">
                  {isEpiCautela
                    ? `${rows.reduce((acc, r) => acc + (parseFloat(r.quantity.replace(',', '.')) || 0), 0)} un`
                    : formatCurrency(totalBatchCost)}
                </strong>
              </div>
            </div>
          </div>

          {/* 4. NOTA FISCAL / ROMANEIO */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 select-none">
              <input
                type="checkbox"
                checked={hasDocument}
                onChange={e => setHasDocument(e.target.checked)}
                className="accent-sky-600 rounded w-4 h-4 cursor-pointer"
              />
              <span>Vincular Nota Fiscal / Romaneio / Guia de Remessa</span>
            </label>

            {hasDocument && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl animate-in fade-in duration-150">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Nº do Documento / NF-e
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Ex: NF-44210 ou ROM-01"
                  value={documentNumber}
                  onChange={e => setDocumentNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono uppercase text-xs text-slate-900"
                />
              </div>
            )}
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Observações Gerais
            </label>
            <input
              type="text"
              placeholder={
                isEpiCautela
                  ? 'Ex: Entregue completo com termo de responsabilidade assinado...'
                  : 'Ex: Enviado junto com a equipe de montagem...'
              }
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* RODAPÉ */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-500 font-medium">
              Itens preenchidos: <strong className="text-slate-900">{rows.filter(r => r.itemId).length}</strong>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white rounded-xl shadow-2xs disabled:opacity-50 transition-all cursor-pointer active:scale-98 ${
                  isIncoming
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : isEpiCautela
                    ? 'bg-sky-600 hover:bg-sky-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>
                  {isEpiCautela ? 'Concluir Cautela de EPI' : 'Confirmar Movimentação'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryMovementModal;