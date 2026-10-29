import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  Printer,
  Loader2,
  Clock,
  CreditCard,
  Phone,
  Mail,
  FileText
} from 'lucide-react';

interface QuotePrintViewProps {
  quoteId: string;
  opportunityId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface QuotePrintData {
  id: string;
  code?: string | null;
  quote_number: number;
  title: string;
  total_value: number;
  discount_value: number;
  discount_type: 'currency' | 'percent';
  payment_terms?: string | null;
  delivery_deadline?: string | null;
  validity_days: number;
  notes?: string | null;
  created_at: string;
}

interface CompanyData {
  name: string;
  trade_name?: string | null;
  corporate_name?: string | null;
  cnpj?: string | null;
  document?: string | null;
  state_registration?: string | null;
  commercial_email?: string | null;
  commercial_phone?: string | null;
  logo_url?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
}

interface ContactData {
  id?: string;
  display_name: string;
  type?: 'person' | 'company' | string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

interface QuoteItemLine {
  id: string;
  name: string;
  item_type: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string | null;
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

export const QuotePrintView: React.FC<QuotePrintViewProps> = ({
  quoteId,
  opportunityId,
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [quote, setQuote] = useState<QuotePrintData | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [contact, setContact] = useState<ContactData | null>(null);
  const [items, setItems] = useState<QuoteItemLine[]>([]);

  useEffect(() => {
    if (isOpen && quoteId) {
      loadPrintData();
    } else {
      setQuote(null);
      setCompany(null);
      setContact(null);
      setItems([]);
    }
  }, [isOpen, quoteId, opportunityId]);

  const loadPrintData = async () => {
    try {
      setLoading(true);

      // 1. Carrega dados do orçamento
      const { data: qData, error: qErr } = await supabase
        .from('opportunity_quotes')
        .select(`
          id, 
          code, 
          quote_number, 
          title, 
          total_value, 
          discount_value, 
          discount_type, 
          payment_terms, 
          delivery_deadline, 
          validity_days, 
          notes, 
          created_at, 
          company_id,
          opportunity_id
        `)
        .eq('id', quoteId)
        .single();

      if (qErr) throw qErr;
      setQuote(qData);

      const targetOppId = opportunityId || qData.opportunity_id;

      // 2. Busca o contact_id da oportunidade diretamente sem join problemático
      let rawContactId: string | null = null;
      if (targetOppId) {
        const { data: oppData } = await supabase
          .from('opportunities')
          .select('contact_id')
          .eq('id', targetOppId)
          .maybeSingle();

        rawContactId = oppData?.contact_id || null;
      }

      // 3. Busca o contato
      if (rawContactId) {
        const { data: cRow } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', rawContactId)
          .maybeSingle();

        if (cRow) {
          let contactPhone = cRow.phone || cRow.mobile_phone || cRow.whatsapp || null;
          let contactEmail = cRow.email || null;

          if (!contactPhone) {
            const { data: phones } = await supabase
              .from('contact_phones')
              .select('phone_number')
              .eq('contact_id', rawContactId)
              .limit(1);
            contactPhone = phones?.[0]?.phone_number || null;
          }

          if (!contactEmail) {
            const { data: emails } = await supabase
              .from('contact_emails')
              .select('email')
              .eq('contact_id', rawContactId)
              .limit(1);
            contactEmail = emails?.[0]?.email || null;
          }

          let fullAddress = '';
          if (cRow.street || cRow.city) {
            fullAddress = `${cRow.street || ''}${cRow.number ? `, ${cRow.number}` : ''}${cRow.neighborhood ? ` - ${cRow.neighborhood}` : ''}${cRow.city ? ` - ${cRow.city}` : ''}${cRow.state ? `/${cRow.state}` : ''}`;
          } else {
            const { data: addrs } = await supabase
              .from('contact_addresses')
              .select('street, number, neighborhood, city, state')
              .eq('contact_id', rawContactId)
              .limit(1);

            if (addrs?.[0]) {
              const a = addrs[0];
              fullAddress = `${a.street || ''}${a.number ? `, ${a.number}` : ''}${a.neighborhood ? ` - ${a.neighborhood}` : ''}${a.city ? ` - ${a.city}` : ''}${a.state ? `/${a.state}` : ''}`;
            }
          }

          setContact({
            id: rawContactId,
            display_name: cRow.display_name || cRow.name || cRow.corporate_name || 'Cliente',
            type: cRow.type || 'person',
            document: cRow.document || cRow.cnpj || cRow.cpf || null,
            phone: contactPhone,
            email: contactEmail,
            address: fullAddress.trim() || null
          });
        }
      }

      // 4. Busca dados da empresa
      const companyId = qData.company_id || user?.company?.id;
      if (companyId) {
        const { data: compData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', companyId)
          .maybeSingle();

        if (compData) {
          setCompany(compData);
        }
      }

      // 5. Busca itens da proposta
      const { data: lineItems } = await supabase
        .from('opportunity_quote_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sort_order', { ascending: true });

      if (lineItems) {
        setItems(
          lineItems.map((li) => ({
            id: li.id,
            name: li.name || li.description || 'Item sem descrição',
            item_type: li.item_type || 'equipamento',
            unit: li.unit || 'un',
            quantity: Number(li.quantity) || 1,
            unit_price: Number(li.unit_price) || 0,
            total_price: (Number(li.quantity) || 1) * (Number(li.unit_price) || 0),
            notes: li.notes
          }))
        );
      }
    } catch (err: any) {
      console.error('Erro ao carregar folha timbrada:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const subtotalBruto = items.reduce((acc, it) => acc + it.total_price, 0);

  const discountAmount = quote
    ? quote.discount_type === 'percent'
      ? (subtotalBruto * (quote.discount_value || 0)) / 100
      : quote.discount_value || 0
    : 0;

  const expirationDateStr = quote?.created_at
    ? (() => {
        const d = new Date(quote.created_at);
        d.setDate(d.getDate() + (quote.validity_days || 15));
        return d.toLocaleDateString('pt-BR');
      })()
    : null;

  if (!isOpen) return null;


  return createPortal(
    <div id="quote-print-modal-root" className="fixed inset-0 z-[200] flex flex-col bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-quote-page, #printable-quote-page * {
            visibility: visible !important;
          }
          #printable-quote-page {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 15mm 20mm !important;
            box-shadow: none !important;
            border: none !important;
          }
          .break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>

      {/* Barra de Ações Superior Limpa com Apenas o Botão "Imprimir" */}
      <header className="sticky top-0 z-50 bg-slate-900 text-white border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between shadow-lg print:hidden shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30 shrink-0">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2 truncate">
              <span>Folha Timbrada da Proposta</span>
              {quote?.code && (
                <span className="font-mono text-xs text-sky-400 font-bold bg-sky-950 px-2 py-0.5 rounded border border-sky-800 shrink-0">
                  {quote.code}
                </span>
              )}
            </h3>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Visualize a folha timbrada para conferência ou impressão.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Único Botão de Ação: Imprimir */}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer active:scale-98"
          >
            <Printer size={15} />
            <span>Imprimir</span>
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

      {/* Folha A4 Centralizada */}
      <main className="flex-1 flex justify-center p-4 sm:p-8 print:p-0">
        {loading || !quote ? (
          <div className="py-32 text-center text-slate-400 text-xs">
            <Loader2 size={24} className="animate-spin mx-auto mb-2 text-sky-500" />
            Formatando proposta comercial...
          </div>
        ) : (
          <div
            id="printable-quote-page"
            className="bg-white w-full max-w-4xl min-h-[297mm] p-8 sm:p-12 rounded-3xl shadow-2xl border border-slate-200 flex flex-col justify-between text-slate-800 font-sans space-y-6"
          >
            <div className="space-y-6">
              
              {/* 1. Cabeçalho */}
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
                      {company?.trade_name || company?.name || 'MINHA EMPRESA'}
                    </h2>
                  )}

                  <div className="text-[11px] text-slate-500 leading-relaxed font-medium space-y-0.5">
                    <p className="font-bold text-slate-800 text-xs">
                      {company?.corporate_name || company?.name}
                    </p>
                    {company?.cnpj && (
                      <p>CNPJ: {formatDocument(company.cnpj)}</p>
                    )}
                    {company?.commercial_phone && (
                      <p>Telefone: {formatPhone(company.commercial_phone)}</p>
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
                    Proposta Comercial
                  </span>

                  <h3 className="text-2xl font-black text-slate-900 tracking-tight pt-1">
                    {quote.code || `#${quote.quote_number}`}
                  </h3>

                  <p className="text-xs font-bold text-slate-700">
                    {quote.title}
                  </p>

                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-1.5">
                    <p>
                      Emissão: <strong>{new Date(quote.created_at).toLocaleDateString('pt-BR')}</strong>
                    </p>
                    <p>
                      Validade: <strong>{quote.validity_days || 15} dias</strong>
                      {expirationDateStr && (
                        <span className="text-slate-400"> (até {expirationDateStr})</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Bloco do Cliente / Contratante */}
              <div className="bg-slate-50/70 rounded-2xl border border-slate-200/90 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 break-inside-avoid">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Cliente / Contratante
                  </span>
                  <p className="font-extrabold text-sm text-slate-900">
                    {contact?.display_name || 'Cliente Não Informado'}
                  </p>
                  {contact?.document && (
                    <p className="text-xs text-slate-500 font-mono">
                      {contact.type === 'company' ? 'CNPJ' : 'CPF'}: {formatDocument(contact.document)}
                    </p>
                  )}
                  {contact?.address && (
                    <p className="text-xs text-slate-500 pt-0.5">
                      {contact.address}
                    </p>
                  )}
                </div>

                <div className="sm:border-l sm:border-slate-200 sm:pl-5 space-y-1.5 text-xs text-slate-600 flex flex-col justify-center">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Canais de Contato
                  </span>
                  {contact?.email ? (
                    <p className="flex items-center gap-2">
                      <Mail size={13} className="text-sky-600 shrink-0" />
                      <span>{contact.email}</span>
                    </p>
                  ) : (
                    <p className="text-slate-400 italic text-[11px]">E-mail não informado</p>
                  )}
                  {contact?.phone ? (
                    <p className="flex items-center gap-2">
                      <Phone size={13} className="text-emerald-600 shrink-0" />
                      <span className="font-mono">{formatPhone(contact.phone)}</span>
                    </p>
                  ) : (
                    <p className="text-slate-400 italic text-[11px]">Telefone não informado</p>
                  )}
                </div>
              </div>

              {/* 3. Tabela de Itens e Fornecimentos */}
              <div className="space-y-2 break-inside-avoid">
                <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  Discriminação dos Serviços e Fornecimentos
                </span>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3 w-8 text-center text-slate-400">#</th>
                        <th className="py-2.5 px-3">Descrição do Item / Serviço</th>
                        <th className="py-2.5 px-2 w-16 text-center">Unid.</th>
                        <th className="py-2.5 px-2 w-16 text-center">Qtd.</th>
                        <th className="py-2.5 px-3 w-28 text-right">Preço Unit.</th>
                        <th className="py-2.5 px-3 w-32 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {item.name}
                            {item.notes && (
                              <span className="block text-[10px] text-slate-400 font-normal">
                                {item.notes}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center text-slate-500 font-mono">
                            {item.unit}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-slate-800">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600 font-medium">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {formatCurrency(item.total_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Condições de Fornecimento e Fechamento Financeiro */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch break-inside-avoid">
                <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/90 text-xs flex flex-col justify-center space-y-3">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block border-b border-slate-200/70 pb-1.5">
                    Condições de Fornecimento
                  </span>

                  <div className="space-y-2">
                    {quote.delivery_deadline && (
                      <div className="flex items-start gap-2 text-slate-700">
                        <Clock size={14} className="text-sky-600 mt-0.5 shrink-0" />
                        <p>
                          <strong className="text-slate-800">Prazo de Entrega:</strong> {quote.delivery_deadline}
                        </p>
                      </div>
                    )}

                    {quote.payment_terms && (
                      <div className="flex items-start gap-2 text-slate-700">
                        <CreditCard size={14} className="text-sky-600 mt-0.5 shrink-0" />
                        <p>
                          <strong className="text-slate-800">Condições de Pagamento:</strong> {quote.payment_terms}
                        </p>
                      </div>
                    )}

                    {!quote.delivery_deadline && !quote.payment_terms && (
                      <p className="text-slate-400 italic text-[11px]">
                        Conforme previamente acordado entre as partes.
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/90 space-y-2 text-xs flex flex-col justify-center">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal Bruto:</span>
                    <span className="font-semibold text-slate-700">{formatCurrency(subtotalBruto)}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-rose-600 font-semibold">
                      <span>Desconto Comercial:</span>
                      <span>-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}

                  <div className="pt-2.5 border-t border-slate-200 flex justify-between items-baseline">
                    <span className="font-black text-slate-800 text-sm uppercase tracking-wider">
                      Valor Total:
                    </span>
                    <span className="text-2xl font-black text-sky-700">
                      {formatCurrency(quote.total_value)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. Observações Técnicas */}
              {quote.notes && (
                <div className="w-full p-4.5 bg-slate-50/70 rounded-2xl border border-slate-200/90 text-xs space-y-1.5 break-inside-avoid">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                    Observações Técnicas / Parecer de Execução
                  </span>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-line text-[11.5px] font-medium">
                    {quote.notes}
                  </p>
                </div>
              )}

            </div>

            {/* 6. Assinaturas Formais */}
            <div className="pt-14 border-t border-slate-200 grid grid-cols-2 gap-12 text-center text-xs break-inside-avoid">
              <div className="space-y-1">
                <div className="border-t border-slate-400 pt-2 mx-auto max-w-xs">
                  <p className="font-extrabold text-slate-900 truncate">
                    {company?.trade_name || company?.corporate_name || 'CONTRATADA'}
                  </p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Responsável Comercial / Técnico</p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="border-t border-slate-400 pt-2 mx-auto max-w-xs">
                  <p className="font-extrabold text-slate-900 truncate">
                    {contact?.display_name || 'CONTRATANTE'}
                  </p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Aceite do Cliente</p>
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

export default QuotePrintView;