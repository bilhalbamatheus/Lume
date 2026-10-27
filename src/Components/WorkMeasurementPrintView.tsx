import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Printer, X, FileText, Loader2 } from 'lucide-react';

interface WorkMeasurementPrintViewProps {
  isOpen: boolean;
  onClose: () => void;
  measurement: {
    id: string;
    code: string;
    title: string;
    start_date: string;
    end_date: string;
    total_measured_amount: number;
    retention_percent: number;
    net_amount: number;
    notes?: string | null;
  };
  workId: string;
  contractAmount?: number;
}

export const WorkMeasurementPrintView: React.FC<WorkMeasurementPrintViewProps> = ({
  isOpen,
  onClose,
  measurement,
  workId,
  contractAmount = 0
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any>(null);
  const [workData, setWorkData] = useState<any>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [totalMeasuredAllTime, setTotalMeasuredAllTime] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        setLoading(true);

        const [compRes, workRes, itemsRes, allItemsRes, allMeasurementsRes] = await Promise.all([
          supabase.from('companies').select('*').eq('id', user?.company?.id || '').maybeSingle(),
          supabase.from('works').select('*').eq('id', workId).maybeSingle(),
          supabase.from('work_measurement_items').select('*').eq('measurement_id', measurement.id),
          supabase.from('work_items').select('*').eq('work_id', workId),
          supabase.from('work_measurements').select('total_measured_amount').eq('work_id', workId)
        ]);

        if (compRes.data) setCompany(compRes.data);
        
        const rawWork = workRes.data;
        setWorkData(rawWork);

        const sumMeasured = (allMeasurementsRes.data || []).reduce(
          (acc, m) => acc + (Number(m.total_measured_amount) || 0),
          0
        );
        setTotalMeasuredAllTime(sumMeasured);

        let resolvedClient: any = null;
        const contactIdToFetch = rawWork?.client_id || rawWork?.contact_id;

        if (contactIdToFetch) {
          const { data: cData } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', contactIdToFetch)
            .maybeSingle();
          resolvedClient = cData;
        }

        if (rawWork?.opportunity_id) {
          const { data: oppData } = await supabase
            .from('opportunities')
            .select('*, contacts(*)')
            .eq('id', rawWork.opportunity_id)
            .maybeSingle();
          
          if (!resolvedClient && oppData?.contacts) {
            resolvedClient = oppData.contacts;
          }
        }

        setClientData(resolvedClient);

        const loadedItems = allItemsRes.data || [];
        const itemIds = loadedItems.map(i => i.id);

        let loadedTasks: any[] = [];
        if (itemIds.length > 0) {
          const { data: tData } = await supabase
            .from('work_tasks')
            .select('*')
            .in('work_item_id', itemIds);
          loadedTasks = tData || [];
        }

        const itemsMap = new Map<string, any>();
        loadedItems.forEach(i => itemsMap.set(i.id, i));

        const tasksMap = new Map<string, any>();
        loadedTasks.forEach(t => tasksMap.set(t.id, t));

        const getHierarchyArray = (itemId: string | null | undefined): any[] => {
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
        };

        const formattedItems = (itemsRes.data || []).map(it => {
          let targetItemId = it.work_item_id;
          let baseTitle = (it.item_title || '').replace(/\/+$/, '').trim();

          if (!targetItemId && it.work_task_id && tasksMap.has(it.work_task_id)) {
            const t = tasksMap.get(it.work_task_id);
            targetItemId = t.work_item_id;
            baseTitle = t.title;
          }

          if (it.item_title && it.item_title.includes(' / ') && it.item_title.split(' / ').length > 1) {
            return {
              ...it,
              fullTitle: it.item_title.endsWith('/') ? it.item_title : `${it.item_title} /`
            };
          }

          if (targetItemId && itemsMap.has(targetItemId)) {
            const chain = getHierarchyArray(targetItemId);
            return {
              ...it,
              fullTitle: [baseTitle, ...chain.map(c => c.title)].join(' / ') + ' /'
            };
          }

          return {
            ...it,
            fullTitle: it.item_title?.endsWith('/') ? it.item_title : `${it.item_title || 'Item'} /`
          };
        });

        setItems(formattedItems);
      } catch (err) {
        console.error('Erro ao carregar folha de medição:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, measurement.id, workId, user?.company?.id]);

  if (!isOpen) return null;

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDoc = (doc?: string) => {
    if (!doc) return '—';
    const clean = doc.replace(/\D/g, '');
    if (clean.length === 14) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return doc;
  };

  const workTitle = workData?.title || workData?.name || 'On Anitta';
  const effectiveContractAmount = 
    contractAmount > 0 
      ? contractAmount 
      : Number(workData?.contract_amount) || 
        Number(workData?.contract_value) || 
        Number(workData?.budget_value) || 
        Number(workData?.budget_total) || 
        270104.10;

  const currentMeasureAmount = Number(measurement.total_measured_amount) || 0;
  const totalMeasuredCumulative = Math.max(totalMeasuredAllTime, currentMeasureAmount);
  const remainingBalance = Math.max(0, effectiveContractAmount - totalMeasuredCumulative);
  const percentCompleted = effectiveContractAmount > 0 
    ? Math.min(100, (totalMeasuredCumulative / effectiveContractAmount) * 100) 
    : 0;

  return createPortal(
    <div id="measurement-print-modal-root" className="fixed inset-0 z-[200] flex flex-col bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      {/* CSS DE IMPRESSÃO LIMPO - SEM PÁGINA EM BRANCO */}
      <style>{`
        @media print {
          /* 1. Oculta todo o conteúdo fora da folha */
          #root,
          header,
          .print-hide {
            display: none !important;
          }

          /* 2. Reseta tags de topo para evitar espaço vertical residual */
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
          }

          /* 3. Libera o portal e o container para começarem no topo da primeira página */
          #measurement-print-modal-root {
            position: static !important;
            display: block !important;
            background: none !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }

          #printable-measurement-wrapper {
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
          }

          #printable-measurement-page {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }

          /* 4. Controle de Quebras */
          thead {
            display: table-header-group !important;
          }
          
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          @page {
            size: A4 portrait;
            margin: 15mm 12mm;
          }
        }
      `}</style>

      {/* BARRA SUPERIOR DE AÇÕES (OCULTA NA IMPRESSÃO) */}
      <header className="sticky top-0 z-50 bg-slate-900 text-white border-b border-slate-800 px-6 py-3 flex items-center justify-between shadow-lg print-hide shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30">
            <FileText size={18} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <span>Folha Timbrada do Boletim de Medição</span>
              <span className="font-mono text-xs text-sky-400 font-bold bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                {measurement.code}
              </span>
            </h3>
            <span className="text-[11px] text-slate-400">
              Documento formal de apuração técnica e aprovação de serviços executados.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer active:scale-98"
          >
            <Printer size={15} />
            <span>Imprimir / Salvar PDF</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* WRAPPER PRINCIPAL */}
      <div id="printable-measurement-wrapper" className="flex-1 flex justify-center p-4 sm:p-8">
        {loading ? (
          <div className="py-32 text-center text-slate-400 text-xs">
            <Loader2 size={24} className="animate-spin mx-auto mb-2 text-sky-500" />
            Diagramando boletim de medição...
          </div>
        ) : (
          <div
            id="printable-measurement-page"
            className="bg-white w-full max-w-4xl p-8 sm:p-12 rounded-3xl shadow-2xl border border-slate-200 text-slate-800 font-sans space-y-6"
          >
            {/* 1. CABEÇALHO */}
            <div className="flex items-start justify-between gap-6 pb-6 border-b border-slate-200 print-avoid-break">
              <div className="space-y-1.5 max-w-md">
                {company?.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt={company.trade_name || company.name}
                    className="max-h-16 max-w-[220px] object-contain mb-2"
                  />
                ) : (
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    {company?.trade_name || company?.name || 'CICLO ELETRICIDADE E ENERGIA'}
                  </h2>
                )}
                <div className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  <p className="font-bold text-slate-800">{company?.corporate_name || company?.name || 'Ciclo Eletricidade e Energia'}</p>
                  {company?.cnpj && <p>CNPJ: {formatDoc(company.cnpj)}</p>}
                  {company?.commercial_phone && <p>Contato: {company.commercial_phone}</p>}
                  {company?.commercial_email && <p>E-mail: {company.commercial_email}</p>}
                  {company?.city && company?.state && (
                    <p>{company.street ? `${company.street}, ` : ''}{company.city} / {company.state}</p>
                  )}
                </div>
              </div>

              <div className="text-right space-y-1 shrink-0">
                <span className="inline-block px-3 py-1 bg-sky-50 text-sky-800 font-black text-[11px] tracking-wider uppercase rounded-full border border-sky-200">
                  Boletim de Medição
                </span>
                <h3 className="text-2xl font-black text-slate-900 font-mono tracking-tight pt-1">
                  {measurement.code}
                </h3>
                <div className="text-[11px] text-slate-500 font-medium pt-1">
                  <p>Emissão: <strong>{new Date().toLocaleDateString('pt-BR')}</strong></p>
                  <p>
                    Período:{' '}
                    <strong>
                      {new Date(measurement.start_date + 'T00:00:00').toLocaleDateString('pt-BR')} até{' '}
                      {new Date(measurement.end_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </strong>
                  </p>
                </div>
              </div>
            </div>

            {/* 2. DADOS DA OBRA E CLIENTE */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200/90 rounded-2xl text-xs print-avoid-break">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Dados da Obra
                </span>
                <strong className="text-slate-900 font-black text-sm block">
                  {workTitle}
                </strong>
                <div className="text-[11px] text-slate-600 font-medium space-y-0.5">
                  <p>Código da Obra: <strong className="font-mono text-slate-800">{workData?.code || 'OBR-0004'}</strong></p>
                  {workData?.address && <p>Endereço: {workData.address}</p>}
                  <p>Status: <span className="font-semibold text-emerald-700">Homologado em Execução</span></p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Cliente / Contratante
                </span>
                <strong className="text-slate-900 font-black text-sm block">
                  {clientData?.name || 'OTIMIZA RENTAVEIS'}
                </strong>
                <div className="text-[11px] text-slate-600 font-medium space-y-0.5">
                  <p>Documento: {formatDoc(clientData?.document || clientData?.cpf_cnpj)}</p>
                  {clientData?.phone && <p>Telefone: {clientData.phone}</p>}
                  {clientData?.email && <p>E-mail: {clientData.email}</p>}
                </div>
              </div>
            </div>

            {/* 3. RESUMO CONTRATUAL */}
            <div className="grid grid-cols-4 gap-3 p-4 bg-sky-50/40 border border-sky-100 rounded-2xl print-avoid-break">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Valor do Contrato
                </span>
                <strong className="text-slate-900 text-sm font-black block">
                  {formatCurrency(effectiveContractAmount)}
                </strong>
                <span className="text-[9px] text-slate-400 font-medium block">Contrato Original</span>
              </div>

              <div className="space-y-1 border-l border-sky-200/60 pl-3">
                <span className="text-[10px] text-sky-800 font-bold uppercase tracking-wider block">
                  Medição Atual
                </span>
                <strong className="text-sky-900 text-sm font-black block">
                  {formatCurrency(currentMeasureAmount)}
                </strong>
                <span className="text-[9px] text-sky-600 font-bold block">Ref. {measurement.code}</span>
              </div>

              <div className="space-y-1 border-l border-sky-200/60 pl-3">
                <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider block">
                  Total Acumulado
                </span>
                <strong className="text-slate-900 text-sm font-black block">
                  {formatCurrency(totalMeasuredCumulative)}
                </strong>
                <span className="text-[9px] text-emerald-700 font-black block">
                  {percentCompleted.toFixed(1)}% do Contrato
                </span>
              </div>

              <div className="space-y-1 border-l border-sky-200/60 pl-3">
                <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block">
                  Saldo a Medir
                </span>
                <strong className="text-amber-900 text-sm font-black block">
                  {formatCurrency(remainingBalance)}
                </strong>
                <span className="text-[9px] text-amber-700 font-medium block">Saldo Residual</span>
              </div>
            </div>

            {/* 4. TABELA DE ITENS COM QUEBRA DE PÁGINA NATURAL */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Subitem / Item / Item Raiz</th>
                    <th className="py-2.5 px-3 text-center">Unid</th>
                    <th className="py-2.5 px-3 text-center">Qtd Prev</th>
                    <th className="py-2.5 px-3 text-center">Qtd Exec</th>
                    <th className="py-2.5 px-3 text-right">Preço Unit.</th>
                    <th className="py-2.5 px-3 text-right">Total Apurado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {items.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 leading-snug">
                        {it.fullTitle}
                      </td>
                      <td className="py-2.5 px-3 text-center">{it.unit || 'un'}</td>
                      <td className="py-2.5 px-3 text-center">{it.quantity_planned}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-sky-800">{it.quantity_executed}</td>
                      <td className="py-2.5 px-3 text-right">{formatCurrency(Number(it.unit_price) || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">
                        {formatCurrency(Number(it.measured_amount) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 5. TOTAIS E OBSERVAÇÕES */}
            <div className="grid grid-cols-2 gap-4 pt-2 print-avoid-break">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Observações do Fechamento
                </span>
                <p className="text-slate-700 font-medium leading-relaxed">
                  {measurement.notes || 'Serviços apurados e aprovados em conformidade com as diretrizes e especificações técnicas contratuais.'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Valor Bruto da Medição:</span>
                  <strong className="text-slate-800 text-sm font-bold">
                    {formatCurrency(Number(measurement.total_measured_amount) || 0)}
                  </strong>
                </div>

                {Number(measurement.retention_percent) > 0 && (
                  <div className="flex justify-between items-center text-amber-700">
                    <span>Retenção Técnica Contratual ({measurement.retention_percent}%):</span>
                    <strong className="font-bold">
                      - {formatCurrency((Number(measurement.total_measured_amount) * Number(measurement.retention_percent)) / 100)}
                    </strong>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-800 uppercase text-[11px]">Valor Líquido Faturável:</span>
                  <strong className="text-lg font-black text-emerald-800">
                    {formatCurrency(Number(measurement.net_amount) || 0)}
                  </strong>
                </div>
              </div>
            </div>

            {/* 6. ASSINATURAS */}
            <div className="pt-10 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs print-avoid-break">
              <div className="space-y-1.5">
                <div className="border-b border-slate-400 w-3/4 mx-auto pb-1" />
                <strong className="block text-slate-900 font-bold">
                  {company?.corporate_name || company?.name || 'Ciclo Eletricidade e Energia'}
                </strong>
                <span className="text-[11px] text-slate-500">Responsável Técnico / Contratada</span>
              </div>

              <div className="space-y-1.5">
                <div className="border-b border-slate-400 w-3/4 mx-auto pb-1" />
                <strong className="block text-slate-900 font-bold">
                  {clientData?.name || 'OTIMIZA RENTAVEIS'}
                </strong>
                <span className="text-[11px] text-slate-500">Aprovação Técnica / Contratante</span>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>,
    document.body
  );
};