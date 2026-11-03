import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  Send,
  Loader2,
  HardHat,
  Search,
  ChevronDown,
  Plus,
  Trash2,
  Layers,
  AlertCircle,
  PackageOpen,
  Clock,
  CheckCircle2,
  User
} from 'lucide-react';

interface RequestMaterialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface WorkOption {
  id: string;
  title: string;
  code?: string | null;
}

interface ProfileOption {
  id: string;
  full_name: string;
}

interface CatalogItemOption {
  id: string;
  name: string;
  item_type: string;
  unit: string;
  requires_size?: boolean;
  sizes_stock?: Record<string, number> | null;
}

interface RequestRowItem {
  id: string;
  itemId: string;
  itemName: string;
  unit: string;
  requiresSize: boolean;
  availableSizes: string[];
  size: string;
  quantity: string;
  searchText: string;
  isMenuOpen: boolean;
}

export const RequestMaterialsModal: React.FC<RequestMaterialsModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successSent, setSuccessSent] = useState(false);

  // Parâmetros da Solicitação
  const [selectedWorkId, setSelectedWorkId] = useState('');
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState('');
  const [urgency, setUrgency] = useState<'normal' | 'urgente' | 'baixa'>('normal');
  const [notes, setNotes] = useState('');

  // Autocomplete Obra
  const [works, setWorks] = useState<WorkOption[]>([]);
  const [workSearchText, setWorkSearchText] = useState('');
  const [isWorkMenuOpen, setIsWorkMenuOpen] = useState(false);
  const workRef = useRef<HTMLDivElement>(null);

  // Autocomplete Colaborador
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [profileSearchText, setProfileSearchText] = useState('');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Catálogo do Almoxarifado
  const [catalogItems, setCatalogItems] = useState<CatalogItemOption[]>([]);

  // Linhas da Solicitação
  const createInitialRow = (): RequestRowItem => ({
    id: crypto.randomUUID(),
    itemId: '',
    itemName: '',
    unit: 'un',
    requiresSize: false,
    availableSizes: [],
    size: '',
    quantity: '1',
    searchText: '',
    isMenuOpen: false
  });

  const [rows, setRows] = useState<RequestRowItem[]>([createInitialRow()]);

  // Fechar menus ao clicar fora
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (workRef.current && !workRef.current.contains(e.target as Node)) {
        setIsWorkMenuOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      const target = e.target as HTMLElement;
      if (!target.closest('.request-search-container')) {
        setRows(prev => prev.map(r => (r.isMenuOpen ? { ...r, isMenuOpen: false } : r)));
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Carrega Obras, Colaboradores e Catálogo com fallback de Company
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        let currentUserId = user?.id;
        if (!currentUserId) {
          const { data: authData } = await supabase.auth.getUser();
          currentUserId = authData.user?.id;
        }

        if (!currentUserId) return;

        // Procura a empresa
        let companyId = user?.company?.id || (user as any)?.company_id || user?.profile?.company_id;

        if (!companyId) {
          const { data: mem } = await supabase
            .from('memberships')
            .select('company_id')
            .eq('profile_id', currentUserId)
            .limit(1)
            .maybeSingle();
          companyId = mem?.company_id;
        }

        if (!companyId) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', currentUserId)
            .maybeSingle();
          companyId = prof?.company_id;
        }

        if (!companyId) return;

        const [wRes, pRes, iRes] = await Promise.all([
          supabase
            .from('works')
            .select('id, title, code')
            .eq('company_id', companyId)
            .neq('status', 'cancelada')
            .order('title', { ascending: true }),
          supabase
            .from('profiles')
            .select('id, full_name')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('full_name', { ascending: true }),
          supabase
            .from('inventory_items')
            .select('id, name, item_type, unit, requires_size, sizes_stock')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('name', { ascending: true })
        ]);

        setWorks(wRes.data || []);
        setProfiles(pRes.data || []);
        setCatalogItems(iRes.data || []);

        // Define o usuário atual como beneficiário padrão
        const myProfile = (pRes.data || []).find((p: any) => p.id === currentUserId);
        if (myProfile) {
          setSelectedBeneficiaryId(myProfile.id);
          setProfileSearchText(myProfile.full_name);
        }
      } catch (err) {
        console.warn('Erro ao carregar dados do modal de solicitação:', err);
      }
    };

    loadData();
  }, [isOpen, user]);

  // Reset ao abrir
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessSent(false);
      setSelectedWorkId('');
      setWorkSearchText('');
      setUrgency('normal');
      setNotes('');
      setRows([createInitialRow()]);
    }
  }, [isOpen]);

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

  const handleAddRow = () => {
    setRows(prev => [...prev, createInitialRow()]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length === 1) {
      setRows([createInitialRow()]);
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateRow = (id: string, fields: Partial<RequestRowItem>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...fields } : r)));
  };

  const handleSelectItem = (rowId: string, item: CatalogItemOption) => {
    const reqSize = Boolean(item.requires_size);
    const sStock = item.sizes_stock && typeof item.sizes_stock === 'object' ? item.sizes_stock : {};
    const sizeKeys = Object.keys(sStock);

    handleUpdateRow(rowId, {
      itemId: item.id,
      itemName: item.name,
      unit: item.unit || 'un',
      requiresSize: reqSize,
      availableSizes: sizeKeys,
      size: sizeKeys.length > 0 ? sizeKeys[0] : '',
      searchText: item.name,
      isMenuOpen: false
    });
  };

  const totalItemsCount = useMemo(() => {
    return rows.reduce((acc, r) => acc + (parseFloat(r.quantity.replace(',', '.')) || 0), 0);
  }, [rows]);

  const handleSubmitRequest = async () => {
    try {
      setSaving(true);
      setErrorMsg('');

      // 1. Obtém o ID do usuário de forma garantida
      let currentUserId = user?.id;
      if (!currentUserId) {
        const { data: authData } = await supabase.auth.getUser();
        currentUserId = authData.user?.id;
      }

      if (!currentUserId) {
        throw new Error('Usuário não autenticado. Por favor, faça login novamente.');
      }

      // 2. Obtém o ID da Empresa de forma garantida
      let companyId = user?.company?.id || (user as any)?.company_id || user?.profile?.company_id;

      if (!companyId) {
        const { data: mem } = await supabase
          .from('memberships')
          .select('company_id')
          .eq('profile_id', currentUserId)
          .limit(1)
          .maybeSingle();
        companyId = mem?.company_id;
      }

      if (!companyId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', currentUserId)
          .maybeSingle();
        companyId = prof?.company_id;
      }

      if (!companyId) {
        throw new Error('Empresa não identificada no seu cadastro.');
      }

      // 3. Valida os itens
      const validRows = rows.filter(
        r => r.itemName.trim() && (parseFloat(r.quantity.replace(',', '.')) || 0) > 0
      );

      if (validRows.length === 0) {
        throw new Error('Adicione ao menos um item preenchido com quantidade válida.');
      }

      const itemsPayload = validRows.map(r => ({
        item_id: r.itemId || null,
        item_name: r.itemName.trim(),
        unit: r.unit || 'un',
        size: r.requiresSize ? r.size || null : (r.size ? r.size.trim().toUpperCase() : null),
        quantity: parseFloat(r.quantity.replace(',', '.')) || 1
      }));

      // 4. Grava a solicitação
      const { error: insertError } = await supabase.from('material_requests').insert({
        company_id: companyId,
        requester_profile_id: currentUserId,
        beneficiary_profile_id: selectedBeneficiaryId || currentUserId,
        work_id: selectedWorkId || null,
        urgency,
        status: 'pendente',
        notes: notes.trim() || null,
        items: itemsPayload
      });

      if (insertError) throw insertError;

      setSuccessSent(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Erro ao registrar solicitação:', err);
      setErrorMsg(err.message || 'Erro ao registrar solicitação.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 max-h-[92vh]">
        
        {/* TOPO */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
              <PackageOpen size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Nova Solicitação
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* FEEDBACK DE SUCESSO */}
        {successSent ? (
          <div className="p-12 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 size={30} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Solicitação Enviada com Sucesso!</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              O pedido foi enviado para a fila do almoxarifado.
            </p>
          </div>
        ) : (
          /* CORPO */
          <div className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* DESTINATÁRIO (COLABORADOR) & OBRA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Colaborador Beneficiário */}
              <div className="relative" ref={profileRef}>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <User size={13} className="text-sky-600" />
                  <span>Destinado a qual Colaborador? *</span>
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
                      if (selectedBeneficiaryId) setSelectedBeneficiaryId('');
                    }}
                    className="w-full pl-2 pr-7 py-2 text-xs sm:text-sm text-slate-800 font-medium bg-transparent focus:outline-none"
                  />
                  <ChevronDown
                    size={15}
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="mr-2.5 text-slate-400 cursor-pointer"
                  />
                </div>

                {isProfileMenuOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-1.5 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                    {profiles.map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedBeneficiaryId(p.id);
                          setProfileSearchText(p.full_name);
                          setIsProfileMenuOpen(false);
                        }}
                        className={`p-2 rounded-xl text-xs cursor-pointer transition flex items-center justify-between ${
                          p.id === selectedBeneficiaryId
                            ? 'bg-sky-50 text-sky-900 font-bold'
                            : 'hover:bg-slate-50 text-slate-700 font-medium'
                        }`}
                      >
                        <span>{p.full_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Obra de Destino */}
              <div className="relative" ref={workRef}>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <HardHat size={13} className="text-slate-400" />
                  <span>Obra de Destino (Opcional)</span>
                </label>

                <div
                  className={`relative flex items-center bg-slate-50 border rounded-xl transition-all ${
                    isWorkMenuOpen ? 'border-sky-500 ring-2 ring-sky-500/10 bg-white' : 'border-slate-200'
                  }`}
                >
                  <Search size={14} className="ml-3 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Selecione a obra se houver..."
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
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-1.5 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                    <div
                      onClick={() => {
                        setSelectedWorkId('');
                        setWorkSearchText('');
                        setIsWorkMenuOpen(false);
                      }}
                      className="p-2 rounded-xl text-xs hover:bg-slate-50 text-slate-500 cursor-pointer"
                    >
                      Nenhuma obra (Uso Geral)
                    </div>
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
            </div>

            {/* GRAU DE URGÊNCIA */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Clock size={13} className="text-slate-400" />
                <span>Prioridade / Urgência do Pedido</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-200 max-w-sm">
                <button
                  type="button"
                  onClick={() => setUrgency('baixa')}
                  className={`py-1.5 rounded-lg font-bold transition text-xs cursor-pointer ${
                    urgency === 'baixa' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Baixa
                </button>
                <button
                  type="button"
                  onClick={() => setUrgency('normal')}
                  className={`py-1.5 rounded-lg font-bold transition text-xs cursor-pointer ${
                    urgency === 'normal' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setUrgency('urgente')}
                  className={`py-1.5 rounded-lg font-bold transition text-xs cursor-pointer ${
                    urgency === 'urgente' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Urgente
                </button>
              </div>
            </div>

            {/* TABELA DE ITENS DA SOLICITAÇÃO */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs">
              <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center">
                    <Layers size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Itens Solicitados</h4>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer active:scale-98 transition"
                >
                  <Plus size={13} />
                  <span>Adicionar</span>
                </button>
              </div>

              {/* Cabeçalho */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider items-center">
                <span className="col-span-1 text-center">#</span>
                <span className="col-span-6">Descrição do Item / EPI</span>
                <span className="col-span-2 text-center">Tam.</span>
                <span className="col-span-2 text-center">Quantidade</span>
                <span className="col-span-1 text-center"></span>
              </div>

              {/* Linhas */}
              <div className="divide-y divide-slate-100">
                {rows.map((row, idx) => {
                  const filteredCatalog = catalogItems.filter(
                    i => !row.searchText || i.name.toLowerCase().includes(row.searchText.toLowerCase().trim())
                  );

                  return (
                    <div
                      key={row.id}
                      className={`grid grid-cols-12 gap-2 px-3 py-2 items-center hover:bg-slate-50/60 transition text-xs ${
                        row.isMenuOpen ? 'relative z-30' : 'relative z-0'
                      }`}
                    >
                      <span className="col-span-1 text-center font-bold text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </span>

                      {/* Autocomplete / Input Livre */}
                      <div className="col-span-6 relative request-search-container">
                        <div className="relative flex items-center bg-white border border-slate-200 rounded-xl focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/10">
                          <input
                            type="text"
                            placeholder="Buscar no catálogo ou digitar livre..."
                            value={row.searchText}
                            onFocus={() => {
                              setRows(prev => prev.map(r => ({ ...r, isMenuOpen: r.id === row.id })));
                            }}
                            onChange={e => {
                              handleUpdateRow(row.id, {
                                searchText: e.target.value,
                                itemName: e.target.value,
                                isMenuOpen: true,
                                itemId: '',
                                requiresSize: false,
                                availableSizes: [],
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
                                  itemName: '',
                                  itemId: '',
                                  size: '',
                                  requiresSize: false,
                                  availableSizes: [],
                                  isMenuOpen: false
                                });
                              }}
                              className="p-1 text-slate-400 hover:text-slate-600"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>

                        {/* Dropdown de Itens */}
                        {row.isMenuOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-1.5 max-h-52 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                            {filteredCatalog.length === 0 ? (
                              <div className="p-2.5 text-center text-[11px] text-slate-400 italic">
                                Item avulso. Preencha a quantidade ao lado.
                              </div>
                            ) : (
                              filteredCatalog.map(it => (
                                <div
                                  key={it.id}
                                  onClick={() => handleSelectItem(row.id, it)}
                                  className="p-2 rounded-xl text-xs cursor-pointer hover:bg-slate-50 flex items-center justify-between"
                                >
                                  <div>
                                    <span className="font-semibold text-slate-800 block">{it.name}</span>
                                    <span className="text-[10px] text-slate-400 capitalize">
                                      {it.item_type} {it.requires_size ? '• Com Grade' : ''}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                                    {it.unit}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Tamanho */}
                      <div className="col-span-2">
                        {row.requiresSize ? (
                          <select
                            value={row.size}
                            onChange={e => handleUpdateRow(row.id, { size: e.target.value })}
                            className="w-full px-1.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer focus:ring-2 focus:ring-sky-500"
                          >
                            {row.availableSizes.map(s => (
                              <option key={s} value={s}>
                                Tam. {s}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder="Tam."
                            value={row.size}
                            onChange={e => handleUpdateRow(row.id, { size: e.target.value.toUpperCase() })}
                            className="w-full px-1 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-center text-xs text-slate-800 uppercase focus:ring-2 focus:ring-sky-500 font-bold"
                          />
                        )}
                      </div>

                      {/* Quantidade */}
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={row.quantity}
                          onChange={e => handleUpdateRow(row.id, { quantity: e.target.value })}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-900 text-center text-xs focus:ring-2 focus:ring-sky-500"
                        />
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

              {/* Rodapé da Grade */}
              <div className="p-2.5 bg-slate-50 border-t border-slate-200 rounded-b-2xl flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium text-[11px]">
                  Linhas ativas: <strong className="text-slate-800">{rows.length}</strong>
                </span>
                <span className="font-bold text-slate-700">
                  Total de Itens: <strong className="font-mono text-sky-800 text-sm">{totalItemsCount}</strong>
                </span>
              </div>
            </div>

            {/* Observações / Justificativa */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Justificativa / Observações
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Botina rasgada no canteiro / Troca periódica..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              />
            </div>

            {/* RODAPÉ DO FORMULÁRIO */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSubmitRequest}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-2xs disabled:opacity-50 transition-all cursor-pointer active:scale-98"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>Enviar Solicitação ({totalItemsCount})</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestMaterialsModal;