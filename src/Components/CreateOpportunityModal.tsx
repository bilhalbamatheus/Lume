import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Briefcase, 
  Calendar, 
  Handshake, 
  UserCheck, 
  Loader2,
  Search,
  Building2,
  User,
  Check,
  ChevronDown,
  Lock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

interface CreateOpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialContactId?: string | null;
}

interface ContactOption {
  id: string;
  display_name: string;
  type: string;
  avatar_url?: string | null;
}

interface StageOption {
  id: string;
  name: string;
  pipeline_id: string;
}

interface MemberOption {
  id: string;           // profile_id
  membership_id: string;// memberships.id
  name: string;
  avatar_url?: string | null;
}

interface ServiceTypeOption {
  id: string;
  name: string;
}

export const CreateOpportunityModal: React.FC<CreateOpportunityModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialContactId
}) => {
  const { user } = useAuth();
  const { permissions } = usePermissions();

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  // Listas de dados
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [teamMembers, setTeamMembers] = useState<MemberOption[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeOption[]>([]);

  // Estados padrão
  const [title, setTitle] = useState('');
  const [stageId, setStageId] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState('media');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [description, setDescription] = useState('');

  // 1. Campo com pesquisa digitável em tempo real: Contacto Principal
  const [contactId, setContactId] = useState('');
  const [contactSearchText, setContactSearchText] = useState('');
  const [isContactDropdownOpen, setIsContactDropdownOpen] = useState(false);
  const contactBoxRef = useRef<HTMLDivElement>(null);

  // 2. Campo com pesquisa digitável em tempo real: Parceiro / Indicador
  const [partnerContactId, setPartnerContactId] = useState('');
  const [partnerSearchText, setPartnerSearchText] = useState('');
  const [isPartnerDropdownOpen, setIsPartnerDropdownOpen] = useState(false);
  const partnerBoxRef = useRef<HTMLDivElement>(null);

  // 3. Dropdown customizado de Responsável Comercial (sem digitação)
  const [isAssignedDropdownOpen, setIsAssignedDropdownOpen] = useState(false);
  const assignedBoxRef = useRef<HTMLDivElement>(null);

  // Fecha menus flutuantes ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contactBoxRef.current && !contactBoxRef.current.contains(event.target as Node)) {
        setIsContactDropdownOpen(false);
      }
      if (partnerBoxRef.current && !partnerBoxRef.current.contains(event.target as Node)) {
        setIsPartnerDropdownOpen(false);
      }
      if (assignedBoxRef.current && !assignedBoxRef.current.contains(event.target as Node)) {
        setIsAssignedDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Carrega contactos, etapas, equipa ativa e tipos de serviços da empresa
  useEffect(() => {
    if (!isOpen) return;

    const loadFormData = async () => {
      try {
        setLoadingData(true);
        const companyId = user?.company?.id;
        if (!companyId) return;

        // 1. Contactos ativos
        const { data: contactsData } = await supabase
          .from('contacts')
          .select('id, display_name, type, avatar_url')
          .eq('company_id', companyId)
          .is('deleted_at', null)
          .order('display_name', { ascending: true });

        const mappedContacts = contactsData || [];
        setContacts(mappedContacts);

        // Se houver initialContactId, preenche o contato e o texto de busca
        if (initialContactId) {
          const found = mappedContacts.find(c => c.id === initialContactId);
          if (found) {
            setContactId(found.id);
            setContactSearchText(found.display_name);
          } else {
            setContactId(initialContactId);
          }
        }

        // 2. Etapas
        const { data: stagesData } = await supabase
          .from('commercial_pipeline_stages')
          .select('id, name, pipeline_id')
          .eq('company_id', companyId)
          .order('sort_order', { ascending: true });

        const mappedStages = stagesData || [];
        setStages(mappedStages);
        if (mappedStages.length > 0) {
          setStageId(mappedStages[0].id);
        }

        // 3. Membros ativos via memberships
        const { data: membersData } = await supabase
          .from('memberships')
          .select(`
            id,
            profile_id,
            status,
            profile:profiles!profile_id (
              id,
              full_name,
              avatar_url
            )
          `)
          .eq('company_id', companyId)
          .eq('status', 'ativo');

        const mappedMembers: MemberOption[] = (membersData || [])
          .map((m: any) => {
            const prof = Array.isArray(m.profile) ? m.profile[0] : m.profile;
            if (!prof) return null;
            return {
              id: prof.id,
              membership_id: m.id,
              name: prof.full_name || 'Colaborador',
              avatar_url: prof.avatar_url || null
            };
          })
          .filter(Boolean) as MemberOption[];

        setTeamMembers(mappedMembers);

        const currentUserId = user?.profile?.id || user?.id || (user as any)?.user?.id;
        if (currentUserId && mappedMembers.some(m => m.id === currentUserId)) {
          setAssignedTo(currentUserId);
        }

        // 4. Tipos de Serviços da empresa cadastrados pelo administrador
        const { data: servicesData } = await supabase
          .from('company_service_types')
          .select('id, name')
          .eq('company_id', companyId)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true });

        const mappedServices: ServiceTypeOption[] = servicesData || [];
        setServiceTypes(mappedServices);
        if (mappedServices.length > 0) {
          setServiceType(mappedServices[0].name);
        }
      } catch (err) {
        console.error('Erro ao carregar dados do formulário:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadFormData();
  }, [isOpen, user?.company?.id, user?.id, initialContactId]);

  // Filtros em tempo real
  const filteredContacts = contacts.filter((c) =>
    c.display_name.toLowerCase().includes(contactSearchText.toLowerCase())
  );

  const filteredPartners = contacts.filter((c) =>
    c.display_name.toLowerCase().includes(partnerSearchText.toLowerCase())
  );

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setEstimatedValue('');
      return;
    }
    const val = (Number(raw) / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setEstimatedValue(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !contactId || !stageId) {
      alert('Preencha o título, busque e selecione o cliente pelo campo pesquisável e defina a etapa inicial.');
      return;
    }

    try {
      setLoading(true);
      const companyId = user?.company?.id;
      if (!companyId) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const authUserId = sessionData.session?.user?.id;
      const profileId = user?.profile?.id || user?.id || authUserId;

      const numericValue = estimatedValue
        ? parseFloat(estimatedValue.replace(/\./g, '').replace(',', '.'))
        : 0;

      const selectedStage = stages.find((s) => s.id === stageId);
      let pipelineId = selectedStage?.pipeline_id;

      if (!pipelineId) {
        const { data: defaultPipe } = await supabase
          .from('commercial_pipelines')
          .select('id')
          .eq('company_id', companyId)
          .limit(1)
          .maybeSingle();

        pipelineId = defaultPipe?.id;
      }

      let selectedMember = teamMembers.find((m) => m.id === assignedTo);
      let ownerMembershipId = selectedMember?.membership_id;

      if (!ownerMembershipId && profileId) {
        const { data: currentMember } = await supabase
          .from('memberships')
          .select('id')
          .eq('company_id', companyId)
          .eq('profile_id', profileId)
          .limit(1)
          .maybeSingle();

        ownerMembershipId = currentMember?.id;
      }

      const payload: any = {
        company_id: companyId,
        pipeline_id: pipelineId,
        stage_id: stageId,
        title: title.trim(),
        contact_id: contactId,
        service_type: serviceType.trim() || null,
        assigned_to: assignedTo || profileId || null,
        owner_membership_id: ownerMembershipId || null,
        created_by: profileId || authUserId,
        partner_contact_id: partnerContactId || null,
        priority: priority,
        estimated_value: numericValue,
        expected_close_date: expectedCloseDate ? new Date(expectedCloseDate).toISOString() : null,
        description: description.trim() || null,
        status: 'em_andamento'
      };

      const { error } = await supabase.from('opportunities').insert(payload);
      if (error) throw error;

      setTitle('');
      if (!initialContactId) {
        setContactId('');
        setContactSearchText('');
      }
      setPartnerContactId('');
      setPartnerSearchText('');
      setEstimatedValue('');
      setExpectedCloseDate('');
      setDescription('');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao registar negociação:', err);
      alert(`Falha ao criar negociação: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedAssignedMember = teamMembers.find((m) => m.id === assignedTo);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl max-w-xl w-full shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        
        {/* Cabeçalho */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 pr-2">
            <div className="h-10 w-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
              <Briefcase size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">Nova Negociação</h3>
              <p className="text-xs text-slate-500 mt-0.5">Adicione uma oportunidade ao funil comercial.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulário com corpo rolável e rodapé fixo */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs sm:text-sm">
            {/* Título da Negociação */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Título da Negociação *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Instalação Solar 10kWp - Residencial Silva"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
              />
            </div>

            {/* Contacto / Cliente Associado */}
            <div className="relative" ref={contactBoxRef}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <span>Contacto / Cliente Associado *</span>
                  {initialContactId && (
                    <span title="Cliente fixado a partir do perfil do contato" className="inline-flex items-center gap-1 text-[11px] font-normal text-slate-400">
                      <Lock size={11} className="text-slate-400" />
                      (fixado)
                    </span>
                  )}
                </label>
                {contactId && (
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    <Check size={11} /> Selecionado
                  </span>
                )}
              </div>

              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  required
                  disabled={Boolean(initialContactId)}
                  value={contactSearchText}
                  placeholder="Comece a digitar o nome do cliente..."
                  onFocus={() => {
                    if (!initialContactId) setIsContactDropdownOpen(true);
                  }}
                  onChange={(e) => {
                    if (initialContactId) return;
                    setContactSearchText(e.target.value);
                    setIsContactDropdownOpen(true);
                    if (!e.target.value) setContactId('');
                  }}
                  className={`w-full pl-9 pr-14 py-2.5 border rounded-xl text-slate-800 placeholder-slate-400 transition-all shadow-2xs font-medium ${
                    initialContactId
                      ? 'bg-slate-100/80 border-slate-200 text-slate-600 cursor-not-allowed opacity-90'
                      : contactId
                      ? 'border-sky-300 ring-1 ring-sky-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500'
                      : 'bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white'
                  }`}
                />

                {!initialContactId && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {contactSearchText && (
                      <button
                        type="button"
                        onClick={() => {
                          setContactSearchText('');
                          setContactId('');
                          setIsContactDropdownOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Limpar campo"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsContactDropdownOpen(!isContactDropdownOpen)}
                      className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <ChevronDown size={14} className={`transition-transform duration-150 ${isContactDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                )}
              </div>

              {/* Menu Suspenso de Resultados */}
              {isContactDropdownOpen && !initialContactId && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-56 overflow-y-auto z-50 p-1.5 space-y-0.5 animate-in fade-in duration-100">
                  {filteredContacts.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 italic">
                      Nenhum contacto encontrado para "{contactSearchText}".
                    </div>
                  ) : (
                    filteredContacts.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setContactId(c.id);
                          setContactSearchText(c.display_name);
                          setIsContactDropdownOpen(false);
                        }}
                        className={`w-full p-2.5 rounded-xl flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer ${
                          contactId === c.id
                            ? 'bg-sky-50 text-sky-900 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {c.avatar_url ? (
                            <img
                              src={c.avatar_url}
                              alt={c.display_name}
                              className="w-7 h-7 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              c.type === 'company' ? 'bg-indigo-50 text-indigo-700' : 'bg-sky-100 text-sky-700'
                            }`}>
                              {c.type === 'company' ? <Building2 size={13} /> : <User size={13} />}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs truncate">{c.display_name}</p>
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {c.type === 'company' ? 'Empresa' : 'Pessoa Física'}
                            </span>
                          </div>
                        </div>
                        {contactId === c.id && <Check size={14} className="text-sky-600 shrink-0" />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Etapa Inicial + Prioridade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Etapa Inicial do Funil *
                </label>
                <select
                  required
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs cursor-pointer"
                >
                  {stages.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Prioridade</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs cursor-pointer"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Normal / Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>

            {/* Tipo de Serviço + Responsável Comercial */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Briefcase size={14} className="text-sky-600" />
                  Tipo de Serviço
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs cursor-pointer"
                >
                  {serviceTypes.length === 0 ? (
                    <option value="">Nenhum serviço cadastrado</option>
                  ) : (
                    serviceTypes.map((opt) => (
                      <option key={opt.id} value={opt.name}>
                        {opt.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Responsável Comercial Custom Dropdown */}
              <div className="relative" ref={assignedBoxRef}>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <UserCheck size={14} className="text-sky-600" />
                  Responsável Comercial
                </label>

                <button
                  type="button"
                  onClick={() => setIsAssignedDropdownOpen(!isAssignedDropdownOpen)}
                  className="w-full flex items-center justify-between px-3.5 py-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-slate-800 transition-colors cursor-pointer shadow-2xs text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedAssignedMember ? (
                      <>
                        {selectedAssignedMember.avatar_url ? (
                          <img
                            src={selectedAssignedMember.avatar_url}
                            alt={selectedAssignedMember.name}
                            className="w-6 h-6 rounded-full object-cover shrink-0 border border-slate-200"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                            {selectedAssignedMember.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate font-medium">{selectedAssignedMember.name}</span>
                      </>
                    ) : (
                      <span className="text-slate-400">Não atribuído</span>
                    )}
                  </div>
                  <ChevronDown size={14} className={`text-slate-400 shrink-0 ml-2 transition-transform duration-150 ${isAssignedDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Lista suspensa do Responsável */}
                {isAssignedDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-52 overflow-y-auto z-50 p-1.5 space-y-0.5 animate-in fade-in duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setAssignedTo('');
                        setIsAssignedDropdownOpen(false);
                      }}
                      className={`w-full p-2 rounded-xl text-left transition-colors cursor-pointer text-xs flex items-center gap-2 ${
                        !assignedTo ? 'bg-slate-100 font-semibold text-slate-900' : 'hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-[10px] shrink-0">
                        -
                      </div>
                      <span>Não atribuído</span>
                    </button>

                    {teamMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setAssignedTo(m.id);
                          setIsAssignedDropdownOpen(false);
                        }}
                        className={`w-full p-2 rounded-xl flex items-center justify-between gap-2 text-left transition-colors cursor-pointer text-xs ${
                          assignedTo === m.id
                            ? 'bg-sky-50 text-sky-900 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {m.avatar_url ? (
                            <img
                              src={m.avatar_url}
                              alt={m.name}
                              className="w-6 h-6 rounded-full object-cover shrink-0 border border-slate-200"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="truncate">{m.name}</span>
                        </div>
                        {assignedTo === m.id && <Check size={13} className="text-sky-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Parceiro / Indicador + Valor Estimado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="relative" ref={partnerBoxRef}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Handshake size={14} className="text-sky-600" />
                    Parceiro / Indicador
                  </label>
                  {partnerContactId && (
                    <button
                      type="button"
                      onClick={() => {
                        setPartnerContactId('');
                        setPartnerSearchText('');
                      }}
                      className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                    >
                      Remover
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={partnerSearchText}
                    placeholder="Pesquise o indicador..."
                    onFocus={() => setIsPartnerDropdownOpen(true)}
                    onChange={(e) => {
                      setPartnerSearchText(e.target.value);
                      setIsPartnerDropdownOpen(true);
                      if (!e.target.value) setPartnerContactId('');
                    }}
                    className={`w-full pl-9 pr-14 py-2.5 bg-slate-50 border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs font-medium ${
                      partnerContactId ? 'border-sky-300 ring-1 ring-sky-200 bg-white' : 'border-slate-200'
                    }`}
                  />

                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {partnerSearchText && (
                      <button
                        type="button"
                        onClick={() => {
                          setPartnerSearchText('');
                          setPartnerContactId('');
                          setIsPartnerDropdownOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsPartnerDropdownOpen(!isPartnerDropdownOpen)}
                      className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <ChevronDown size={14} className={`transition-transform duration-150 ${isPartnerDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Lista Flutuante de Parceiros */}
                {isPartnerDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-52 overflow-y-auto z-50 p-1.5 space-y-0.5 animate-in fade-in duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setPartnerContactId('');
                        setPartnerSearchText('');
                        setIsPartnerDropdownOpen(false);
                      }}
                      className={`w-full p-2 rounded-xl text-left transition-colors cursor-pointer text-xs ${
                        !partnerContactId ? 'bg-slate-100 font-semibold text-slate-900' : 'hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      Nenhum (Origem direta)
                    </button>

                    {filteredPartners.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPartnerContactId(p.id);
                          setPartnerSearchText(p.display_name);
                          setIsPartnerDropdownOpen(false);
                        }}
                        className={`w-full p-2 rounded-xl flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                          partnerContactId === p.id
                            ? 'bg-sky-50 text-sky-900 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {p.avatar_url ? (
                            <img
                              src={p.avatar_url}
                              alt={p.display_name}
                              className="w-6 h-6 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                              p.type === 'company' ? 'bg-indigo-50 text-indigo-700' : 'bg-sky-100 text-sky-700'
                            }`}>
                              {p.type === 'company' ? <Building2 size={12} /> : <User size={12} />}
                            </div>
                          )}
                          <span className="text-xs truncate">{p.display_name}</span>
                        </div>
                        {partnerContactId === p.id && <Check size={13} className="text-sky-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Valor Estimado */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Valor Estimado (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                    R$
                  </span>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={estimatedValue}
                    onChange={handleValueChange}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Previsão de Fecho */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-sky-600" />
                Previsão de Fecho
              </label>
              <input
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs cursor-pointer"
              />
            </div>

            {/* Observações */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Observações / Descrição Breve
              </label>
              <textarea
                rows={2}
                placeholder="Detalhes, histórico inicial ou necessidades identificadas..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs resize-none"
              />
            </div>
          </div>

          {/* Rodapé Fixo de Ações (Sempre Acessível no Mobile) */}
          <div className="p-3.5 sm:p-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || loadingData}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Briefcase size={15} />
                  Criar Negociação
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};