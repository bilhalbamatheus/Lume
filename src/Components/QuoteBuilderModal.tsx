import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  X,
  Plus,
  Trash2,
  Save,
  Loader2,
  Package,
  Layers,
  Percent,
  Calendar,
  Clock,
  CreditCard,
  FileText,
  BookmarkPlus,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  ArrowLeft,
  Send,
  Eye,
  CheckCircle2,
  MoreVertical
} from 'lucide-react';

interface QuoteBuilderModalProps {
  quoteId: string;
  opportunityId: string;
  isOpen: boolean;
  initialEditMode?: boolean;
  onClose: () => void;
  onSaved: () => void;
  onOpenPrint?: (quoteId: string) => void;
}

interface QuoteLineItem {
  id?: string;
  catalog_item_id?: string | null;
  name: string;
  item_type: 'equipamento' | 'material' | 'servico' | 'outros';
  unit: string;
  quantity: number;
  unit_cost: number;
  unit_price: number;
  unit_price_display?: string;
  notes?: string;
}

interface CatalogSuggestion {
  id: string;
  name: string;
  item_type: 'equipamento' | 'material' | 'servico' | 'outros';
  unit: string;
  cost_price: number;
  markup_percent: number;
  sale_price: number;
}

const parsePtBrCurrency = (val: string | number): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = val.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

const formatCurrencyInput = (val: number | string): string => {
  const num = typeof val === 'number' ? val : parsePtBrCurrency(val);
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

export const QuoteBuilderModal: React.FC<QuoteBuilderModalProps> = ({
  quoteId,
  opportunityId,
  isOpen,
  onClose,
  onSaved,
  onOpenPrint
}) => {
  const { user } = useAuth();
  const { permissions } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emitting, setEmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
    if (!isOpen) return;
    const main = document.querySelector('main');
    if (main && !isMobile) {
      main.style.position = 'relative';
      setTargetMainEl(main);
    }
    return () => {
      if (main) main.style.position = '';
    };
  }, [isOpen, isMobile]);

  const [opportunityOwnerId, setOpportunityOwnerId] = useState<string | null>(null);
  const [opportunityTitle, setOpportunityTitle] = useState<string>('');

  const currentUserId = user?.id || (user as any)?.user?.id || (user as any)?.profile?.id;
  const isOwner = opportunityOwnerId === currentUserId;
  const isAdmin = Boolean(permissions.isOwnerOrAdmin);

  const canEdit = isAdmin || (Boolean((permissions as any).canCreateQuotes ?? permissions.canManageDeals) && isOwner);
  const canDiscount = isAdmin || Boolean((permissions as any).canApplyDiscount);
  const canViewMargin = isAdmin || Boolean((permissions as any).canViewProfitMargin);

  const [quoteCode, setQuoteCode] = useState<string>('');
  const [quoteTitle, setQuoteTitle] = useState<string>('');
  const [quoteStatus, setQuoteStatus] = useState<string>('rascunho');
  const [discountType, setDiscountType] = useState<'currency' | 'percent'>('currency');
  const [discountValue, setDiscountValue] = useState<string>('0,00');
  const [paymentTerms, setPaymentTerms] = useState<string>('');
  const [deliveryDeadline, setDeliveryDeadline] = useState<string>('');
  const [warrantyTerms, setWarrantyTerms] = useState<string>('12 meses');
  const [technicalNotes, setTechnicalNotes] = useState<string>('');
  const [validityDays, setValidityDays] = useState<number>(15);

  const [items, setItems] = useState<QuoteLineItem[]>([]);

  // Menu móvel
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Catálogo Mestre da Empresa
  const [catalog, setCatalog] = useState<CatalogSuggestion[]>([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // Cadastro Rápido de Item
  const [isQuickCatalogModalOpen, setIsQuickCatalogModalOpen] = useState(false);
  const [quickItemIndex, setQuickItemIndex] = useState<number | null>(null);
  const [quickItemName, setQuickItemName] = useState('');
  const [quickItemType, setQuickItemType] = useState<'equipamento' | 'material' | 'servico' | 'outros'>('equipamento');
  const [quickItemUnit, setQuickItemUnit] = useState('un');
  const [quickItemCost, setQuickItemCost] = useState('');
  const [quickItemMarkup, setQuickItemMarkup] = useState('30');
  const [quickItemPrice, setQuickItemPrice] = useState('');
  const [savingQuickCatalog, setSavingQuickCatalog] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
        setActiveSearchIndex(null);
        setDropdownCoords(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && quoteId) {
      loadInitialData();
    } else {
      setItems([]);
      setActiveSearchIndex(null);
      setSearchTerm('');
      setDropdownCoords(null);
      setIsQuickCatalogModalOpen(false);
      setIsMobileMenuOpen(false);
    }
  }, [isOpen, quoteId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const companyId = user?.company?.id;

      if (opportunityId) {
        const { data: oppData } = await supabase
          .from('opportunities')
          .select('title, assigned_to')
          .eq('id', opportunityId)
          .single();

        if (oppData) {
          setOpportunityTitle(oppData.title || '');
          setOpportunityOwnerId(oppData.assigned_to || null);
        }
      }

      const { data: quote, error: qErr } = await supabase
        .from('opportunity_quotes')
        .select(`
          id, 
          code, 
          title, 
          status,
          total_value, 
          discount_value, 
          discount_type, 
          payment_terms, 
          delivery_deadline, 
          validity_days,
          notes
        `)
        .eq('id', quoteId)
        .single();

      if (qErr) throw qErr;

      setQuoteCode(quote.code || '');
      setQuoteTitle(quote.title || '');
      setQuoteStatus(quote.status || 'rascunho');
      setDiscountType((quote.discount_type as any) || 'currency');
      setDiscountValue(formatCurrencyInput(quote.discount_value || 0));
      setPaymentTerms(quote.payment_terms || '');
      setDeliveryDeadline(quote.delivery_deadline || '');
      setValidityDays(quote.validity_days || 15);
      setTechnicalNotes(quote.notes || '');

      if (companyId) {
        const { data: catData } = await supabase
          .from('company_catalog_items')
          .select('id, name, item_type, unit, cost_price, markup_percent, sale_price')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('name', { ascending: true });

        setCatalog((catData as CatalogSuggestion[]) || []);
      }

      const { data: lineItems, error: lErr } = await supabase
        .from('opportunity_quote_items')
        .select('id, catalog_item_id, name, item_type, unit, quantity, unit_cost, unit_price, notes')
        .eq('quote_id', quoteId)
        .order('sort_order', { ascending: true });

      if (lErr) throw lErr;

      if (lineItems && lineItems.length > 0) {
        setItems(
          lineItems.map((li) => ({
            id: li.id,
            catalog_item_id: li.catalog_item_id,
            name: li.name,
            item_type: (li.item_type as any) || 'equipamento',
            unit: li.unit || 'un',
            quantity: Number(li.quantity) || 1,
            unit_cost: Number(li.unit_cost) || 0,
            unit_price: Number(li.unit_price) || 0,
            unit_price_display: formatCurrencyInput(Number(li.unit_price) || 0),
            notes: li.notes || ''
          }))
        );
      } else {
        setItems([
          {
            name: '',
            item_type: 'equipamento',
            unit: 'un',
            quantity: 1,
            unit_cost: 0,
            unit_price: 0,
            unit_price_display: '0,00'
          }
        ]);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados do orçamento:', err);
      alert(`Falha ao carregar orçamento: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const subtotalPrice = useMemo(() => {
    return items.reduce((acc, it) => acc + (it.quantity || 0) * (it.unit_price || 0), 0);
  }, [items]);

  const subtotalCost = useMemo(() => {
    return items.reduce((acc, it) => acc + (it.quantity || 0) * (it.unit_cost || 0), 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    const rawDisc = parsePtBrCurrency(discountValue);
    if (discountType === 'percent') {
      return (subtotalPrice * rawDisc) / 100;
    }
    return Math.min(rawDisc, subtotalPrice);
  }, [subtotalPrice, discountValue, discountType]);

  const finalPrice = useMemo(() => {
    return Math.max(0, subtotalPrice - discountAmount);
  }, [subtotalPrice, discountAmount]);

  const profitAmount = useMemo(() => {
    return finalPrice - subtotalCost;
  }, [finalPrice, subtotalCost]);

  const marginPercent = useMemo(() => {
    if (finalPrice <= 0) return 0;
    return (profitAmount / finalPrice) * 100;
  }, [finalPrice, profitAmount]);

  const isLowMargin = useMemo(() => {
    return canViewMargin && marginPercent < 15 && finalPrice > 0;
  }, [canViewMargin, marginPercent, finalPrice]);

  const calculatedValidUntil = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (validityDays || 15));
    return d.toLocaleDateString('pt-BR');
  }, [validityDays]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        name: '',
        item_type: 'equipamento',
        unit: 'un',
        quantity: 1,
        unit_cost: 0,
        unit_price: 0,
        unit_price_display: '0,00'
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (activeSearchIndex === index) {
      setActiveSearchIndex(null);
      setDropdownCoords(null);
    }
  };

  const handleItemChange = (index: number, field: keyof QuoteLineItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleUnitPriceInputChange = (index: number, rawVal: string) => {
    const numericValue = parsePtBrCurrency(rawVal);
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        unit_price: numericValue,
        unit_price_display: rawVal
      };
      return copy;
    });
  };

  const handleUnitPriceInputBlur = (index: number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        unit_price_display: formatCurrencyInput(copy[index].unit_price)
      };
      return copy;
    });
  };

  const handleSelectCatalogItem = (index: number, cat: CatalogSuggestion) => {
    const price = Number(cat.sale_price) || 0;
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        catalog_item_id: cat.id,
        name: cat.name,
        item_type: cat.item_type,
        unit: cat.unit,
        unit_cost: Number(cat.cost_price) || 0,
        unit_price: price,
        unit_price_display: formatCurrencyInput(price)
      };
      return copy;
    });
    setActiveSearchIndex(null);
    setSearchTerm('');
    setDropdownCoords(null);
  };

  const handleOpenQuickCatalogModal = (index: number) => {
    const item = items[index];
    setQuickItemIndex(index);
    setQuickItemName(item.name || searchTerm || '');
    setQuickItemType(item.item_type || 'equipamento');
    setQuickItemUnit(item.unit || 'un');
    setQuickItemCost(item.unit_cost ? formatCurrencyInput(item.unit_cost) : '');
    setQuickItemMarkup('30');
    setQuickItemPrice(item.unit_price ? formatCurrencyInput(item.unit_price) : '');
    setActiveSearchIndex(null);
    setDropdownCoords(null);
    setIsQuickCatalogModalOpen(true);
  };

  const handleQuickCostOrMarkupChange = (costStr: string, markupStr: string) => {
    setQuickItemCost(costStr);
    setQuickItemMarkup(markupStr);
    const cost = parsePtBrCurrency(costStr);
    const markup = parseFloat(markupStr) || 0;
    if (cost > 0) {
      const calculated = cost * (1 + markup / 100);
      setQuickItemPrice(formatCurrencyInput(calculated));
    }
  };

  const handleQuickSalePriceChange = (saleStr: string) => {
    setQuickItemPrice(saleStr);
    const sale = parsePtBrCurrency(saleStr);
    const cost = parsePtBrCurrency(quickItemCost);
    if (cost > 0 && sale >= cost) {
      const markup = ((sale - cost) / cost) * 100;
      setQuickItemMarkup(markup.toFixed(2));
    }
  };

  const handleSaveQuickCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickItemName.trim() || !user?.company?.id || !canEdit) return;

    try {
      setSavingQuickCatalog(true);
      const cost = parsePtBrCurrency(quickItemCost);
      const markup = parseFloat(quickItemMarkup) || 0;
      const sale = quickItemPrice ? parsePtBrCurrency(quickItemPrice) : (cost * (1 + markup / 100));

      const { data: newCat, error } = await supabase
        .from('company_catalog_items')
        .insert({
          company_id: user.company.id,
          name: quickItemName.trim(),
          item_type: quickItemType,
          unit: quickItemUnit.trim() || 'un',
          cost_price: cost,
          markup_percent: markup,
          sale_price: sale
        })
        .select()
        .single();

      if (error) throw error;

      if (newCat) {
        setCatalog((prev) => [...prev, newCat as CatalogSuggestion]);

        if (quickItemIndex !== null && items[quickItemIndex]) {
          setItems((prev) => {
            const copy = [...prev];
            copy[quickItemIndex] = {
              ...copy[quickItemIndex],
              catalog_item_id: newCat.id,
              name: newCat.name,
              item_type: newCat.item_type,
              unit: newCat.unit,
              unit_cost: Number(newCat.cost_price) || 0,
              unit_price: Number(newCat.sale_price) || 0,
              unit_price_display: formatCurrencyInput(Number(newCat.sale_price) || 0)
            };
            return copy;
          });
        }
      }

      setIsQuickCatalogModalOpen(false);
      setQuickItemIndex(null);
    } catch (err: any) {
      alert(`Erro ao cadastrar item no catálogo: ${err.message}`);
    } finally {
      setSavingQuickCatalog(false);
    }
  };

  const filteredCatalog = useMemo(() => {
    if (!searchTerm.trim()) return catalog.slice(0, 8);
    return catalog
      .filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 10);
  }, [catalog, searchTerm]);

  const handleInputFocusOrChange = (e: React.ChangeEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>, idx: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setDropdownCoords({
      top: rect.bottom + 4,
      left: Math.max(10, Math.min(rect.left, window.innerWidth - 370)),
      width: Math.min(window.innerWidth - 20, Math.max(rect.width, 360))
    });
    setActiveSearchIndex(idx);
    setSearchTerm(e.currentTarget.value || '');
  };

  const persistQuote = async (): Promise<boolean> => {
    if (!user?.company?.id) return false;
    if (!canEdit) {
      alert('Não possui autorização para gravar alterações nesta proposta.');
      return false;
    }

    const validItems = items.filter((it) => it.name.trim() !== '');
    if (validItems.length === 0) {
      alert('Adicione pelo menos 1 item na proposta.');
      return false;
    }

    await supabase
      .from('opportunity_quote_items')
      .delete()
      .eq('quote_id', quoteId);

    const insertLines = validItems.map((it, idx) => ({
      company_id: user.company.id,
      quote_id: quoteId,
      catalog_item_id: it.catalog_item_id || null,
      name: it.name.trim(),
      description: it.name.trim(),
      item_type: it.item_type,
      unit: it.unit || 'un',
      quantity: it.quantity || 1,
      unit_cost: it.unit_cost || 0,
      unit_price: it.unit_price || 0,
      sort_order: idx + 1,
      notes: it.notes?.trim() || null
    }));

    const { error: linesErr } = await supabase
      .from('opportunity_quote_items')
      .insert(insertLines);

    if (linesErr) throw linesErr;

    const { error: quoteErr } = await supabase
      .from('opportunity_quotes')
      .update({
        title: quoteTitle.trim() || `Proposta #${quoteCode || '1'}`,
        total_value: finalPrice,
        discount_value: canDiscount ? parsePtBrCurrency(discountValue) : 0,
        discount_type: discountType,
        payment_terms: paymentTerms.trim() || null,
        delivery_deadline: deliveryDeadline.trim() || null,
        validity_days: validityDays || 15,
        notes: technicalNotes.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', quoteId);

    if (quoteErr) throw quoteErr;

    const { data: qData } = await supabase
      .from('opportunity_quotes')
      .select('is_selected')
      .eq('id', quoteId)
      .single();

    if (qData?.is_selected) {
      await supabase
        .from('opportunities')
        .update({
          final_value: finalPrice,
          updated_at: new Date().toISOString()
        })
        .eq('id', opportunityId);
    }

    return true;
  };

  const handleSaveQuote = async () => {
    try {
      setSaving(true);
      const success = await persistQuote();
      if (success) {
        showToast('Proposta comercial salva com sucesso!');
        onSaved();
      }
    } catch (err: any) {
      console.error('Erro ao gravar proposta:', err);
      alert(`Falha ao gravar proposta: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEmitQuote = async () => {
    try {
      setEmitting(true);
      const success = await persistQuote();
      if (!success) return;

      await supabase
        .from('opportunity_quotes')
        .update({ status: 'enviado', updated_at: new Date().toISOString() })
        .eq('id', quoteId);

      setQuoteStatus('enviado');
      showToast('Proposta emitida com sucesso!');
      onSaved();

      if (onOpenPrint) {
        setTimeout(() => {
          onOpenPrint(quoteId);
        }, 400);
      }
    } catch (err: any) {
      console.error('Erro ao emitir proposta:', err);
      alert(`Falha ao emitir proposta: ${err.message}`);
    } finally {
      setEmitting(false);
    }
  };

  const handleViewQuote = async () => {
    const success = await persistQuote();
    if (success && onOpenPrint) {
      onOpenPrint(quoteId);
    }
  };

  if (!isOpen) return null;

  const isAlreadyEmitted = quoteStatus === 'enviado';

  const content = (
    <div className={`bg-slate-100 flex flex-col z-40 overflow-hidden animate-in fade-in duration-150 ${
      isMobile ? 'fixed inset-0 z-[150] w-screen h-screen' : 'absolute inset-0'
    }`}>
      
      <style>{`
        .lume-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .lume-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .lume-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 9999px;
        }
        .lume-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .lume-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
      `}</style>

      {/* TOAST DE FEEDBACK DE SUCESSO */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[99999] bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in slide-in-from-top duration-200">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. TOPBAR EXCLUSIVA MOBILE (< lg): Voltar | Detalhes da Proposta | Menu (...) */}
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
          Detalhes da Proposta
        </span>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-900 transition cursor-pointer shadow-2xs"
          title="Opções da Proposta"
        >
          <MoreVertical size={16} />
        </button>
      </div>

      {/* 2. CABEÇALHO NO DESKTOP (lg+) */}
      <div className="hidden lg:flex bg-white border-b border-slate-200/90 px-6 py-3.5 shrink-0 shadow-2xs z-20 items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer shadow-2xs shrink-0"
            title="Voltar para a negociação"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight truncate">
                {quoteTitle || 'Composição de Orçamento'}
              </h2>
              {quoteCode && (
                <span className="font-mono text-[11px] font-bold bg-sky-50 text-sky-700 px-2.5 py-0.5 rounded-lg border border-sky-200 shadow-2xs">
                  {quoteCode}
                </span>
              )}
              {isAlreadyEmitted && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 size={11} /> Emitida
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {opportunityTitle ? `Negociação: ${opportunityTitle}` : 'Configure insumos, prazos e condições financeiras.'}
            </p>
          </div>
        </div>

        {/* Extremidade Direita: Salvar, Emitir/Visualizar e Fechar no Desktop */}
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <>
              <button
                type="button"
                disabled={saving || emitting}
                onClick={handleSaveQuote}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Salvar Proposta</span>
              </button>

              {isAlreadyEmitted ? (
                <button
                  type="button"
                  onClick={handleViewQuote}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs transition active:scale-98 cursor-pointer"
                  title="Visualizar a folha timbrada da proposta"
                >
                  <Eye size={15} />
                  <span>Visualizar Proposta</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving || emitting}
                  onClick={handleEmitQuote}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-2xs transition active:scale-98 disabled:opacity-50 cursor-pointer"
                  title="Grava e abre a visualização para emissão"
                >
                  {emitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Emitir Proposta</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer ml-1"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ÁREA DE TRABALHO COM TOTAL RESPONSIVIDADE */}
      <div className="flex-1 overflow-y-auto lume-scrollbar p-3 sm:p-5 lg:p-7 space-y-4 sm:space-y-5 w-full">
        
        {/* Bloco 1: Parâmetros da Proposta (Título e Validade) */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4 w-full">
          <div className="md:col-span-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Título da Proposta Comercial *
              </label>
              {quoteCode && (
                <span className="lg:hidden font-mono text-[10px] font-bold bg-sky-50 text-sky-700 px-2 py-0.5 rounded border border-sky-200">
                  {quoteCode}
                </span>
              )}
            </div>
            <input
              type="text"
              value={quoteTitle}
              onChange={(e) => setQuoteTitle(e.target.value)}
              placeholder="Ex: Proposta #1 - Instalação de Gerador 50kVA"
              className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs sm:text-sm text-slate-800 font-bold bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:ring-2 focus:ring-sky-500 shadow-2xs transition"
            />
          </div>

          <div className="p-2.5 sm:p-3 bg-slate-50/80 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between mb-1 text-[11px] font-bold text-slate-600">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-sky-600" />
                Validade (Dias)
              </span>
              <span className="font-mono text-sky-800 text-[10px]">
                Até: {calculatedValidUntil}
              </span>
            </div>
            <input
              type="number"
              min={1}
              max={180}
              value={validityDays}
              onChange={(e) => setValidityDays(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg text-xs text-slate-800 font-bold text-center bg-white border border-slate-200 focus:ring-1 focus:ring-sky-500 shadow-2xs"
            />
          </div>
        </div>

        {/* Bloco 2: Tabela de Itens e Insumos da Proposta */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3 sm:space-y-4 w-full">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 bg-sky-50 text-sky-600 rounded-xl border border-sky-100 shrink-0">
                <Layers size={17} />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">
                  Itens e Serviços Orçados ({items.length})
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-400 truncate hidden sm:block">
                  Componha produtos, equipamentos e serviços da proposta comercial.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition shadow-2xs active:scale-98 cursor-pointer shrink-0"
            >
              <Plus size={14} />
              <span>Adicionar Linha</span>
            </button>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <Loader2 size={20} className="animate-spin mx-auto mb-2 text-sky-600" />
              Carregando itens da proposta...
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl bg-white shadow-2xs overflow-x-auto w-full">
              <table className="w-full text-left text-xs min-w-[720px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 w-8 text-center text-slate-400">#</th>
                    <th className="py-2.5 px-3 min-w-[260px]">Descrição do Item / Serviço</th>
                    <th className="py-2.5 px-2 w-44">Categoria</th>
                    <th className="py-2.5 px-2 w-20 text-center">Unid.</th>
                    <th className="py-2.5 px-2 w-20 text-center">Qtd.</th>
                    <th className="py-2.5 px-2 w-32 text-right">Preço Unit. (R$)</th>
                    <th className="py-2.5 px-4 w-32 text-right">Subtotal</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => {
                    const rowTotal = (item.quantity || 0) * (item.unit_price || 0);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>

                        {/* Descrição com Autocomplete */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.name}
                            placeholder="Digite para buscar ou cadastrar..."
                            onFocus={(e) => handleInputFocusOrChange(e, idx)}
                            onChange={(e) => {
                              handleItemChange(idx, 'name', e.target.value);
                              handleInputFocusOrChange(e, idx);
                            }}
                            className="w-full px-3 py-1.5 rounded-xl text-xs text-slate-800 font-medium bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition"
                          />
                        </td>

                        {/* Categoria com largura estendida para não cortar */}
                        <td className="py-2 px-2">
                          <select
                            value={item.item_type}
                            onChange={(e) => handleItemChange(idx, 'item_type', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-xl text-xs text-slate-800 font-medium bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-sky-400 cursor-pointer"
                          >
                            <option value="equipamento">Equipamento</option>
                            <option value="material">Material</option>
                            <option value="servico">Serviço</option>
                            <option value="outros">Outros</option>
                          </select>
                        </td>

                        {/* Unidade */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                            className="w-full px-1.5 py-1.5 rounded-xl text-xs text-slate-800 text-center font-mono font-medium bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-sky-400"
                          />
                        </td>

                        {/* Quantidade */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min={0.001}
                            step="any"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 rounded-xl text-xs text-slate-800 text-center font-bold bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-sky-400"
                          />
                        </td>

                        {/* Preço Unitário com Máscara e Formatação R$ */}
                        <td className="py-2 px-2 text-right">
                          <input
                            type="text"
                            value={item.unit_price_display ?? formatCurrencyInput(item.unit_price)}
                            onChange={(e) => handleUnitPriceInputChange(idx, e.target.value)}
                            onBlur={() => handleUnitPriceInputBlur(idx)}
                            className="w-full px-2.5 py-1.5 rounded-xl text-xs text-slate-900 text-right font-bold font-mono bg-white border border-sky-300 text-sky-950 focus:ring-1 focus:ring-sky-400"
                          />
                        </td>

                        {/* Subtotal */}
                        <td className="py-2 px-4 text-right font-extrabold text-slate-900 font-mono text-xs sm:text-sm">
                          {formatCurrency(rowTotal)}
                        </td>

                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length <= 1}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer disabled:opacity-30"
                            title="Remover linha"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bloco 3: Fechamento Financeiro e Condições em Grade Ampla */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full pb-8 sm:pb-0">
          
          {/* Coluna Esquerda: Condições Comerciais, Garantias e Notas */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5 text-xs">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block border-b border-slate-100 pb-2">
              Condições Comerciais & Prazos
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                  <Clock size={13} className="text-sky-600" />
                  Prazo de Execução / Entrega
                </label>
                <input
                  type="text"
                  value={deliveryDeadline}
                  onChange={(e) => setDeliveryDeadline(e.target.value)}
                  placeholder="Ex: 30 a 45 dias úteis"
                  className="w-full px-3 py-2 rounded-xl text-slate-800 font-medium bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                  <CreditCard size={13} className="text-sky-600" />
                  Condições de Pagamento
                </label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="Ex: 50% entrada + 50% entrega / Pix / Financiamento"
                  className="w-full px-3 py-2 rounded-xl text-slate-800 font-medium bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500 shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" />
                Garantia dos Equipamentos e Instalação
              </label>
              <input
                type="text"
                value={warrantyTerms}
                onChange={(e) => setWarrantyTerms(e.target.value)}
                placeholder="Ex: 12 meses para equipamentos e 90 dias de mão de obra"
                className="w-full px-3 py-2 rounded-xl text-slate-800 font-medium bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500 shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Notas Técnicas e Parecer da Proposta
              </label>
              <textarea
                rows={3}
                value={technicalNotes}
                onChange={(e) => setTechnicalNotes(e.target.value)}
                placeholder="Informações adicionais de escopo, homologação ou responsabilidades das partes..."
                className="w-full px-3 py-2 rounded-xl text-slate-800 placeholder-slate-400 resize-none bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500 shadow-2xs"
              />
            </div>
          </div>

          {/* Coluna Direita: Fechamento Financeiro */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-4">
            <div className="space-y-3.5">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block border-b border-slate-100 pb-2">
                Fechamento Financeiro
              </span>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Subtotal Bruto dos Itens:</span>
                <span className="font-bold text-slate-800 font-mono text-sm">{formatCurrency(subtotalPrice)}</span>
              </div>

              {/* Linha de Desconto Comercial com Máscara */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Desconto Comercial:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled={!canDiscount}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    onBlur={() => setDiscountValue(formatCurrencyInput(discountValue))}
                    placeholder="0,00"
                    className="w-24 sm:w-28 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-800 text-right font-mono bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-sky-500 shadow-2xs"
                  />
                  {canDiscount ? (
                    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setDiscountType('currency')}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                          discountType === 'currency'
                            ? 'bg-sky-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-200/70'
                        }`}
                      >
                        R$
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('percent')}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                          discountType === 'percent'
                            ? 'bg-sky-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-200/70'
                        }`}
                      >
                        %
                      </button>
                    </div>
                  ) : (
                    <span className="font-semibold text-slate-500 text-xs">
                      {discountType === 'currency' ? 'R$' : '%'}
                    </span>
                  )}
                </div>
              </div>

              {/* Custos Internos e Margem de Lucro */}
              {canViewMargin && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Custo Total dos Insumos:</span>
                    <span className="font-mono text-slate-700">{formatCurrency(subtotalCost)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                      <TrendingUp size={13} className="text-emerald-600" />
                      Lucro Bruto Previsto:
                    </span>
                    <span className={`font-bold font-mono ${isLowMargin ? 'text-amber-600' : 'text-emerald-700'}`}>
                      {formatCurrency(profitAmount)} ({marginPercent.toFixed(1)}%)
                    </span>
                  </div>

                  {isLowMargin && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-center gap-2">
                      <AlertTriangle size={14} className="shrink-0 text-amber-600" />
                      <span>Atenção: A margem de lucro calculada está abaixo de 15%.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Total da Proposta em Destaque */}
            <div className="p-3.5 sm:p-4 bg-slate-50/90 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  Valor Total da Proposta
                </span>
                <span className="text-[11px] text-slate-500">
                  Total líquido faturado
                </span>
              </div>
              <span className="text-xl sm:text-3xl font-black text-slate-900 font-mono">
                {formatCurrency(finalPrice)}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ACTION SHEET MOBILE: Aberto pelo menu (...) da Topbar */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[180] flex flex-col justify-end bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="absolute inset-0" 
            onClick={() => setIsMobileMenuOpen(false)} 
          />

          <div className="relative bg-white rounded-t-3xl p-5 space-y-3 animate-in slide-in-from-bottom duration-200 border-t border-slate-200">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2" />

            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
              Opções da Proposta
            </h3>

            <div className="space-y-2 pt-1">
              {canEdit && (
                <button
                  type="button"
                  disabled={saving || emitting}
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleSaveQuote();
                  }}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                    <Save size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900">Salvar Proposta</p>
                    <p className="text-[11px] text-slate-500 font-normal">Gravar alterações e valores</p>
                  </div>
                </button>
              )}

              {canEdit && (
                isAlreadyEmitted ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleViewQuote();
                    }}
                    className="w-full p-3 bg-sky-50 hover:bg-sky-100 rounded-2xl flex items-center gap-3 text-sky-800 font-semibold text-xs transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Eye size={18} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-sky-950">Visualizar Proposta</p>
                      <p className="text-[11px] text-sky-600 font-normal">Abrir folha timbrada para conferência</p>
                    </div>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={saving || emitting}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleEmitQuote();
                    }}
                    className="w-full p-3 bg-emerald-50 hover:bg-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-800 font-semibold text-xs transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Send size={18} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-emerald-950">Emitir Proposta</p>
                      <p className="text-[11px] text-emerald-600 font-normal">Salvar e abrir folha timbrada</p>
                    </div>
                  </button>
                )
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DROPDOWN FLUTUANTE DO CATÁLOGO NO BODY */}
      {dropdownCoords && activeSearchIndex !== null && createPortal(
        <div
          ref={searchDropdownRef}
          style={{
            position: 'fixed',
            top: `${dropdownCoords.top}px`,
            left: `${dropdownCoords.left}px`,
            width: `${dropdownCoords.width}px`
          }}
          className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 z-[99999] space-y-1 animate-in fade-in zoom-in-95 duration-100 max-h-64 overflow-y-auto lume-scrollbar"
        >
          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Itens no Catálogo</span>
            <Package size={12} />
          </div>

          {filteredCatalog.length === 0 ? (
            <div className="p-2 text-slate-400 text-xs text-center italic">
              Nenhum item correspondente encontrado.
            </div>
          ) : (
            filteredCatalog.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectCatalogItem(activeSearchIndex, cat)}
                className="w-full p-2 rounded-xl text-left hover:bg-sky-50 transition-colors flex items-center justify-between gap-2 cursor-pointer group"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-xs text-slate-800 group-hover:text-sky-700 truncate">
                    {cat.name}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {cat.item_type} • {cat.unit}
                  </span>
                </div>
                <span className="font-bold text-xs text-slate-900 shrink-0 font-mono">
                  {formatCurrency(cat.sale_price)}
                </span>
              </button>
            ))
          )}

          {/* Botão de Cadastro Sempre Visível */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => handleOpenQuickCatalogModal(activeSearchIndex)}
              className="w-full p-2 rounded-xl text-left bg-sky-50 hover:bg-sky-100 text-sky-800 transition-colors flex items-center gap-2 cursor-pointer text-xs font-semibold"
            >
              <BookmarkPlus size={14} className="text-sky-600 shrink-0" />
              <span className="truncate">
                + Cadastrar {searchTerm.trim() ? `"${searchTerm.trim()}"` : 'novo item'} no Catálogo
              </span>
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* POPUP DE CADASTRO RÁPIDO NO CATÁLOGO */}
      {isQuickCatalogModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg border border-sky-100">
                  <BookmarkPlus size={16} />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Salvar Item no Catálogo Mestre
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickCatalogModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveQuickCatalogItem} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome / Descrição *</label>
                <input
                  type="text"
                  required
                  value={quickItemName}
                  onChange={(e) => setQuickItemName(e.target.value)}
                  placeholder="Ex: Módulo Solar 550W Canadian"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Item</label>
                  <select
                    value={quickItemType}
                    onChange={(e) => setQuickItemType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 shadow-2xs"
                  >
                    <option value="equipamento">Equipamento</option>
                    <option value="material">Material</option>
                    <option value="servico">Serviço</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unidade</label>
                  <select
                    value={quickItemUnit}
                    onChange={(e) => setQuickItemUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 shadow-2xs"
                  >
                    <option value="un">un (Unidade)</option>
                    <option value="m">m (Metro)</option>
                    <option value="m²">m² (Metro quadrado)</option>
                    <option value="kWp">kWp (Potência)</option>
                    <option value="hora">hora (Horas)</option>
                    <option value="diaria">diaria (Diária)</option>
                    <option value="vb">vb (Verba global)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Custo Base (R$)</label>
                    <input
                      type="text"
                      value={quickItemCost}
                      onChange={(e) => handleQuickCostOrMarkupChange(e.target.value, quickItemMarkup)}
                      placeholder="0,00"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-semibold focus:ring-2 focus:ring-sky-500 text-right shadow-2xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Mark-up</span>
                      <Percent size={11} className="text-slate-400" />
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={quickItemMarkup}
                        onChange={(e) => handleQuickCostOrMarkupChange(quickItemCost, e.target.value)}
                        placeholder="30"
                        className="w-full pl-3 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-semibold focus:ring-2 focus:ring-sky-500 text-right shadow-2xs font-mono"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[11px] pointer-events-none">%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-sky-900 mb-1">
                    Preço de Venda Sugerido (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    value={quickItemPrice}
                    onChange={(e) => handleQuickSalePriceChange(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 bg-white border border-sky-300 rounded-xl text-sky-950 font-extrabold text-sm focus:ring-2 focus:ring-sky-500 text-right shadow-2xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickCatalogModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingQuickCatalog}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold shadow-2xs cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {savingQuickCatalog ? 'Salvando...' : 'Confirmar e Usar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  return (isMobile || !targetMainEl)
    ? createPortal(content, document.body)
    : createPortal(content, targetMainEl);
};

export default QuoteBuilderModal;