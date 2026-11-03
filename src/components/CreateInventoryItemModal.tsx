import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  Save,
  Loader2,
  ShieldCheck,
  Package,
  Wrench,
  Shirt,
  Box,
  Tag,
  Plus,
  Trash2,
  Layers
} from 'lucide-react';
import type { InventoryItem } from './InventoryView';

interface CreateInventoryItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  itemToEdit?: any | null;
}

type ItemType = 'epi' | 'material' | 'ferramenta' | 'uniforme' | 'consumivel';

interface SizeRow {
  id: string;
  size: string;
  qty: string;
}

const CATEGORIES_BY_TYPE: Record<ItemType, { value: string; label: string }[]> = {
  epi: [
    { value: 'ocular', label: 'Proteção Ocular (Óculos, Viseiras)' },
    { value: 'auditivo', label: 'Proteção Auditiva (Protetores, Abafadores)' },
    { value: 'cabeca', label: 'Proteção da Cabeça (Capacetes, Toucas)' },
    { value: 'respiratorio', label: 'Proteção Respiratória (Máscaras, Respiradores)' },
    { value: 'pes', label: 'Proteção dos Pés (Botinas, Sapatos de Segurança)' },
    { value: 'maos', label: 'Proteção das Mãos (Luvas de Vaqueta, Nitrílicas, Pigmentadas)' },
    { value: 'altura', label: 'Trabalho em Altura (Cintos, Talabartes, Trava-quedas)' },
    { value: 'outros', label: 'Outros EPIs' }
  ],
  material: [
    { value: 'eletrica', label: 'Elétrica (Cabos, Disjuntores, Conduítes)' },
    { value: 'estrutural', label: 'Estrutural / Civil (Perfis, Trilhos, Suportes)' },
    { value: 'fixacao', label: 'Fixação (Parafusos, Buchas, Abraçadeiras, Porcas)' },
    { value: 'hidraulica', label: 'Hidráulica (Tubos, Conexões, Válvulas)' },
    { value: 'solar', label: 'Fotovoltaico (Módulos, Inversores, Stringboxes)' },
    { value: 'outros', label: 'Outros Materiais' }
  ],
  ferramenta: [
    { value: 'eletrica_bancada', label: 'Elétrica / Bateria (Parafusadeiras, Marteletes, Lixadeiras)' },
    { value: 'manual', label: 'Manual (Alicates, Chaves, Martelos, Trenas)' },
    { value: 'medicao', label: 'Medição & Teste (Multímetros, Terrômetros, Alicates Amperímetro)' },
    { value: 'acesso_elevacao', label: 'Acesso e Carga (Escadas, Andaimes, Carrinhos)' },
    { value: 'outros', label: 'Outras Ferramentas' }
  ],
  uniforme: [
    { value: 'camisa_camiseta', label: 'Camisas e Camisetas (Manga Curta / Longa)' },
    { value: 'calca_bermuda', label: 'Calças Operacionais / Brim' },
    { value: 'inverno_jaqueta', label: 'Jaquetas, Capas de Chuva e Agasalhos' },
    { value: 'chapeu_bone', label: 'Bonés e Chapéus com Proteção Solar' },
    { value: 'outros', label: 'Outros Fardamentos' }
  ],
  consumivel: [
    { value: 'corte_desbaste', label: 'Corte e Desbaste (Discos, Lixas, Serras Copo)' },
    { value: 'perfuracao', label: 'Perfuração (Brocas de Concreto, Aço, Madeira)' },
    { value: 'vedacao_quimicos', label: 'Vedação & Químicos (Fita Isolante, Silicone, PU, Graxas)' },
    { value: 'solda_fixacao', label: 'Solda & Eletrodos (Eletrodos, Estanho)' },
    { value: 'outros', label: 'Outros Consumíveis' }
  ]
};

const DEFAULT_FOOTWEAR_SIZES = ['38', '39', '40', '41', '42', '43', '44'];
const DEFAULT_CLOTHING_SIZES = ['P', 'M', 'G', 'GG', 'XG'];

export const CreateInventoryItemModal: React.FC<CreateInventoryItemModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  itemToEdit
}) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const [itemType, setItemType] = useState<ItemType>('epi');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('un');
  const [currentStock, setCurrentStock] = useState('0');
  const [minStock, setMinStock] = useState('5');
  const [unitCost, setUnitCost] = useState('0');

  // Grade de Tamanhos em Formato de Linhas/Lista
  const [requiresSize, setRequiresSize] = useState(false);
  const [sizeRows, setSizeRows] = useState<SizeRow[]>([]);

  // EPI
  const [caNumber, setCaNumber] = useState('');
  const [caExpiryDate, setCaExpiryDate] = useState('');
  const [lifespanDays, setLifespanDays] = useState('180');

  // Ferramenta
  const [brand, setBrand] = useState('');
  const [serialNumber, setSerialNumber] = useState('');

  // Se marcar grade, atualiza automaticamente o saldo total
  useEffect(() => {
    if (requiresSize) {
      const sum = sizeRows.reduce((acc, row) => {
        const q = parseInt(row.qty, 10) || 0;
        return acc + q;
      }, 0);
      setCurrentStock(String(sum));
    }
  }, [sizeRows, requiresSize]);

  const handleSelectType = (newType: ItemType) => {
    setItemType(newType);
    const availableCategories = CATEGORIES_BY_TYPE[newType];
    if (availableCategories && availableCategories.length > 0) {
      setCategory(availableCategories[0].value);
    }
    if (newType === 'epi') {
      setUnit('un');
      setRequiresSize(false);
      setSizeRows([]);
    } else if (newType === 'uniforme') {
      setUnit('un');
      setRequiresSize(true);
      setSizeRows(DEFAULT_CLOTHING_SIZES.map(s => ({ id: crypto.randomUUID(), size: s, qty: '0' })));
    }
  };

  const handleToggleRequiresSize = (checked: boolean) => {
    setRequiresSize(checked);
    if (checked && sizeRows.length === 0) {
      const presets = category === 'pes' ? DEFAULT_FOOTWEAR_SIZES : DEFAULT_CLOTHING_SIZES;
      setSizeRows(presets.map(s => ({ id: crypto.randomUUID(), size: s, qty: '0' })));
    }
  };

  const handleAddSizeRow = (presetSize: string = '') => {
    setSizeRows(prev => [...prev, { id: crypto.randomUUID(), size: presetSize, qty: '0' }]);
  };

  const handleRemoveSizeRow = (id: string) => {
    setSizeRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateSizeRow = (id: string, field: 'size' | 'qty', val: string) => {
    setSizeRows(prev =>
      prev.map(r => (r.id === id ? { ...r, [field]: field === 'size' ? val.toUpperCase() : val } : r))
    );
  };

  const handleLoadPreset = (presets: string[]) => {
    setSizeRows(presets.map(s => ({ id: crypto.randomUUID(), size: s, qty: '0' })));
  };

  useEffect(() => {
    if (itemToEdit) {
      const currentType = (itemToEdit.item_type || 'epi') as ItemType;
      setItemType(currentType);
      setName(itemToEdit.name || '');
      setCode(itemToEdit.code || '');
      setCategory(itemToEdit.category || CATEGORIES_BY_TYPE[currentType]?.[0]?.value || 'outros');
      setUnit(itemToEdit.unit || 'un');
      setCurrentStock(String(itemToEdit.current_stock ?? 0));
      setMinStock(String(itemToEdit.min_stock ?? 5));
      setUnitCost(String(itemToEdit.unit_cost ?? 0));
      setRequiresSize(Boolean(itemToEdit.requires_size));

      if (itemToEdit.sizes_stock && typeof itemToEdit.sizes_stock === 'object') {
        const loaded: SizeRow[] = Object.entries(itemToEdit.sizes_stock).map(([sz, qty]) => ({
          id: crypto.randomUUID(),
          size: sz,
          qty: String(qty || 0)
        }));
        setSizeRows(loaded);
      } else {
        setSizeRows([]);
      }

      setCaNumber(itemToEdit.ca_number || '');
      setCaExpiryDate(itemToEdit.ca_expiry_date || '');
      setLifespanDays(String(itemToEdit.lifespan_days || 180));
      setBrand(itemToEdit.brand || '');
      setSerialNumber(itemToEdit.serial_number || '');
    } else {
      setItemType('epi');
      setName('');
      setCode('');
      setCategory(CATEGORIES_BY_TYPE.epi[0].value);
      setUnit('un');
      setCurrentStock('0');
      setMinStock('5');
      setUnitCost('0');
      setRequiresSize(false);
      setSizeRows([]);
      setCaNumber('');
      setCaExpiryDate('');
      setLifespanDays('180');
      setBrand('');
      setSerialNumber('');
    }
  }, [itemToEdit, isOpen]);

  if (!isOpen) return null;

  const currentCategoryOptions = CATEGORIES_BY_TYPE[itemType] || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user?.company?.id) return;

    try {
      setSaving(true);
      const companyId = user.company.id;

      // Monta o objeto sizes_stock { "39": 2, "40": 5 }
      const finalSizesStock: Record<string, number> = {};
      if (requiresSize) {
        sizeRows.forEach(row => {
          const s = row.size.trim();
          if (s) {
            finalSizesStock[s] = Math.max(0, parseInt(row.qty, 10) || 0);
          }
        });
      }

      const payload = {
        company_id: companyId,
        name: name.trim(),
        code: code.trim() || null,
        item_type: itemType,
        category: category.trim() || currentCategoryOptions[0]?.value || 'outros',
        unit: unit.trim() || 'un',
        current_stock: parseFloat(currentStock.replace(',', '.')) || 0,
        min_stock: parseFloat(minStock.replace(',', '.')) || 0,
        unit_cost: parseFloat(unitCost.replace(',', '.')) || 0,
        requires_size: requiresSize,
        sizes_stock: requiresSize ? finalSizesStock : {},
        size: null,
        ca_number: itemType === 'epi' ? caNumber.trim() || null : null,
        ca_expiry_date: itemType === 'epi' && caExpiryDate ? caExpiryDate : null,
        lifespan_days: itemType === 'epi' ? parseInt(lifespanDays) || 180 : null,
        brand: itemType === 'ferramenta' ? brand.trim() || null : null,
        serial_number: itemType === 'ferramenta' ? serialNumber.trim() || null : null,
        is_active: true,
        updated_at: new Date().toISOString()
      };

      if (itemToEdit) {
        const { error } = await supabase
          .from('inventory_items')
          .update(payload)
          .eq('id', itemToEdit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('inventory_items').insert(payload);
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Erro ao salvar item no estoque: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full h-[90vh] sm:h-[84vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        
        {/* Topo do Modal */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="pr-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {itemToEdit ? 'Editar Item do Estoque' : 'Novo Item no Estoque'}
            </h2>
            <p className="text-xs text-slate-500">
              {itemToEdit ? 'Atualize as especificações e saldos deste item.' : 'Cadastre um material, ferramenta ou equipamento com grade de tamanho.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            
            {/* 1. Tipo de Item */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Tipo de Item *
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-200/90">
                <button
                  type="button"
                  onClick={() => handleSelectType('epi')}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    itemType === 'epi'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <ShieldCheck size={14} />
                  <span>EPI</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectType('material')}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    itemType === 'material'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Package size={14} />
                  <span>Material</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectType('ferramenta')}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    itemType === 'ferramenta'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Wrench size={14} />
                  <span>Ferramenta</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectType('uniforme')}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    itemType === 'uniforme'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Shirt size={14} />
                  <span>Uniforme</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectType('consumivel')}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer col-span-2 sm:col-span-1 ${
                    itemType === 'consumivel'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Box size={14} />
                  <span>Consumível</span>
                </button>
              </div>
            </div>

            {/* 2. Nome e Código */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Nome do Item / Descrição *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={
                    itemType === 'epi'
                      ? 'Ex: Botina de Segurança com Bico Composite'
                      : itemType === 'ferramenta'
                      ? 'Ex: Furadeira Martelete SDS-Plus'
                      : itemType === 'uniforme'
                      ? 'Ex: Camisa Manga Longa com Faixa Refletiva'
                      : itemType === 'consumivel'
                      ? 'Ex: Disco de Corte Inox 4.1/2"'
                      : 'Ex: Cabo Flexível 2,5mm 750V'
                  }
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Tag size={13} className="text-slate-400" />
                  <span>Código / SKU</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: BOT-BRACOL"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono uppercase text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* 3. Categoria e Unidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Categoria do Item *
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-colors cursor-pointer"
                >
                  {currentCategoryOptions.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Unidade de Medida
                </label>
                <select
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-colors cursor-pointer"
                >
                  <option value="un">un (Unidade)</option>
                  <option value="par">par (Par)</option>
                  <option value="m">m (Metros)</option>
                  <option value="kg">kg (Quilos)</option>
                  <option value="cx">cx (Caixa)</option>
                  <option value="rolo">rolo (Rolo)</option>
                </select>
              </div>
            </div>

            {/* 4. Bloco Condicional EPI (NR-06) */}
            {itemType === 'epi' && (
              <div className="p-4 bg-sky-50/50 border border-sky-100 rounded-2xl space-y-3 pt-2">
                <span className="text-xs font-bold text-sky-900 uppercase tracking-wider block flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-sky-600" />
                  <span>Parâmetros Regulamentares (NR-06)</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nº do CA *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 34567"
                      value={caNumber}
                      onChange={e => setCaNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-sky-200 rounded-xl font-mono font-bold text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Validade do CA</label>
                    <input
                      type="date"
                      value={caExpiryDate}
                      onChange={e => setCaExpiryDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-sky-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Troca Estimada (Dias)</label>
                    <input
                      type="number"
                      min={1}
                      value={lifespanDays}
                      onChange={e => setLifespanDays(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-sky-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 5. LISTA DINÂMICA DE TAMANHOS (ESTILO GRADE DO LUME) */}
            {(itemType === 'epi' || itemType === 'uniforme') && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-800 font-bold select-none">
                    <input
                      type="checkbox"
                      checked={requiresSize}
                      onChange={e => handleToggleRequiresSize(e.target.checked)}
                      className="accent-sky-600 rounded w-4 h-4"
                    />
                    <span>Este item possui grade de tamanhos (ex: botinas, vestimentas, luvas)</span>
                  </label>

                  {requiresSize && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">Presets:</span>
                      <button
                        type="button"
                        onClick={() => handleLoadPreset(DEFAULT_FOOTWEAR_SIZES)}
                        className="px-2 py-0.5 text-[10px] bg-white border border-slate-200 rounded-md text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                      >
                        Calçados (38-44)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoadPreset(DEFAULT_CLOTHING_SIZES)}
                        className="px-2 py-0.5 text-[10px] bg-white border border-slate-200 rounded-md text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                      >
                        Vestuário (P-XG)
                      </button>
                    </div>
                  )}
                </div>

                {requiresSize && (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden animate-in fade-in duration-150">
                    {/* Header da Grade de Tamanhos */}
                    <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-sky-600" />
                        <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                          Grade de Numerações ({sizeRows.length})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddSizeRow('')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold shadow-2xs cursor-pointer active:scale-98 transition"
                      >
                        <Plus size={12} />
                        <span>Adicionar Numeração</span>
                      </button>
                    </div>

                    {/* Cabeçalho das Colunas */}
                    <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider items-center">
                      <span className="col-span-1 text-center">#</span>
                      <span className="col-span-6">Tamanho / Numeração</span>
                      <span className="col-span-4 text-center">Quantidade Inicial em Estoque</span>
                      <span className="col-span-1 text-center"></span>
                    </div>

                    {/* Linhas de Tamanho */}
                    <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                      {sizeRows.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 italic">
                          Nenhum tamanho adicionado. Clique em "+ Adicionar Numeração" ou escolha um preset acima.
                        </div>
                      ) : (
                        sizeRows.map((row, idx) => (
                          <div key={row.id} className="grid grid-cols-12 gap-2 px-3 py-1.5 items-center hover:bg-slate-50/60 transition text-xs">
                            <span className="col-span-1 text-center font-bold text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </span>

                            <div className="col-span-6">
                              <input
                                type="text"
                                placeholder="Ex: 39, 40, M, G, GG..."
                                value={row.size}
                                onChange={e => handleUpdateSizeRow(row.id, 'size', e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-slate-900 uppercase text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                              />
                            </div>

                            <div className="col-span-4">
                              <input
                                type="number"
                                min="0"
                                value={row.qty}
                                onChange={e => handleUpdateSizeRow(row.id, 'qty', e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-center text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                              />
                            </div>

                            <div className="col-span-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveSizeRow(row.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition"
                                title="Remover tamanho"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Rodapé da Grade com Soma */}
                    <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium text-[11px]">
                        Tamanhos ativos: <strong className="text-slate-800">{sizeRows.length}</strong>
                      </span>
                      <span className="font-bold text-slate-700">
                        Total da Grade: <strong className="font-mono text-sky-800 text-sm">{currentStock}</strong> {unit}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 6. Ferramenta */}
            {itemType === 'ferramenta' && (
              <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-2xl space-y-3 pt-2">
                <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block flex items-center gap-1.5">
                  <Wrench size={14} className="text-amber-600" />
                  <span>Identificação Patrimonial</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Marca / Fabricante</label>
                    <input
                      type="text"
                      placeholder="Ex: Bosch, Makita, DeWalt"
                      value={brand}
                      onChange={e => setBrand(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-amber-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nº de Série / Plaqueta</label>
                    <input
                      type="text"
                      placeholder="Ex: SN-987410"
                      value={serialNumber}
                      onChange={e => setSerialNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-amber-200 rounded-xl font-mono uppercase text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 7. Saldos e Custo */}
            <div className="grid grid-cols-3 gap-3.5 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Saldo Total ({unit})
                </label>
                <input
                  type="text"
                  required
                  disabled={requiresSize}
                  value={currentStock}
                  onChange={e => setCurrentStock(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border rounded-xl font-mono font-bold text-xs sm:text-sm text-center ${
                    requiresSize
                      ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed'
                      : 'bg-slate-50 border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Estoque Mínimo
                </label>
                <input
                  type="text"
                  required
                  value={minStock}
                  onChange={e => setMinStock(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs sm:text-sm text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Custo Médio (R$)
                </label>
                <input
                  type="text"
                  value={unitCost}
                  onChange={e => setUnitCost(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs sm:text-sm text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                />
              </div>
            </div>

          </div>

          {/* Rodapé Fixo */}
          <div className="px-5 py-3.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-2xs disabled:opacity-50 transition-all cursor-pointer active:scale-98"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>{itemToEdit ? 'Salvar Alterações' : 'Cadastrar Item'}</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default CreateInventoryItemModal;