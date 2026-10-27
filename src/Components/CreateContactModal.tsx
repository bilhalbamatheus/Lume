import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { 
  X, 
  User, 
  Building2, 
  MapPin, 
  Loader2, 
  Save,
  Compass,
  ShieldAlert,
  Plus,
  Trash2,
  Phone,
  Mail
} from 'lucide-react';

interface CreateContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PhoneInputItem {
  phone_number: string;
  is_whatsapp: boolean;
}

interface EmailInputItem {
  email: string;
}

interface AddressInputItem {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  searchingCep?: boolean;
}

const maskCPF = (val: string) =>
  val.replace(/\D/g, '').slice(0, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');

const maskCNPJ = (val: string) =>
  val.replace(/\D/g, '').slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');

const maskPhone = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
};

const maskCEP = (val: string) =>
  val.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');

export const CreateContactModal: React.FC<CreateContactModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user } = useAuth();
  const { permissions, loading: loadingPermissions } = usePermissions();

  const [loading, setLoading] = useState(false);
  const [searchingCnpj, setSearchingCnpj] = useState(false);

  // Tipo, Relação e Origem
  const [type, setType] = useState<'person' | 'company'>('person');
  const [businessRelation, setBusinessRelation] = useState<'cliente' | 'lead' | 'fornecedor' | 'parceiro'>('cliente');
  const [leadSource, setLeadSource] = useState<string>('indicacao');

  // Campos Pessoa Física
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [occupation, setOccupation] = useState('');

  // Campos Pessoa Jurídica
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [stateRegistration, setStateRegistration] = useState('');

  // Listas de Telefones, E-mails e Endereços
  const [phones, setPhones] = useState<PhoneInputItem[]>([{ phone_number: '', is_whatsapp: true }]);
  const [emails, setEmails] = useState<EmailInputItem[]>([{ email: '' }]);
  const [addresses, setAddresses] = useState<AddressInputItem[]>([
    { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
  ]);

  const resetForm = () => {
    setName('');
    setCpf('');
    setOccupation('');

    setLegalName('');
    setTradeName('');
    setCnpj('');
    setStateRegistration('');

    setPhones([{ phone_number: '', is_whatsapp: true }]);
    setEmails([{ email: '' }]);
    setAddresses([
      { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
    ]);

    setBusinessRelation('cliente');
    setLeadSource('indicacao');
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
      setType('person');
    }
  }, [isOpen]);

  const handleTypeChange = (newType: 'person' | 'company') => {
    if (newType !== type) {
      resetForm();
      setType(newType);
    }
  };

  if (!isOpen) return null;

  // Busca de dados da empresa por CNPJ (BrasilAPI)
  const handleCnpjBlur = async () => {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return;

    try {
      setSearchingCnpj(true);
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (res.ok) {
        const data = await res.json();
        if (data.razao_social && !legalName) setLegalName(data.razao_social);
        if (data.nome_fantasia && !tradeName) setTradeName(data.nome_fantasia);

        if (data.cep) {
          setAddresses(prev => {
            const first = prev[0] || {};
            const updatedFirst: AddressInputItem = {
              cep: maskCEP(data.cep),
              street: data.logradouro || first.street || '',
              number: data.numero || first.number || '',
              complement: data.complemento || first.complement || '',
              neighborhood: data.bairro || first.neighborhood || '',
              city: data.municipio || first.city || '',
              state: (data.uf || first.state || '').toUpperCase()
            };
            return [updatedFirst, ...prev.slice(1)];
          });
        }

        if (data.ddd_telefone_1) {
          setPhones(prev => {
            const hasPhone = prev.some(p => p.phone_number.trim());
            if (!hasPhone) {
              return [{ phone_number: maskPhone(data.ddd_telefone_1), is_whatsapp: true }];
            }
            return prev;
          });
        }

        if (data.email) {
          setEmails(prev => {
            const hasEmail = prev.some(e => e.email.trim());
            if (!hasEmail) {
              return [{ email: data.email.toLowerCase() }];
            }
            return prev;
          });
        }
      }
    } catch (err) {
      console.warn('Erro ao consultar CNPJ:', err);
    } finally {
      setSearchingCnpj(false);
    }
  };

  const handleCepBlur = async (index: number) => {
    const cleanCep = addresses[index]?.cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    try {
      setAddresses(prev => prev.map((item, i) => i === index ? { ...item, searchingCep: true } : item));
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setAddresses(prev =>
          prev.map((item, i) =>
            i === index
              ? {
                  ...item,
                  street: data.logradouro || item.street,
                  neighborhood: data.bairro || item.neighborhood,
                  city: data.localidade || item.city,
                  state: (data.uf || item.state).toUpperCase()
                }
              : item
          )
        );
      }
    } catch (error) {
      console.error('Erro ao consultar CEP:', error);
    } finally {
      setAddresses(prev => prev.map((item, i) => i === index ? { ...item, searchingCep: false } : item));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.company?.id) {
      alert('Empresa ativa não identificada.');
      return;
    }

    if (!permissions.canCreateEditContacts) {
      alert('Seu perfil não possui permissão para cadastrar ou editar contatos.');
      return;
    }

    try {
      setLoading(true);
      const displayName = type === 'person' ? name.trim() : (tradeName.trim() || legalName.trim());

      const { data: sessionData } = await supabase.auth.getSession();
      const authUserId = sessionData.session?.user?.id || user.id;

      const { data: member } = await supabase
        .from('memberships')
        .select('id')
        .eq('company_id', user.company.id)
        .eq('profile_id', authUserId)
        .maybeSingle();

      const creatorId = member?.id || authUserId || null;

      // 1. Criar o contato base
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .insert({
          company_id: user.company.id,
          type,
          display_name: displayName,
          business_relation_type: businessRelation,
          lead_source: leadSource,
          visibility_type: 'publico',
          created_by: creatorId
        })
        .select('id')
        .single();

      if (contactError || !contactData) {
        throw new Error(contactError?.message || 'Falha ao cadastrar contato.');
      }

      const contactId = contactData.id;

      // 2. Criar dados de PF ou PJ
      if (type === 'person') {
        await supabase
          .from('contact_people')
          .insert({
            contact_id: contactId,
            cpf_informado: cpf.trim() || null,
            occupation: occupation.trim() || null
          });
      } else {
        await supabase
          .from('contact_companies')
          .insert({
            contact_id: contactId,
            cnpj: cnpj.trim() || null,
            legal_name: legalName.trim(),
            trade_name: tradeName.trim() || null,
            state_registration: stateRegistration.trim() || null
          });
      }

      // 3. Inserir múltiplos telefones
      const validPhones = phones.filter(p => p.phone_number.trim());
      if (validPhones.length > 0) {
        await supabase
          .from('contact_phones')
          .insert(
            validPhones.map((p, idx) => ({
              company_id: user.company.id,
              contact_id: contactId,
              phone_number: p.phone_number.trim(),
              is_whatsapp: p.is_whatsapp,
              is_primary: idx === 0
            }))
          );
      }

      // 4. Inserir múltiplos e-mails
      const validEmails = emails.filter(e => e.email.trim());
      if (validEmails.length > 0) {
        await supabase
          .from('contact_emails')
          .insert(
            validEmails.map((e, idx) => ({
              company_id: user.company.id,
              contact_id: contactId,
              email: e.email.trim().toLowerCase(),
              is_primary: idx === 0
            }))
          );
      }

      // 5. Inserir múltiplos endereços
      const validAddresses = addresses.filter(a => a.cep.trim() || a.street.trim() || a.city.trim());
      if (validAddresses.length > 0) {
        await supabase
          .from('contact_addresses')
          .insert(
            validAddresses.map((a, idx) => ({
              company_id: user.company.id,
              contact_id: contactId,
              cep: a.cep.replace(/\D/g, '') || null,
              street: a.street.trim() || null,
              number: a.number.trim() || null,
              complement: a.complement.trim() || null,
              neighborhood: a.neighborhood.trim() || null,
              city: a.city.trim() || null,
              state: a.state.trim() || null,
              is_primary: idx === 0
            }))
          );
      }

      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao salvar contato: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        
        {/* Topo do Modal */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="pr-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Novo Contato</h2>
            <p className="text-xs text-slate-500">Cadastre um cliente, fornecedor ou parceiro no Lume.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Bloqueio se o usuário não tiver permissão */}
        {!loadingPermissions && !permissions.canCreateEditContacts ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldAlert size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Acesso Restrito</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Seu nível de acesso atual não possui permissão para cadastrar novos contatos.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Área Rolável do Formulário */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* 1. Tipo de Contato */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Tipo de Contato
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200/90">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('person')}
                    className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      type === 'person'
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    }`}
                  >
                    <User size={14} />
                    <span>Pessoa Física (PF)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('company')}
                    className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      type === 'company'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    }`}
                  >
                    <Building2 size={14} />
                    <span>Pessoa Jurídica (PJ)</span>
                  </button>
                </div>
              </div>

              {/* 2. Relação Comercial & Origem */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Relação Comercial
                  </label>
                  <select
                    value={businessRelation}
                    onChange={(e: any) => setBusinessRelation(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-colors"
                  >
                    <option value="cliente">Cliente</option>
                    <option value="lead">Lead / Oportunidade</option>
                    <option value="fornecedor">Fornecedor</option>
                    <option value="parceiro">Parceiro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <Compass size={13} className="text-slate-400" />
                    <span>Origem / Canal de Captação</span>
                  </label>
                  <select
                    value={leadSource}
                    onChange={(e) => setLeadSource(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-colors"
                  >
                    <option value="indicacao">Indicação / Boca a boca</option>
                    <option value="instagram">Instagram / Redes Sociais</option>
                    <option value="whatsapp">WhatsApp / Contato Direto</option>
                    <option value="google">Google / Site Orgânico</option>
                    <option value="anuncio">Anúncio Pago (Meta / Google)</option>
                    <option value="prospeccao">Prospecção Ativa / Outbound</option>
                    <option value="evento">Evento / Feira Comercial</option>
                    <option value="outro">Outro canal</option>
                  </select>
                </div>
              </div>

              {/* 3. Dados Principais */}
              {type === 'person' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: João da Silva"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">CPF</label>
                    <input
                      type="text"
                      value={cpf}
                      onChange={(e) => setCpf(maskCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Cargo / Ocupação</label>
                    <input
                      type="text"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      placeholder="Ex: Diretor Comercial"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">CNPJ (com busca automática)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={cnpj}
                        onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
                        onBlur={handleCnpjBlur}
                        placeholder="00.000.000/0000-00"
                        maxLength={18}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                      {searchingCnpj && (
                        <Loader2 size={15} className="animate-spin absolute right-3 top-3 text-indigo-500" />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Inscrição Estadual</label>
                    <input
                      type="text"
                      value={stateRegistration}
                      onChange={(e) => setStateRegistration(e.target.value)}
                      placeholder="Isento ou Nº"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Razão Social *</label>
                    <input
                      type="text"
                      required
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                      placeholder="Ex: Ciclo Tecnologia LTDA"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nome Fantasia</label>
                    <input
                      type="text"
                      value={tradeName}
                      onChange={(e) => setTradeName(e.target.value)}
                      placeholder="Ex: Ciclo Energia"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    />
                  </div>
                </div>
              )}

              {/* 4. Múltiplos Telefones */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Phone size={13} className="text-slate-400" /> Telefones / WhatsApp
                  </label>
                  <button
                    type="button"
                    onClick={() => setPhones(prev => [...prev, { phone_number: '', is_whatsapp: true }])}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:underline cursor-pointer"
                  >
                    <Plus size={13} /> Adicionar
                  </button>
                </div>

                <div className="space-y-2">
                  {phones.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={p.phone_number}
                        onChange={(e) => {
                          const val = maskPhone(e.target.value);
                          setPhones(prev => prev.map((item, i) => i === idx ? { ...item, phone_number: val } : item));
                        }}
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                        className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer px-1.5 shrink-0">
                        <input
                          type="checkbox"
                          checked={p.is_whatsapp}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setPhones(prev => prev.map((item, i) => i === idx ? { ...item, is_whatsapp: val } : item));
                          }}
                          className="accent-sky-600"
                        />
                        WhatsApp
                      </label>
                      {phones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPhones(prev => prev.filter((_, i) => i !== idx))}
                          className="p-2 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer transition-colors"
                          title="Remover telefone"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Múltiplos E-mails */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail size={13} className="text-slate-400" /> E-mails
                  </label>
                  <button
                    type="button"
                    onClick={() => setEmails(prev => [...prev, { email: '' }])}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:underline cursor-pointer"
                  >
                    <Plus size={13} /> Adicionar
                  </button>
                </div>

                <div className="space-y-2">
                  {emails.map((em, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="email"
                        value={em.email}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEmails(prev => prev.map((item, i) => i === idx ? { ...item, email: val } : item));
                        }}
                        placeholder="contato@empresa.com"
                        className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                      />
                      {emails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setEmails(prev => prev.filter((_, i) => i !== idx))}
                          className="p-2 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer transition-colors"
                          title="Remover e-mail"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. Múltiplos Endereços */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin size={13} className="text-slate-400" /> Endereços
                  </h4>
                  <button
                    type="button"
                    onClick={() => setAddresses(prev => [
                      ...prev,
                      { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
                    ])}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:underline cursor-pointer"
                  >
                    <Plus size={13} /> Adicionar
                  </button>
                </div>

                <div className="space-y-3">
                  {addresses.map((addr, idx) => (
                    <div key={idx} className="p-3 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-2.5 relative group">
                      {addresses.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setAddresses(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer transition-colors"
                          title="Remover este endereço"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">CEP</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={addr.cep}
                              onChange={(e) => {
                                const val = maskCEP(e.target.value);
                                setAddresses(prev => prev.map((item, i) => i === idx ? { ...item, cep: val } : item));
                              }}
                              onBlur={() => handleCepBlur(idx)}
                              placeholder="00000-000"
                              maxLength={9}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                            {addr.searchingCep && (
                              <Loader2 size={13} className="animate-spin absolute right-2.5 top-2.5 text-slate-400" />
                            )}
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Logradouro / Rua</label>
                          <input
                            type="text"
                            value={addr.street}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAddresses(prev => prev.map((item, i) => i === idx ? { ...item, street: val } : item));
                            }}
                            placeholder="Av. Principal"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Número</label>
                          <input
                            type="text"
                            value={addr.number}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAddresses(prev => prev.map((item, i) => i === idx ? { ...item, number: val } : item));
                            }}
                            placeholder="123"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Complemento</label>
                          <input
                            type="text"
                            value={addr.complement}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAddresses(prev => prev.map((item, i) => i === idx ? { ...item, complement: val } : item));
                            }}
                            placeholder="Sala, Apto"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bairro</label>
                          <input
                            type="text"
                            value={addr.neighborhood}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAddresses(prev => prev.map((item, i) => i === idx ? { ...item, neighborhood: val } : item));
                            }}
                            placeholder="Centro"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cidade / UF</label>
                          <div className="flex items-center gap-1 w-full">
                            <input
                              type="text"
                              placeholder="Cidade"
                              value={addr.city}
                              onChange={(e) => {
                                const val = e.target.value;
                                setAddresses(prev => prev.map((item, i) => i === idx ? { ...item, city: val } : item));
                              }}
                              className="min-w-0 flex-1 px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                            <input
                              type="text"
                              placeholder="UF"
                              maxLength={2}
                              value={addr.state}
                              onChange={(e) => {
                                const val = e.target.value.toUpperCase();
                                setAddresses(prev => prev.map((item, i) => i === idx ? { ...item, state: val } : item));
                              }}
                              className="w-11 shrink-0 px-1 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 text-center uppercase focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Rodapé Fixo de Ações */}
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
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-2xs disabled:opacity-50 transition-all cursor-pointer active:scale-98"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Salvar Contato
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};