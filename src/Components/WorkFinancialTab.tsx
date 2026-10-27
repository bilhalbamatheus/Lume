import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { WorkMeasurementPrintView } from './WorkMeasurementPrintView';
import {
  CheckCircle2,
  Clock,
  Plus,
  Eye,
  Loader2,
  Download,
  Receipt,
  FileCheck2,
  ArrowUpRight,
  X,
  Save,
  CreditCard,
  Check,
  Printer
} from 'lucide-react';

interface WorkMeasurement {
  id: string;
  code: string;
  title: string;
  start_date: string;
  end_date: string;
  status: 'rascunho' | 'aguardando_aprovacao' | 'aprovada' | 'paga';
  total_measured_amount: number;
  retention_percent: number;
  net_amount: number;
  notes?: string | null;
  created_at: string;
}

interface WorkMeasurementItem {
  id: string;
  measurement_id: string;
  work_item_id?: string | null;
  work_task_id?: string | null;
  item_title: string;
  unit: string;
  quantity_planned: number;
  quantity_executed: number;
  quantity_measured_period: number;
  unit_price: number;
  measured_amount: number;
  progress_percent: number;
}

interface WorkInvoice {
  id: string;
  code: string;
  description: string;
  measurement_id?: string | null;
  invoice_number?: string | null;
  invoice_url?: string | null;
  amount: number;
  due_date: string;
  paid_date?: string | null;
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  payment_method?: string | null;
  notes?: string | null;
}

interface WorkFinancialTabProps {
  workId: string;
  contractAmount?: number;
  measurementType?: 'por_subitem' | 'por_item' | 'sem_medicao';
}

const formatCurrency = (val: number | null | undefined): string => {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const maskCurrencyInput = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const numberValue = Number(digits) / 100;
  return numberValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const parseCurrency = (val: string | number | null | undefined): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim();
  if (/^-?\d+(\.\d+)?$/.test(str)) return parseFloat(str) || 0;
  const clean = str.replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

export const WorkFinancialTab: React.FC<WorkFinancialTabProps> = ({
  workId,
  contractAmount = 0,
  measurementType = 'por_subitem'
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'measurements' | 'invoices'>('measurements');

  const [measurements, setMeasurements] = useState<WorkMeasurement[]>([]);
  const [invoices, setInvoices] = useState<WorkInvoice[]>([]);
  const [workItems, setWorkItems] = useState<any[]>([]);
  const [workTasks, setWorkTasks] = useState<any[]>([]);
  
  // Apontamentos Diários (Apenas os NÃO medidos)
  const [taskEntries, setTaskEntries] = useState<any[]>([]);

  // Modal Novo Boletim de Medição
  const [isCreateBmModalOpen, setIsCreateBmModalOpen] = useState(false);
  const [bmTitle, setBmTitle] = useState('');
  const [bmStartDate, setBmStartDate] = useState('');
  const [bmEndDate, setBmEndDate] = useState('');
  const [bmRetention, setBmRetention] = useState('0');
  const [bmNotes, setBmNotes] = useState('');
  const [creatingBm, setCreatingBm] = useState(false);

  // Seleções no modal
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [manualAmount, setManualAmount] = useState('');

  // Modal Detalhes do Boletim
  const [viewingMeasurement, setViewingMeasurement] = useState<WorkMeasurement | null>(null);
  const [measurementItems, setMeasurementItems] = useState<WorkMeasurementItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Modal Impressão Timbrada
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Modal Nova Fatura
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceDesc, setInvoiceDesc] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceMethod, setInvoiceMethod] = useState('boleto');
  const [invoiceBmId, setInvoiceBmId] = useState<string | null>(null);
  const [savingInvoice, setSavingInvoice] = useState(false);

  const loadFinancialData = useCallback(async () => {
    try {
      setLoading(true);

      const [mRes, invRes, itemsRes, entriesRes] = await Promise.all([
        supabase
          .from('work_measurements')
          .select('*')
          .eq('work_id', workId)
          .order('created_at', { ascending: false }),
        supabase
          .from('work_invoices')
          .select('*')
          .eq('work_id', workId)
          .order('due_date', { ascending: true }),
        supabase
          .from('work_items')
          .select('*')
          .eq('work_id', workId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('work_task_entries')
          .select('*')
          .eq('work_id', workId)
          .eq('is_measured', false) // Busca apenas apontamentos não faturados
          .order('entry_date', { ascending: true })
      ]);

      if (mRes.error) throw mRes.error;
      const loadedItems = itemsRes.data || [];
      const itemIds = loadedItems.map(i => i.id);

      let loadedTasks: any[] = [];
      if (itemIds.length > 0) {
        const { data: tData, error: tErr } = await supabase
          .from('work_tasks')
          .select('*')
          .in('work_item_id', itemIds);

        if (tErr) throw tErr;
        loadedTasks = tData || [];
      }

      setMeasurements(mRes.data || []);
      setInvoices(invRes.data || []);
      setWorkItems(loadedItems);
      setWorkTasks(loadedTasks);
      setTaskEntries(entriesRes.data || []);
    } catch (err) {
      console.error('Erro ao carregar dados financeiros:', err);
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useEffect(() => {
    loadFinancialData();
  }, [loadFinancialData]);

  // Mapas rápidos
  const itemsMap = useMemo(() => {
    const map = new Map<string, any>();
    workItems.forEach(item => map.set(item.id, item));
    return map;
  }, [workItems]);

  const tasksMap = useMemo(() => {
    const map = new Map<string, any>();
    workTasks.forEach(t => map.set(t.id, t));
    return map;
  }, [workTasks]);

  // Retorna cadeia de pais: [Item, Pai, ..., Raiz]
  const getHierarchyArray = useCallback((itemId: string | null | undefined): any[] => {
    if (!itemId) return [];
    const chain: any[] = [];
    let current = itemsMap.get(itemId);
    let depth = 0;

    while (current && depth < 8) {
      chain.push(current);
      if (current.parent_id && itemsMap.has(current.parent_id)) {
        current = itemsMap.get(current.parent_id);
      } else {
        break;
      }
      depth++;
    }

    return chain;
  }, [itemsMap]);

  // Monta a string "Subitem / Item / ... / Item Raiz /"
  const getFullHierarchyTitle = useCallback((it: WorkMeasurementItem): string => {
    let targetItemId = it.work_item_id;
    let baseTitle = it.item_title.replace(/\/+$/, '').trim();

    if (!targetItemId && it.work_task_id && tasksMap.has(it.work_task_id)) {
      const task = tasksMap.get(it.work_task_id);
      targetItemId = task.work_item_id;
      baseTitle = task.title;
    }

    if (it.item_title.includes(' / ') && it.item_title.split(' / ').length > 1) {
      return it.item_title.endsWith('/') ? it.item_title : `${it.item_title} /`;
    }

    if (targetItemId && itemsMap.has(targetItemId)) {
      const chain = getHierarchyArray(targetItemId);
      return [baseTitle, ...chain.map(c => c.title)].join(' / ') + ' /';
    }

    return it.item_title.endsWith('/') ? it.item_title : `${it.item_title} /`;
  }, [itemsMap, tasksMap, getHierarchyArray]);

  // Filtra APONTAMENTOS DIÁRIOS disponíveis dentro do período selecionado e que tenham valor executado maior que 0
  const availableEntriesToMeasure = useMemo(() => {
    if (!bmStartDate || !bmEndDate) return [];
    
    return taskEntries.filter(entry => {
      const entryDate = entry.entry_date;
      const qty = Number(entry.quantity_executed) || 0;
      return entryDate >= bmStartDate && entryDate <= bmEndDate && qty > 0;
    });
  }, [taskEntries, bmStartDate, bmEndDate]);

  // Agrupa os apontamentos disponíveis por Tarefa para visualização amigável
  const groupedEntriesByTask = useMemo(() => {
    const grouped = new Map<string, { task: any, entries: any[], totalQty: number }>();
    
    availableEntriesToMeasure.forEach(entry => {
      const taskId = entry.work_task_id;
      if (!grouped.has(taskId)) {
        grouped.set(taskId, {
          task: tasksMap.get(taskId),
          entries: [],
          totalQty: 0
        });
      }
      const group = grouped.get(taskId)!;
      group.entries.push(entry);
      group.totalQty += Number(entry.quantity_executed);
    });

    return Array.from(grouped.values()).filter(g => g.task);
  }, [availableEntriesToMeasure, tasksMap]);

  // Filtra itens aptos (se a medição for apenas por Item - Fallback Antigo)
  const availableItems = useMemo(() => {
    return workItems.filter(i => {
      const notMeasured = !i.is_measured;
      const hasProgress = Number(i.progress_percent) > 0;
      return notMeasured && hasProgress;
    });
  }, [workItems]);

  const handleOpenCreateBmModal = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    setBmTitle(`Medição referente a ${now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`);
    setBmStartDate(startOfMonth);
    setBmEndDate(today);
    setBmRetention('0');
    setBmNotes('');
    setManualAmount('');

    // Pré-seleciona todos os apontamentos soltos daquele período que têm quantidade > 0
    const initialAvailableEntries = taskEntries.filter(e => {
      const qty = Number(e.quantity_executed) || 0;
      return e.entry_date >= startOfMonth && e.entry_date <= today && qty > 0;
    });
    
    if (measurementType === 'por_subitem') {
      setSelectedEntryIds(initialAvailableEntries.map(e => e.id));
    } else if (measurementType === 'por_item') {
      setSelectedItemIds(availableItems.map(i => i.id));
    }

    setIsCreateBmModalOpen(true);
  };

  // Recalcula a seleção de apontamentos toda vez que a data de filtro mudar no Modal
  useEffect(() => {
    if (isCreateBmModalOpen && measurementType === 'por_subitem') {
      setSelectedEntryIds(availableEntriesToMeasure.map(e => e.id));
    }
  }, [bmStartDate, bmEndDate, isCreateBmModalOpen, measurementType, availableEntriesToMeasure]);

  const computedGrossAmount = useMemo(() => {
    if (measurementType === 'sem_medicao') {
      return parseCurrency(manualAmount);
    }

    if (measurementType === 'por_item') {
      return availableItems
        .filter(item => selectedItemIds.includes(item.id))
        .reduce((acc, item) => {
          const price = Number(item.unit_price) || 0;
          const prog = Number(item.progress_percent) || 0;
          return acc + (price * prog) / 100;
        }, 0);
    }

    // Calcula com base nos APONTAMENTOS DE TAREFAS selecionados
    // CÁLCULO PROPORCIONAL: O preço da tarefa no BD é o Valor Total. Dividimos pelo planejado para achar o preço por unidade (metro, etc).
    return availableEntriesToMeasure
      .filter(entry => selectedEntryIds.includes(entry.id))
      .reduce((acc, entry) => {
        const task = tasksMap.get(entry.work_task_id);
        if (!task) return acc;

        const qty = Number(entry.quantity_executed) || 0;
        const planned = Number(task.quantity_planned) || 1; // Para evitar divisão por zero
        const priceTotal = Number(task.unit_price) || 0;
        const unitPrice = priceTotal / planned;

        return acc + (qty * unitPrice);
      }, 0);
  }, [measurementType, manualAmount, availableItems, selectedItemIds, availableEntriesToMeasure, selectedEntryIds, tasksMap]);

  const computedRetentionAmount = useMemo(() => {
    const retPercent = parseFloat(bmRetention.replace(',', '.')) || 0;
    return (computedGrossAmount * retPercent) / 100;
  }, [computedGrossAmount, bmRetention]);

  const computedNetAmount = useMemo(() => {
    return computedGrossAmount - computedRetentionAmount;
  }, [computedGrossAmount, computedRetentionAmount]);

  const loadMeasurementDetails = async (bm: WorkMeasurement) => {
    setViewingMeasurement(bm);
    try {
      setLoadingItems(true);
      const { data, error } = await supabase
        .from('work_measurement_items')
        .select('*')
        .eq('measurement_id', bm.id);

      if (error) throw error;
      setMeasurementItems(data || []);
    } catch (err) {
      console.error('Erro ao carregar itens da medição:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const kpis = useMemo(() => {
    const totalMeasured = measurements.reduce((acc, m) => acc + (Number(m.total_measured_amount) || 0), 0);
    const totalInvoiced = invoices.reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);
    const totalPaid = invoices
      .filter(inv => inv.status === 'pago')
      .reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);
    const pendingToReceive = invoices
      .filter(inv => inv.status === 'pendente' || inv.status === 'atrasado')
      .reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);

    const balanceToMeasure = Math.max(0, contractAmount - totalMeasured);
    const measuredPercent = contractAmount > 0 ? Math.min(100, Math.round((totalMeasured / contractAmount) * 100)) : 0;

    return {
      contractAmount,
      totalMeasured,
      totalInvoiced,
      totalPaid,
      pendingToReceive,
      balanceToMeasure,
      measuredPercent
    };
  }, [measurements, invoices, contractAmount]);

  const handleCreateMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.company?.id || !bmTitle.trim()) return;

    if (measurementType !== 'sem_medicao' && computedGrossAmount <= 0) {
      alert('Selecione ao menos um apontamento/item para incluir na medição.');
      return;
    }

    try {
      setCreatingBm(true);

      const retentionNum = parseFloat(bmRetention.replace(',', '.')) || 0;
      const nextIndex = measurements.length + 1;
      const bmCode = `BM-${String(nextIndex).padStart(2, '0')}`;

      let itemsToInsert: any[] = [];
      let entryIdsToUpdate: string[] = [];

      if (measurementType === 'por_item') {
        const filtered = availableItems.filter(item => selectedItemIds.includes(item.id));
        filtered.forEach(item => {
          const price = Number(item.unit_price) || 0;
          const prog = Number(item.progress_percent) || 0;
          const itemAmount = (price * prog) / 100;
          const chain = getHierarchyArray(item.id);
          const fullTitle = chain.map(c => c.title).join(' / ') + ' /';

          itemsToInsert.push({
            work_item_id: item.id,
            item_title: fullTitle,
            unit: 'un',
            quantity_planned: 1,
            quantity_executed: prog / 100,
            quantity_measured_period: prog / 100,
            unit_price: price,
            measured_amount: itemAmount,
            progress_percent: prog
          });
        });
      } else if (measurementType === 'por_subitem') {
        // Agrupa os APONTAMENTOS selecionados por Tarefa para consolidar em uma linha no BM
        const selectedEntries = availableEntriesToMeasure.filter(e => selectedEntryIds.includes(e.id));
        entryIdsToUpdate = selectedEntries.map(e => e.id);

        const summarizedByTask = new Map<string, { qty: number, task: any }>();
        
        selectedEntries.forEach(entry => {
          const taskId = entry.work_task_id;
          if (!summarizedByTask.has(taskId)) {
            summarizedByTask.set(taskId, { qty: 0, task: tasksMap.get(taskId) });
          }
          summarizedByTask.get(taskId)!.qty += Number(entry.quantity_executed);
        });

        summarizedByTask.forEach((summary, taskId) => {
          const t = summary.task;
          const qty = summary.qty;
          const planned = Number(t.quantity_planned) || 1;
          
          // O preço no BD é o Total. O Unitário fracionado para salvar na linha da medição será:
          const priceTotal = Number(t.unit_price) || 0;
          const unitPrice = priceTotal / planned;
          const taskAmount = qty * unitPrice;
          
          const chain = getHierarchyArray(t.work_item_id);
          const fullTitle = [t.title, ...chain.map(c => c.title)].join(' / ') + ' /';

          itemsToInsert.push({
            work_item_id: t.work_item_id,
            work_task_id: t.id,
            item_title: fullTitle,
            unit: t.unit || 'un',
            quantity_planned: planned,
            quantity_executed: t.quantity_executed, // Total histórico até agora
            quantity_measured_period: qty, // Total apenas desse BM
            unit_price: unitPrice, // Salvamos o unitário fracionado para a fatura detalhada ficar correta
            measured_amount: taskAmount,
            progress_percent: t.status === 'concluida' ? 100 : (planned > 0 ? (t.quantity_executed / planned) * 100 : 0)
          });
        });
      }

      const { data: createdBm, error: bmError } = await supabase
        .from('work_measurements')
        .insert({
          company_id: user.company.id,
          work_id: workId,
          code: bmCode,
          title: bmTitle.trim(),
          start_date: bmStartDate || new Date().toISOString().split('T')[0],
          end_date: bmEndDate || new Date().toISOString().split('T')[0],
          status: 'aguardando_aprovacao',
          total_measured_amount: computedGrossAmount,
          retention_percent: retentionNum,
          net_amount: computedNetAmount,
          notes: bmNotes.trim() || null
        })
        .select()
        .single();

      if (bmError) throw bmError;

      if (itemsToInsert.length > 0 && createdBm) {
        const payload = itemsToInsert.map(i => ({
          ...i,
          measurement_id: createdBm.id
        }));
        await supabase.from('work_measurement_items').insert(payload);
      }

      if (measurementType === 'por_subitem' && entryIdsToUpdate.length > 0 && createdBm) {
        // Marca exatamente os apontamentos medidos como concluídos na medição
        await supabase
          .from('work_task_entries')
          .update({ is_measured: true, measurement_id: createdBm.id })
          .in('id', entryIdsToUpdate);
      } else if (measurementType === 'por_item' && selectedItemIds.length > 0 && createdBm) {
        await supabase
          .from('work_items')
          .update({ is_measured: true, last_measurement_id: createdBm.id })
          .in('id', selectedItemIds);
      }

      setIsCreateBmModalOpen(false);
      await loadFinancialData();
    } catch (err: any) {
      alert('Erro ao gerar medição: ' + err.message);
    } finally {
      setCreatingBm(false);
    }
  };

  const handleOpenInvoiceFromBm = (bm: WorkMeasurement) => {
    setInvoiceBmId(bm.id);
    setInvoiceDesc(`Fatura Ref. ${bm.code} - ${bm.title}`);
    const netVal = Number(bm.net_amount) || 0;
    setInvoiceAmount(netVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setInvoiceNumber('');
    const d = new Date();
    d.setDate(d.getDate() + 15);
    setInvoiceDueDate(d.toISOString().split('T')[0]);
    setIsInvoiceModalOpen(true);
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.company?.id || !invoiceDesc.trim()) return;

    try {
      setSavingInvoice(true);
      const parsedAmount = parseCurrency(invoiceAmount);
      const nextIdx = invoices.length + 1;
      const fatCode = `FAT-${String(nextIdx).padStart(3, '0')}`;

      const { error } = await supabase
        .from('work_invoices')
        .insert({
          company_id: user.company.id,
          work_id: workId,
          measurement_id: invoiceBmId || null,
          code: fatCode,
          description: invoiceDesc.trim(),
          invoice_number: invoiceNumber.trim() || null,
          amount: parsedAmount,
          due_date: invoiceDueDate || new Date().toISOString().split('T')[0],
          payment_method: invoiceMethod,
          status: 'pendente'
        });

      if (error) throw error;

      if (invoiceBmId) {
        await supabase
          .from('work_measurements')
          .update({ status: 'aprovada' })
          .eq('id', invoiceBmId);
      }

      setIsInvoiceModalOpen(false);
      setActiveSubTab('invoices');
      await loadFinancialData();
    } catch (err: any) {
      alert('Erro ao criar fatura: ' + err.message);
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleMarkInvoiceAsPaid = async (invId: string) => {
    try {
      const { error } = await supabase
        .from('work_invoices')
        .update({
          status: 'pago',
          paid_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', invId);

      if (error) throw error;
      await loadFinancialData();
    } catch (err: any) {
      alert('Erro ao baixar fatura: ' + err.message);
    }
  };

  const getBmStatusBadge = (status: WorkMeasurement['status']) => {
    switch (status) {
      case 'rascunho':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Rascunho</span>;
      case 'aguardando_aprovacao':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Em Aprovação</span>;
      case 'aprovada':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">Aprovada / Faturada</span>;
      case 'paga':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">Paga</span>;
    }
  };

  const getInvoiceStatusBadge = (status: WorkInvoice['status']) => {
    switch (status) {
      case 'pendente':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Aguardando Pagamento</span>;
      case 'pago':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">Recebido / Liquidado</span>;
      case 'atrasado':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">Atrasado</span>;
      case 'cancelado':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">Cancelado</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400 text-xs py-20">
        <Loader2 size={24} className="animate-spin text-sky-600 mb-2" />
        <span className="font-semibold text-slate-600">Sincronizando financeiro da obra...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 select-none pb-4">
      {/* KPIS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Valor do Contrato</span>
          <strong className="text-slate-900 text-base lg:text-lg font-black block">
            {formatCurrency(kpis.contractAmount)}
          </strong>
          <span className="text-[10px] text-slate-500 font-medium">Contrato homologado</span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Medido</span>
            <span className="text-[10px] font-black text-sky-600">{kpis.measuredPercent}%</span>
          </div>
          <strong className="text-sky-900 text-base lg:text-lg font-black block">
            {formatCurrency(kpis.totalMeasured)}
          </strong>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="h-1.5 rounded-full bg-sky-500" style={{ width: `${kpis.measuredPercent}%` }} />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1">
          <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider block flex items-center gap-1">
            <CheckCircle2 size={11} />
            <span>Total Recebido</span>
          </span>
          <strong className="text-emerald-900 text-base lg:text-lg font-black block">
            {formatCurrency(kpis.totalPaid)}
          </strong>
          <span className="text-[10px] text-emerald-600 font-medium">Faturas quitadas</span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1">
          <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider block flex items-center gap-1">
            <Clock size={11} />
            <span>A Receber / Faturar</span>
          </span>
          <strong className="text-amber-900 text-base lg:text-lg font-black block">
            {formatCurrency(kpis.pendingToReceive)}
          </strong>
          <span className="text-[10px] text-amber-600 font-medium">Faturas em aberto</span>
        </div>
      </div>

      {/* SUB-ABAS */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-1">
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveSubTab('measurements')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'measurements' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt size={14} />
            <span>Boletins de Medição ({measurements.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('invoices')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'invoices' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard size={14} />
            <span>Faturamento & Contas a Receber ({invoices.length})</span>
          </button>
        </div>

        <div>
          {activeSubTab === 'measurements' ? (
            <button
              type="button"
              onClick={handleOpenCreateBmModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Nova Medição</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setInvoiceBmId(null);
                setInvoiceDesc('Fatura Avulsa de Obra');
                setInvoiceAmount('');
                setInvoiceNumber('');
                setInvoiceDueDate(new Date().toISOString().split('T')[0]);
                setIsInvoiceModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Nova Fatura</span>
            </button>
          )}
        </div>
      </div>

      {/* CONTEÚDO ATIVO */}
      {activeSubTab === 'measurements' ? (
        <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto">
            {measurements.length === 0 ? (
              <div className="p-16 text-center text-xs text-slate-400 space-y-3">
                <Receipt size={32} className="mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700">Nenhum boletim de medição emitido.</p>
                <p className="text-slate-400 max-w-sm mx-auto">
                  Clique em "Nova Medição" para consolidar o avanço físico e gerar o documento de aprovação técnica.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Descrição do Boletim</th>
                    <th className="py-3 px-4">Período</th>
                    <th className="py-3 px-4">Valor Bruto</th>
                    <th className="py-3 px-4">Retenção</th>
                    <th className="py-3 px-4">Líquido</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {measurements.map(bm => (
                    <tr
                      key={bm.id}
                      onClick={() => loadMeasurementDetails(bm)}
                      className="hover:bg-slate-50/70 transition cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-sky-700">{bm.code}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{bm.title}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(bm.start_date + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(bm.end_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {formatCurrency(Number(bm.total_measured_amount) || 0)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {bm.retention_percent > 0 ? `${bm.retention_percent}%` : '—'}
                      </td>
                      <td className="py-3 px-4 font-black text-emerald-800">
                        {formatCurrency(Number(bm.net_amount) || 0)}
                      </td>
                      <td className="py-3 px-4">{getBmStatusBadge(bm.status)}</td>
                      <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {bm.status === 'aguardando_aprovacao' && (
                            <button
                              type="button"
                              onClick={() => handleOpenInvoiceFromBm(bm)}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              title="Aprovar medição e gerar fatura de cobrança"
                            >
                              <ArrowUpRight size={12} />
                              <span>Faturar</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => loadMeasurementDetails(bm)}
                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                            title="Visualizar espelho da medição"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto">
            {invoices.length === 0 ? (
              <div className="p-16 text-center text-xs text-slate-400 space-y-3">
                <CreditCard size={32} className="mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700">Nenhuma fatura gerada para esta obra.</p>
                <p className="text-slate-400 max-w-sm mx-auto">
                  Aprove uma medição com o botão "Faturar" ou crie uma fatura avulsa para acompanhar os pagamentos do cliente.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Descrição da Fatura</th>
                    <th className="py-3 px-4">NF-e / Recibo</th>
                    <th className="py-3 px-4">Vencimento</th>
                    <th className="py-3 px-4">Forma</th>
                    <th className="py-3 px-4">Valor Líquido</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{inv.code}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{inv.description}</td>
                      <td className="py-3 px-4 font-medium text-slate-600">
                        {inv.invoice_number ? (
                          <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-[10px] border border-slate-200">
                            {inv.invoice_number}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {new Date(inv.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 uppercase text-[10px] text-slate-500 font-bold">
                        {inv.payment_method || 'Boleto'}
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900 text-sm">
                        {formatCurrency(Number(inv.amount) || 0)}
                      </td>
                      <td className="py-3 px-4">{getInvoiceStatusBadge(inv.status)}</td>
                      <td className="py-3 px-4 text-right">
                        {inv.status !== 'pago' ? (
                          <button
                            type="button"
                            onClick={() => handleMarkInvoiceAsPaid(inv.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold shadow-2xs cursor-pointer flex items-center gap-1 ml-auto"
                            title="Confirmar recebimento / Dar baixa"
                          >
                            <Check size={11} />
                            <span>Dar Baixa</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Liquidada em {inv.paid_date ? new Date(inv.paid_date + 'T00:00:00').toLocaleDateString('pt-BR') : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CRIAR NOVO BOLETIM */}
      {isCreateBmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-3xl w-full shadow-2xl space-y-4 max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <FileCheck2 size={18} className="text-sky-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Novo Boletim de Medição</h3>
                  <span className="text-[11px] text-slate-400">
                    Tipo de medição: <strong>{measurementType === 'por_subitem' ? 'Por Tarefa / Subitem' : measurementType === 'por_item' ? 'Por Item' : 'Sem Medição (Direta)'}</strong>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateBmModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateMeasurement} className="space-y-4 text-xs flex-1 flex flex-col min-h-0">
              <div className="shrink-0 space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Título do Boletim *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Medição 01 - Montagem Estrutural"
                    value={bmTitle}
                    onChange={e => setBmTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Início do Período</label>
                    <input
                      type="date"
                      required
                      value={bmStartDate}
                      onChange={e => setBmStartDate(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Fim do Período</label>
                    <input
                      type="date"
                      required
                      value={bmEndDate}
                      onChange={e => setBmEndDate(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Retenção Contratual (%)</label>
                    <input
                      type="text"
                      placeholder="0"
                      value={bmRetention}
                      onChange={e => setBmRetention(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* LISTAGEM DE ITENS (APONTAMENTOS) */}
              <div className="flex-1 min-h-0 flex flex-col border border-slate-200 rounded-2xl p-3 bg-slate-50/50">
                {measurementType === 'por_subitem' ? (
                  <>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">Apontamentos Realizados no Período</span>
                        <span className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {selectedEntryIds.length} de {availableEntriesToMeasure.length} selecionados
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedEntryIds(availableEntriesToMeasure.map(t => t.id))}
                          className="text-[11px] font-bold text-sky-600 hover:text-sky-700 cursor-pointer"
                        >
                          Selecionar Todos
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedEntryIds([])}
                          className="text-[11px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                        >
                          Desmarcar Todos
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {availableEntriesToMeasure.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                          Nenhum apontamento com avanço faturável no período selecionado.
                        </div>
                      ) : (
                        availableEntriesToMeasure.map(entry => {
                          const task = tasksMap.get(entry.work_task_id);
                          if (!task) return null;

                          const isChecked = selectedEntryIds.includes(entry.id);
                          const qty = Number(entry.quantity_executed) || 0;
                          
                          // Cálculo do Preço Unitário Proporcional
                          const planned = Number(task.quantity_planned) || 1;
                          const priceTotal = Number(task.unit_price) || 0;
                          const unitPrice = priceTotal / planned;
                          const total = qty * unitPrice;
                          
                          const chain = getHierarchyArray(task.work_item_id);

                          return (
                            <label
                              key={entry.id}
                              className={`flex items-start justify-between p-3 rounded-xl border transition cursor-pointer gap-3 ${
                                isChecked ? 'bg-sky-50/70 border-sky-300' : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={e => {
                                    if (e.target.checked) setSelectedEntryIds([...selectedEntryIds, entry.id]);
                                    else setSelectedEntryIds(selectedEntryIds.filter(id => id !== entry.id));
                                  }}
                                  className="mt-1 rounded text-sky-600 focus:ring-sky-500"
                                />
                                <div className="space-y-1">
                                  <div className="text-xs">
                                    <strong className="text-slate-900 font-black">{task.title}</strong>
                                    <span className="text-slate-300 mx-1">/</span>
                                    {chain.map((n, idx) => (
                                      <React.Fragment key={n.id}>
                                        <span className={idx === 0 ? 'text-slate-900 font-black' : 'text-slate-500 font-semibold'}>
                                          {n.title}
                                        </span>
                                        <span className="text-slate-300 mx-1">/</span>
                                      </React.Fragment>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] font-medium">
                                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                      Data: {new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                    </span>
                                    {entry.executed_by && entry.executed_by.length > 0 && (
                                      <span className="text-slate-400">
                                        Equipe: {entry.executed_by.join(', ')}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                    <span>Valor Total Planejado: {formatCurrency(priceTotal)}</span>
                                    <span className="text-slate-300">|</span>
                                    <span className="text-sky-700 font-semibold">Valor Unitário: {formatCurrency(unitPrice)} /{task.unit || 'un'}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right shrink-0 flex flex-col items-end justify-center gap-1">
                                <div className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  {qty} {task.unit || 'un'}
                                </div>
                                <strong className="text-slate-900 font-black text-xs">
                                  {formatCurrency(total)}
                                </strong>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : measurementType === 'por_item' ? (
                  <>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">Itens com Avanço Pendentes</span>
                        <span className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {selectedItemIds.length} de {availableItems.length} selecionados
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedItemIds(availableItems.map(i => i.id))}
                          className="text-[11px] font-bold text-sky-600 hover:text-sky-700 cursor-pointer"
                        >
                          Selecionar Todos
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedItemIds([])}
                          className="text-[11px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                        >
                          Desmarcar Todos
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {availableItems.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                          Nenhum item com avanço pendente de medição encontrado.
                        </div>
                      ) : (
                        availableItems.map(item => {
                          const isChecked = selectedItemIds.includes(item.id);
                          const price = Number(item.unit_price) || 0;
                          const prog = Number(item.progress_percent) || 0;
                          const total = (price * prog) / 100;
                          const chain = getHierarchyArray(item.id);

                          return (
                            <label
                              key={item.id}
                              className={`flex items-start justify-between p-3 rounded-xl border transition cursor-pointer gap-3 ${
                                isChecked ? 'bg-sky-50/70 border-sky-300' : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={e => {
                                    if (e.target.checked) setSelectedItemIds([...selectedItemIds, item.id]);
                                    else setSelectedItemIds(selectedItemIds.filter(id => id !== item.id));
                                  }}
                                  className="mt-1 rounded text-sky-600 focus:ring-sky-500"
                                />
                                <div className="space-y-0.5">
                                  <div className="text-xs">
                                    {chain.map((n, idx) => (
                                      <React.Fragment key={n.id}>
                                        <span className={idx === 0 ? 'text-slate-900 font-black' : 'text-slate-500 font-semibold'}>
                                          {n.title}
                                        </span>
                                        <span className="text-slate-300 mx-1">/</span>
                                      </React.Fragment>
                                    ))}
                                  </div>
                                  <span className="text-[10px] text-slate-400 block">
                                    Progresso: {prog}% | Preço: {formatCurrency(price)}
                                  </span>
                                </div>
                              </div>
                              <strong className="text-slate-900 font-black text-xs shrink-0 pt-0.5">
                                {formatCurrency(total)}
                              </strong>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : (
                  <div className="m-auto w-full max-w-sm space-y-2">
                    <label className="block font-semibold text-slate-700">Valor Bruto da Medição (R$) *</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 font-bold text-slate-400">R$</span>
                      <input
                        type="text"
                        required
                        placeholder="0,00"
                        value={manualAmount}
                        onChange={e => setManualAmount(maskCurrencyInput(e.target.value))}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-black text-slate-900 text-base focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* TOTAIS */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-100 rounded-xl shrink-0">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Bruto</span>
                  <strong className="text-slate-900 text-sm font-black">{formatCurrency(computedGrossAmount)}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-amber-700 uppercase block">Retenção ({bmRetention}%)</span>
                  <strong className="text-amber-800 text-sm font-black">{formatCurrency(computedRetentionAmount)}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase block">Total Líquido</span>
                  <strong className="text-emerald-900 text-sm font-black">{formatCurrency(computedNetAmount)}</strong>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateBmModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingBm || !bmTitle.trim()}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {creatingBm ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Calcular & Gerar Medição</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVA FATURA */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {invoiceBmId ? 'Emitir Fatura de Medição' : 'Nova Fatura / Cobrança'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição da Fatura *</label>
                <input
                  type="text"
                  required
                  value={invoiceDesc}
                  onChange={e => setInvoiceDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor a Cobrar (R$) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 font-bold text-slate-400">R$</span>
                    <input
                      type="text"
                      required
                      placeholder="0,00"
                      value={invoiceAmount}
                      onChange={e => setInvoiceAmount(maskCurrencyInput(e.target.value))}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={invoiceDueDate}
                    onChange={e => setInvoiceDueDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nº da Nota Fiscal / Recibo</label>
                  <input
                    type="text"
                    placeholder="Ex: NF-00432"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Forma de Pagamento</label>
                  <select
                    value={invoiceMethod}
                    onChange={e => setInvoiceMethod(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold cursor-pointer"
                  >
                    <option value="boleto">Boleto Bancário</option>
                    <option value="pix">Chave PIX</option>
                    <option value="transferencia">Transferência / TED</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingInvoice || !invoiceDesc.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingInvoice ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Confirmar & Emitir Fatura</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ESPELHO / DETALHE DO BOLETIM */}
      {viewingMeasurement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            
            <div className="flex items-start justify-between pb-3 border-b border-slate-200 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-md">
                    {viewingMeasurement.code}
                  </span>
                  {getBmStatusBadge(viewingMeasurement.status)}
                </div>
                <h3 className="text-base font-bold text-slate-900">{viewingMeasurement.title}</h3>
                <span className="text-xs text-slate-500 block">
                  Período: {new Date(viewingMeasurement.start_date + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(viewingMeasurement.end_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setViewingMeasurement(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs shrink-0">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Valor Medido Bruto</span>
                <strong className="text-slate-900 text-sm font-black">
                  {formatCurrency(Number(viewingMeasurement.total_measured_amount) || 0)}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Retenção ({viewingMeasurement.retention_percent}%)</span>
                <strong className="text-amber-800 text-sm font-bold">
                  {formatCurrency((Number(viewingMeasurement.total_measured_amount) * Number(viewingMeasurement.retention_percent)) / 100)}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-emerald-700 font-bold uppercase block">Valor Líquido da Fatura</span>
                <strong className="text-emerald-900 text-sm font-black">
                  {formatCurrency(Number(viewingMeasurement.net_amount) || 0)}
                </strong>
              </div>
            </div>

            {viewingMeasurement.notes && (
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs text-amber-900 shrink-0">
                <span className="font-bold block text-[10px] uppercase tracking-wider text-amber-700">Observações:</span>
                <p className="mt-0.5">{viewingMeasurement.notes}</p>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 rounded-xl">
              {loadingItems ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  <Loader2 size={16} className="animate-spin mx-auto mb-2 text-sky-600" />
                  Carregando itens do boletim...
                </div>
              ) : measurementItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nenhum item com valor apurado neste período.
                </div>
              ) : (
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-700 uppercase sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Subitem / Item / Item Raiz</th>
                      <th className="py-2.5 px-3">Unid</th>
                      <th className="py-2.5 px-3">Preço Unit.</th>
                      <th className="py-2.5 px-3 text-right">Apurado Período</th>
                      <th className="py-2.5 px-3 text-right">Total Medido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {measurementItems.map(it => {
                      const fullTitle = getFullHierarchyTitle(it);
                      const parts = fullTitle.split(' / ').filter(Boolean);

                      return (
                        <tr key={it.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 px-3">
                            <div className="text-xs">
                              {parts.map((p, idx) => (
                                <React.Fragment key={idx}>
                                  <span className={idx === 0 ? 'text-slate-900 font-black' : 'text-slate-500 font-semibold'}>
                                    {p}
                                  </span>
                                  <span className="text-slate-300 mx-1">/</span>
                                </React.Fragment>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">{it.unit}</td>
                          <td className="py-2.5 px-3">{formatCurrency(Number(it.unit_price) || 0)}</td>
                          <td className="py-2.5 px-3 font-semibold text-sky-700 text-right">{it.quantity_measured_period}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 text-right">
                            {formatCurrency(Number(it.measured_amount) || 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {viewingMeasurement.status === 'aguardando_aprovacao' ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenInvoiceFromBm(viewingMeasurement);
                      setViewingMeasurement(null);
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Receipt size={13} />
                    <span>Aprovar & Gerar Fatura</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setViewingMeasurement(null);
                      setActiveSubTab('invoices');
                    }}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-200"
                  >
                    <Receipt size={13} className="text-sky-600" />
                    <span>Ver Faturas Deste Boletim</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Printer size={13} />
                  <span>Imprimir / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingMeasurement(null)}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: FOLHA TIMBRADA DO BOLETIM */}
      {isPrintModalOpen && viewingMeasurement && (
        <WorkMeasurementPrintView
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          measurement={viewingMeasurement}
          workId={workId}
          contractAmount={kpis.contractAmount}
        />
      )}
    </div>
  );
};

export default WorkFinancialTab;