import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { ContactProfileModal } from './ContactProfileModal';
import { OpportunityDetailModal } from './OpportunityDetailModal';
import { CreateOpportunityModal } from './CreateOpportunityModal';
import {
  Search,
  Plus,
  Filter,
  User,
  Building2,
  Phone,
  MessageCircle,
  MapPin,
  X,
  Users,
  Loader2
} from 'lucide-react';

interface ContactItem {
  id: string;
  type: 'person' | 'company';
  display_name: string;
  business_relation_type: string;
  visibility_type: string;
  avatar_url?: string | null;
  document?: string | null;
  subtitle?: string | null;
  phone?: string | null;
  is_whatsapp?: boolean;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  created_at: string;
}

interface ContactsViewProps {
  onOpenCreateModal: () => void;
  permissions?: any;
}

const formatPhone = (val?: string | null) => {
  if (!val) return null;
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
};

export const ContactsView: React.FC<ContactsViewProps> = ({ 
  onOpenCreateModal,
  permissions: propPermissions 
}) => {
  const { user } = useAuth();
  const { permissions: hookPermissions } = usePermissions();
  
  // Utiliza as permissões já resolvidas
  const permissions = propPermissions || hookPermissions;

  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Busca e Abas principais
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'person' | 'company'>('all');

  // Filtros avançados no Popover
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [tempRelation, setTempRelation] = useState<string>('all');
  const [appliedRelation, setAppliedRelation] = useState<string>('all');
  const [tempState, setTempState] = useState<string>('all');
  const [appliedState, setAppliedState] = useState<string>('all');
  const [tempWhatsappOnly, setTempWhatsappOnly] = useState<string>('all');
  const [appliedWhatsappOnly, setAppliedWhatsappOnly] = useState<string>('all');
  const [tempHasDocument, setTempHasDocument] = useState<string>('all');
  const [appliedHasDocument, setAppliedHasDocument] = useState<string>('all');

  // Estados para modais vinculados
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [isOpportunityDetailOpen, setIsOpportunityDetailOpen] = useState(false);
  const [isCreateOpportunityOpen, setIsCreateOpportunityOpen] = useState(false);
  const [opportunityContactId, setOpportunityContactId] = useState<string | null>(null);

  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchContacts = async () => {
    if (!user?.company?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id,
          type,
          display_name,
          business_relation_type,
          visibility_type,
          avatar_url,
          created_at,
          contact_people (
            cpf_informado,
            occupation
          ),
          contact_companies (
            cnpj,
            trade_name
          ),
          contact_phones (
            phone_number,
            is_whatsapp,
            is_primary
          ),
          contact_emails (
            email,
            is_primary
          ),
          contact_addresses (
            city,
            state,
            is_primary
          )
        `)
        .eq('company_id', user.company.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar contatos:', error.message);
        return;
      }

      const formatted: ContactItem[] = (data || []).map((c: any) => {
        const pf = Array.isArray(c.contact_people) ? c.contact_people[0] : c.contact_people;
        const pj = Array.isArray(c.contact_companies) ? c.contact_companies[0] : c.contact_companies;
        const primaryPhone = (c.contact_phones || []).find((p: any) => p.is_primary) || c.contact_phones?.[0];
        const primaryEmail = (c.contact_emails || []).find((e: any) => e.is_primary) || c.contact_emails?.[0];
        const primaryAddress = (c.contact_addresses || []).find((a: any) => a.is_primary) || c.contact_addresses?.[0];

        return {
          id: c.id,
          type: c.type,
          display_name: c.display_name,
          business_relation_type: c.business_relation_type || 'cliente',
          visibility_type: c.visibility_type,
          avatar_url: c.avatar_url,
          document: c.type === 'person' ? pf?.cpf_informado : pj?.cnpj,
          subtitle: c.type === 'person' ? pf?.occupation : pj?.trade_name,
          phone: primaryPhone?.phone_number,
          is_whatsapp: primaryPhone?.is_whatsapp,
          email: primaryEmail?.email,
          city: primaryAddress?.city,
          state: primaryAddress?.state,
          created_at: c.created_at
        };
      });

      setContacts(formatted);
    } catch (err) {
      console.error('Erro ao carregar contatos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [user?.company?.id]);

  const counts = useMemo(() => {
    return {
      all: contacts.length,
      person: contacts.filter(c => c.type === 'person').length,
      company: contacts.filter(c => c.type === 'company').length,
    };
  }, [contacts]);

  const availableStates = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => {
      if (c.state) set.add(c.state.toUpperCase());
    });
    return Array.from(set).sort();
  }, [contacts]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedRelation !== 'all') count++;
    if (appliedState !== 'all') count++;
    if (appliedWhatsappOnly !== 'all') count++;
    if (appliedHasDocument !== 'all') count++;
    return count;
  }, [appliedRelation, appliedState, appliedWhatsappOnly, appliedHasDocument]);

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (selectedType !== 'all' && c.type !== selectedType) return false;
      if (appliedRelation !== 'all' && c.business_relation_type !== appliedRelation) return false;
      if (appliedState !== 'all' && (c.state || '').toUpperCase() !== appliedState) return false;

      if (appliedWhatsappOnly === 'yes' && (!c.phone || !c.is_whatsapp)) return false;
      if (appliedWhatsappOnly === 'no' && c.is_whatsapp) return false;

      if (appliedHasDocument === 'yes' && !c.document?.trim()) return false;
      if (appliedHasDocument === 'no' && c.document?.trim()) return false;

      if (search.trim()) {
        const term = search.toLowerCase();
        const matchName = c.display_name.toLowerCase().includes(term);
        const matchDoc = c.document?.replace(/\D/g, '').includes(term.replace(/\D/g, ''));
        const matchEmail = c.email?.toLowerCase().includes(term);
        const matchPhone = c.phone?.replace(/\D/g, '').includes(term.replace(/\D/g, ''));
        if (!matchName && !matchDoc && !matchEmail && !matchPhone) return false;
      }

      return true;
    });
  }, [contacts, selectedType, appliedRelation, appliedState, appliedWhatsappOnly, appliedHasDocument, search]);

  const handleApplyFilters = () => {
    setAppliedRelation(tempRelation);
    setAppliedState(tempState);
    setAppliedWhatsappOnly(tempWhatsappOnly);
    setAppliedHasDocument(tempHasDocument);
    setIsFilterOpen(false);
  };

  const handleClearFilters = () => {
    setTempRelation('all');
    setTempState('all');
    setTempWhatsappOnly('all');
    setTempHasDocument('all');
    setAppliedRelation('all');
    setAppliedState('all');
    setAppliedWhatsappOnly('all');
    setAppliedHasDocument('all');
    setIsFilterOpen(false);
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const openWhatsApp = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanPhone = phone.replace(/\D/g, '');
    const fullNumber = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${fullNumber}`, '_blank');
  };

  const handleOpenProfile = (contactId: string) => {
    setSelectedContactId(contactId);
    setIsProfileModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden relative space-y-3">
      {/* 1. TOPO DA TELA: Título com Subtítulo no Desktop e Botão de Novo Contato */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Central de Contatos
          </h1>
          <p className="hidden sm:block text-xs sm:text-sm text-slate-500 mt-0.5">
            Base central de contatos e clientes de <strong className="text-slate-700">{user?.company?.name || 'sua empresa'}</strong>.
          </p>
        </div>

        {permissions?.canCreateEditContacts && (
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="hidden md:inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer active:scale-98 shrink-0"
          >
            <Plus size={16} />
            <span>Novo Contato</span>
          </button>
        )}
      </div>

      {/* 2. BARRA DE PESQUISA, SELETOR (TODOS/PESSOAS/EMPRESAS) E FILTRO */}
      <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shrink-0 relative">
        {/* Campo de Busca */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, documento, telefone..."
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-slate-800 placeholder-slate-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Agrupamento: Seletor de Tipo e Filtro */}
        <div className="flex items-center gap-2 shrink-0 justify-between md:justify-end">
          {/* Todos / Pessoas / Empresas */}
          <div className="flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/70 text-xs shrink-0 overflow-x-auto no-scrollbar flex-1 md:flex-initial justify-between md:justify-start">
            <button
              type="button"
              onClick={() => setSelectedType('all')}
              title="Todos os contatos"
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                selectedType === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={14} className="sm:hidden text-slate-600" />
              <span className="hidden sm:inline">Todos</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                selectedType === 'all' ? 'bg-slate-100 text-slate-800' : 'bg-slate-200/60 text-slate-500'
              }`}>
                {counts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('person')}
              title="Pessoas Físicas"
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                selectedType === 'person'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User size={14} className={selectedType === 'person' ? 'text-sky-600' : 'text-slate-500'} />
              <span className="hidden sm:inline">Pessoas</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                selectedType === 'person' ? 'bg-sky-50 text-sky-700' : 'bg-slate-200/60 text-slate-500'
              }`}>
                {counts.person}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('company')}
              title="Empresas / Pessoas Jurídicas"
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                selectedType === 'company'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 size={14} className={selectedType === 'company' ? 'text-indigo-600' : 'text-slate-500'} />
              <span className="hidden sm:inline">Empresas</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                selectedType === 'company' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200/60 text-slate-500'
              }`}>
                {counts.company}
              </span>
            </button>
          </div>

          {/* Botão de Filtros */}
          <div className="relative shrink-0" ref={filterRef}>
            <button
              type="button"
              onClick={() => {
                setTempRelation(appliedRelation);
                setTempState(appliedState);
                setTempWhatsappOnly(appliedWhatsappOnly);
                setTempHasDocument(appliedHasDocument);
                setIsFilterOpen(!isFilterOpen);
              }}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                activeFiltersCount > 0
                  ? 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title="Filtros avançados"
            >
              <Filter size={14} className={activeFiltersCount > 0 ? 'text-sky-600' : 'text-slate-400'} />
              <span className="hidden sm:inline">Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="h-4 w-4 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {isFilterOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 z-[100] space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Filtrar Contatos</h3>
                  <div className="flex items-center gap-2">
                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="text-[11px] font-semibold text-sky-600 hover:underline cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(false)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600">Categoria / Relação</label>
                  <select
                    value={tempRelation}
                    onChange={(e) => setTempRelation(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                  >
                    <option value="all">Todas as categorias</option>
                    <option value="cliente">Cliente</option>
                    <option value="lead">Lead / Oportunidade</option>
                    <option value="fornecedor">Fornecedor</option>
                    <option value="parceiro">Parceiro</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600">Canal WhatsApp</label>
                  <select
                    value={tempWhatsappOnly}
                    onChange={(e) => setTempWhatsappOnly(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                  >
                    <option value="all">Todos os contatos</option>
                    <option value="yes">Apenas com WhatsApp</option>
                    <option value="no">Sem WhatsApp informado</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600">CPF / CNPJ</label>
                  <select
                    value={tempHasDocument}
                    onChange={(e) => setTempHasDocument(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                  >
                    <option value="all">Todos</option>
                    <option value="yes">Com documento preenchido</option>
                    <option value="no">Sem documento preenchido</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600">Estado (UF)</label>
                  <select
                    value={tempState}
                    onChange={(e) => setTempState(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                  >
                    <option value="all">Qualquer estado</option>
                    {availableStates.map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleApplyFilters}
                    className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Aplicar filtros
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. FEED DE CONTATOS NO MOBILE */}
      <div className="block md:hidden flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2 pb-20">
        {loading ? (
          <div className="p-10 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-slate-400">
            <Loader2 size={22} className="animate-spin mx-auto mb-2 text-sky-600" />
            Carregando contatos...
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Search size={18} />
            </div>
            <p className="text-slate-700 font-semibold text-sm">Nenhum contato encontrado</p>
            <p className="text-slate-400 text-xs">Ajuste os filtros de busca.</p>
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => handleOpenProfile(contact.id)}
              className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs active:bg-slate-50 transition-all cursor-pointer flex items-center gap-3"
            >
              <div className="relative shrink-0">
                {contact.avatar_url ? (
                  <img
                    src={contact.avatar_url}
                    alt={contact.display_name}
                    className="w-11 h-11 rounded-xl object-cover border border-slate-200 shadow-2xs"
                  />
                ) : (
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-2xs ${
                      contact.type === 'person'
                        ? 'bg-gradient-to-tr from-sky-600 to-blue-500'
                        : 'bg-gradient-to-tr from-indigo-600 to-violet-500'
                    }`}
                  >
                    {getInitials(contact.display_name)}
                  </div>
                )}
                <div
                  title={contact.type === 'person' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                  className={`absolute -bottom-1 -right-1 p-0.5 rounded-full border border-white shadow-2xs ${
                    contact.type === 'person' ? 'bg-sky-600 text-white' : 'bg-indigo-600 text-white'
                  }`}
                >
                  {contact.type === 'person' ? <User size={9} /> : <Building2 size={9} />}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-800 text-sm leading-tight truncate">
                  {contact.display_name}
                </h3>
                <span className="text-xs text-slate-400 font-medium block truncate mt-0.5">
                  {contact.type === 'person' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                </span>
              </div>
            </div>
          ))
        )}

        <div className="py-2 text-center text-xs text-slate-400">
          Exibindo <b>{filteredContacts.length}</b> de <b>{contacts.length}</b> contatos
        </div>
      </div>

      {/* 4. TABELA DE CONTATOS NO DESKTOP: Estende até o fim da tela e tem rolagem suave */}
      <div className="hidden md:flex flex-col flex-1 min-h-0 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200/80 text-[11px] uppercase tracking-wider font-bold text-slate-400">
              <tr>
                <th className="py-3 px-5">Contato</th>
                <th className="py-3 px-4">Relação Comercial</th>
                <th className="py-3 px-4">Documento</th>
                <th className="py-3 px-4">Telefone</th>
                <th className="py-3 px-5">Localização</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-slate-400">
                    <Loader2 size={22} className="animate-spin mx-auto mb-2 text-sky-600" />
                    Carregando contatos...
                  </td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center">
                    <div className="max-w-xs mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Search size={18} />
                      </div>
                      <p className="text-slate-700 font-semibold text-sm">Nenhum contato encontrado</p>
                      <p className="text-slate-400 text-xs">
                        Tente ajustar a busca ou limpar os filtros aplicados.
                      </p>
                      {(search || activeFiltersCount > 0 || selectedType !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setSelectedType('all');
                            handleClearFilters();
                          }}
                          className="text-xs text-sky-600 font-semibold hover:underline pt-1 cursor-pointer"
                        >
                          Limpar todos os filtros
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr 
                    key={contact.id} 
                    onClick={() => handleOpenProfile(contact.id)}
                    title="Clique para abrir os detalhes do contato"
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  >
                    {/* Avatar e Nome */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {contact.avatar_url ? (
                            <img
                              src={contact.avatar_url}
                              alt={contact.display_name}
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-2xs"
                            />
                          ) : (
                            <div
                              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs text-white shadow-2xs ${
                                contact.type === 'person'
                                  ? 'bg-gradient-to-tr from-sky-600 to-blue-500'
                                  : 'bg-gradient-to-tr from-indigo-600 to-violet-500'
                              }`}
                            >
                              {getInitials(contact.display_name)}
                            </div>
                          )}
                          <div
                            title={contact.type === 'person' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                            className={`absolute -bottom-1 -right-1 p-0.5 rounded-full border border-white shadow-2xs ${
                              contact.type === 'person' ? 'bg-sky-600 text-white' : 'bg-indigo-600 text-white'
                            }`}
                          >
                            {contact.type === 'person' ? <User size={9} /> : <Building2 size={9} />}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 leading-tight truncate max-w-[200px] sm:max-w-xs group-hover:text-sky-600 transition-colors">
                            {contact.display_name}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[200px]">
                            {contact.subtitle || (contact.type === 'person' ? 'Pessoa Física' : 'Pessoa Jurídica')}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Relação Comercial */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border capitalize ${
                        contact.business_relation_type === 'cliente'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                          : contact.business_relation_type === 'lead'
                          ? 'bg-amber-50 text-amber-700 border-amber-200/60'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200/60'
                      }`}>
                        {contact.business_relation_type}
                      </span>
                    </td>

                    {/* Documento */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {contact.document ? (
                        <span className="font-mono text-xs text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-200/60 inline-block">
                          {contact.document}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs italic">Não informado</span>
                      )}
                    </td>

                    {/* Telefone */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {contact.phone ? (
                        contact.is_whatsapp ? (
                          <button
                            type="button"
                            onClick={(e) => openWhatsApp(contact.phone!, e)}
                            title="Abrir WhatsApp Web"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 font-medium text-xs transition-colors cursor-pointer"
                          >
                            <MessageCircle size={13} className="text-emerald-600" />
                            <span>{formatPhone(contact.phone)}</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-700 text-xs font-mono">
                            <Phone size={12} className="text-slate-400" />
                            <span>{formatPhone(contact.phone)}</span>
                          </span>
                        )
                      ) : (
                        <span className="text-slate-300 text-xs italic">Sem telefone</span>
                      )}
                    </td>

                    {/* Localização */}
                    <td className="py-3.5 px-5 text-slate-600 text-xs whitespace-nowrap">
                      {contact.city ? (
                        <div className="inline-flex items-center gap-1">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span>{contact.city}{contact.state ? ` - ${contact.state}` : ''}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 italic">Não informada</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé Desktop */}
        <div className="py-3 px-5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            Exibindo <b>{filteredContacts.length}</b> de <b>{contacts.length}</b> contatos
          </span>
          <span className="text-[11px] text-slate-400">Lume Contatos v1.0</span>
        </div>
      </div>

      {/* BOTÃO FLUTUANTE (FAB) MOBILE */}
      {permissions?.canCreateEditContacts && (
        <button
          type="button"
          onClick={onOpenCreateModal}
          className="md:hidden fixed bottom-6 right-6 z-40 w-14 h-14 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-all border border-sky-400/40"
          title="Novo Contato"
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
      )}

      {/* Modais Vinculados */}
      <ContactProfileModal
        contactId={selectedContactId}
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsProfileModalOpen(false);
          setSelectedContactId(null);
        }}
        onContactUpdated={fetchContacts}
        onNavigateToContact={(targetContactId) => {
          setSelectedContactId(targetContactId);
        }}
        onOpenOpportunity={(opportunityId) => {
          setSelectedOpportunityId(opportunityId);
          setIsOpportunityDetailOpen(true);
        }}
        onCreateOpportunityForContact={(contactId) => {
          setOpportunityContactId(contactId);
          setIsCreateOpportunityOpen(true);
        }}
      />

      {selectedOpportunityId && (
        <OpportunityDetailModal
          isOpen={isOpportunityDetailOpen}
          opportunityId={selectedOpportunityId}
          onClose={() => {
            setIsOpportunityDetailOpen(false);
            setSelectedOpportunityId(null);
          }}
          onUpdated={() => {
            fetchContacts();
          }}
        />
      )}

      <CreateOpportunityModal
        isOpen={isCreateOpportunityOpen}
        initialContactId={opportunityContactId}
        onClose={() => {
          setIsCreateOpportunityOpen(false);
          setOpportunityContactId(null);
        }}
        onSuccess={() => {
          setIsCreateOpportunityOpen(false);
          setOpportunityContactId(null);
          fetchContacts();
        }}
      />
    </div>
  );
};

export default ContactsView;