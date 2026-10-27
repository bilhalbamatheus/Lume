import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  Settings,
  MapPin,
  Layers,
  CheckSquare,
  Plus,
  Trash2,
  Edit2,
  Check,
  Loader2,
  Scale,
  Sparkles,
  Users,
  Search,
  Star,
  UserPlus,
  ArrowLeft
} from 'lucide-react';

export interface SettingOption {
  id: string;
  name: string;
  category: 'location' | 'item_type' | 'task_type';
  color?: string;
}

interface WorkerMember {
  user_id: string;
  full_name: string;
  role_title?: string;
  avatar_url?: string | null;
  has_system_access: boolean;
  department_name?: string | null;
}

interface AssignedMember extends WorkerMember {
  member_id: string;
  is_foreman: boolean;
}

interface WorkCustomSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workId?: string;
  currentMeasurementType?: 'por_subitem' | 'por_item' | 'sem_medicao';
  onUpdated?: () => void;
}

const TABLE_MAP = {
  locations: 'work_locations',
  item_types: 'work_item_types',
  task_types: 'work_task_types'
} as const;

export const WorkCustomSettingsModal: React.FC<WorkCustomSettingsModalProps> = ({
  isOpen,
  onClose,
  workId,
  currentMeasurementType = 'por_subitem',
  onUpdated
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'locations' | 'item_types' | 'task_types' | 'measurement' | 'members'>('locations');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSeeds, setLoadingSeeds] = useState(false);

  // Lista de opções das outras abas
  const [options, setOptions] = useState<SettingOption[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#0ea5e9');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#0ea5e9');

  // Medição da Obra
  const [measurementType, setMeasurementType] = useState<'por_subitem' | 'por_item' | 'sem_medicao'>(currentMeasurementType);
  const [savingMeasurement, setSavingMeasurement] = useState(false);

  // Estados da Equipe
  const [allCompanyWorkers, setAllCompanyWorkers] = useState<WorkerMember[]>([]);
  const [assignedMembers, setAssignedMembers] = useState<AssignedMember[]>([]);
  const [selectedWorkerToAdd, setSelectedWorkerToAdd] = useState<WorkerMember | null>(null);
  const [searchWorkerQuery, setSearchWorkerQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [addingWorker, setAddingWorker] = useState(false);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentMeasurementType) {
      setMeasurementType(currentMeasurementType);
    }
  }, [currentMeasurementType]);

  // Fecha dropdown de busca ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const defaultSeeds: Record<'locations' | 'item_types' | 'task_types', Array<{ name: string; color: string }>> = {
    locations: [
      { name: 'Telhado / Cobertura', color: '#0284c7' },
      { name: 'Quadro Geral (QGBT)', color: '#f59e0b' },
      { name: 'Padrão de Entrada', color: '#8b5cf6' },
      { name: 'Casa de Máquinas / Inversores', color: '#10b981' },
      { name: 'Solo / Canteiro Externo', color: '#64748b' }
    ],
    item_types: [
      { name: 'Estruturas de Fixação', color: '#0ea5e9' },
      { name: 'Módulos Fotovoltaicos', color: '#10b981' },
      { name: 'Inversores e Stringbox', color: '#8b5cf6' },
      { name: 'Cabeamento e Eletrocalhas', color: '#f59e0b' },
      { name: 'Civil e Aterramento', color: '#64748b' }
    ],
    task_types: [
      { name: 'Montagem Mecânica', color: '#0ea5e9' },
      { name: 'Passagem e Conexão Elétrica', color: '#f59e0b' },
      { name: 'Comissionamento e Testes', color: '#8b5cf6' },
      { name: 'Inspeção de Qualidade / Check', color: '#10b981' },
      { name: 'Homologação e Concessionária', color: '#ec4899' }
    ]
  };

  // Carrega Colaboradores do RH e quem está alocado nesta obra
  const loadWorkersAndAssigned = useCallback(async () => {
    const companyId = user?.company?.id;
    if (!companyId || !workId) return;

    try {
      setLoading(true);

      const [employeesRes, assignedRes] = await Promise.all([
        supabase
          .from('employee_records')
          .select(`
            user_id,
            has_system_access,
            work_status,
            department:company_departments!department_id ( name ),
            job_position:company_job_positions!job_position_id ( title ),
            profile:profiles!user_id ( id, full_name, role_title, avatar_url )
          `)
          .eq('company_id', companyId)
          .eq('work_status', 'ativo'),

        supabase
          .from('work_members')
          .select('*')
          .eq('work_id', workId)
      ]);

      // 1. Processar todos os funcionários do RH
      const parsedAll: WorkerMember[] = [];
      const seen = new Set<string>();

      (employeesRes.data || []).forEach((emp: any) => {
        const prof = Array.isArray(emp.profile) ? emp.profile[0] : emp.profile;
        if (!prof?.id || seen.has(prof.id)) return;
        seen.add(prof.id);

        const dept = Array.isArray(emp.department) ? emp.department[0] : emp.department;
        const job = Array.isArray(emp.job_position) ? emp.job_position[0] : emp.job_position;

        parsedAll.push({
          user_id: prof.id,
          full_name: prof.full_name || 'Sem Nome',
          role_title: job?.title || prof.role_title || 'Colaborador',
          avatar_url: prof.avatar_url || null,
          has_system_access: Boolean(emp.has_system_access),
          department_name: dept?.name || null
        });
      });

      parsedAll.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setAllCompanyWorkers(parsedAll);

      // 2. Mapear os já alocados nesta obra
      const assignedMap = new Map<string, { id: string; is_foreman: boolean }>();
      (assignedRes.data || []).forEach((row: any) => {
        assignedMap.set(row.user_id, {
          id: row.id,
          is_foreman: Boolean(row.is_foreman)
        });
      });

      const currentAssignedList: AssignedMember[] = [];
      parsedAll.forEach(w => {
        if (assignedMap.has(w.user_id)) {
          const assignData = assignedMap.get(w.user_id)!;
          currentAssignedList.push({
            ...w,
            member_id: assignData.id,
            is_foreman: assignData.is_foreman
          });
        }
      });

      currentAssignedList.sort((a, b) => {
        if (a.is_foreman === b.is_foreman) return a.full_name.localeCompare(b.full_name);
        return a.is_foreman ? -1 : 1;
      });

      setAssignedMembers(currentAssignedList);
    } catch (err) {
      console.error('Erro ao carregar equipe da obra:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.company?.id, workId]);

  const loadSettings = useCallback(async () => {
    if (activeTab === 'measurement') return;

    if (activeTab === 'members') {
      await loadWorkersAndAssigned();
      return;
    }

    const companyId = user?.company?.id;
    if (!companyId || !workId) return;

    const tableName = TABLE_MAP[activeTab];
    const categoryName = activeTab === 'locations' ? 'location' : activeTab === 'item_types' ? 'item_type' : 'task_type';

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('company_id', companyId)
        .eq('work_id', workId)
        .order('name', { ascending: true });

      if (error) throw error;

      setOptions(
        (data || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          color: d.color,
          category: categoryName
        }))
      );
    } catch (err) {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [user?.company?.id, activeTab, workId, loadWorkersAndAssigned]);

  useEffect(() => {
    if (isOpen) {
      setEditingId(null);
      loadSettings();
    }
  }, [isOpen, loadSettings]);

  // Filtro de colaboradores disponíveis para inclusão
  const availableWorkersForAdd = useMemo(() => {
    const assignedIds = new Set(assignedMembers.map(m => m.user_id));
    const term = searchWorkerQuery.toLowerCase().trim();

    return allCompanyWorkers
      .filter(w => !assignedIds.has(w.user_id))
      .filter(w => {
        if (!term) return true;
        return (
          w.full_name.toLowerCase().includes(term) ||
          (w.role_title && w.role_title.toLowerCase().includes(term)) ||
          (w.department_name && w.department_name.toLowerCase().includes(term))
        );
      })
      .slice(0, 15);
  }, [allCompanyWorkers, assignedMembers, searchWorkerQuery]);

  // Ação 1: Adicionar Colaborador à Obra
  const handleAddWorkerToWork = async () => {
    if (!selectedWorkerToAdd || !workId || !user?.company?.id) return;

    try {
      setAddingWorker(true);

      const { data: insertedRow, error } = await supabase
        .from('work_members')
        .insert({
          company_id: user.company.id,
          work_id: workId,
          user_id: selectedWorkerToAdd.user_id,
          is_foreman: false
        })
        .select('id, is_foreman')
        .single();

      if (error) throw error;

      setAssignedMembers(prev => [
        ...prev,
        {
          ...selectedWorkerToAdd,
          member_id: insertedRow.id,
          is_foreman: Boolean(insertedRow.is_foreman)
        }
      ]);

      setSelectedWorkerToAdd(null);
      setSearchWorkerQuery('');
      setIsSearchDropdownOpen(false);
    } catch (err: any) {
      alert('Erro ao alocar colaborador na obra: ' + err.message);
    } finally {
      setAddingWorker(false);
    }
  };

  // Ação 2: Remover Colaborador da Obra
  const handleRemoveWorker = async (userId: string) => {
    if (!workId) return;

    try {
      setActionUserId(userId);
      const { error } = await supabase
        .from('work_members')
        .delete()
        .eq('work_id', workId)
        .eq('user_id', userId);

      if (error) throw error;

      setAssignedMembers(prev => prev.filter(m => m.user_id !== userId));
    } catch (err: any) {
      alert('Erro ao remover colaborador: ' + err.message);
    } finally {
      setActionUserId(null);
    }
  };

  // Ação 3: Alternar Encarregado da Obra
  const handleToggleForeman = async (member: AssignedMember) => {
    if (!workId) return;

    const newForemanStatus = !member.is_foreman;
    try {
      setActionUserId(member.user_id);

      const { error } = await supabase
        .from('work_members')
        .update({ is_foreman: newForemanStatus })
        .eq('work_id', workId)
        .eq('user_id', member.user_id);

      if (error) {
        if (error.message.includes('is_foreman')) {
          alert('Execute no Supabase: ALTER TABLE public.work_members ADD COLUMN IF NOT EXISTS is_foreman boolean DEFAULT false;');
          return;
        }
        throw error;
      }

      setAssignedMembers(prev => {
        const next = prev.map(m => m.user_id === member.user_id ? { ...m, is_foreman: newForemanStatus } : m);
        return next.sort((a, b) => (a.is_foreman === b.is_foreman ? 0 : a.is_foreman ? -1 : 1));
      });
    } catch (err: any) {
      alert('Erro ao definir encarregado: ' + err.message);
    } finally {
      setActionUserId(null);
    }
  };

  // Carregar sugestões padrão para locais, itens ou tarefas
  const handleLoadDefaultSeeds = async () => {
    if (activeTab === 'measurement' || activeTab === 'members') return;
    const companyId = user?.company?.id;
    if (!companyId || !workId) return;

    const tableName = TABLE_MAP[activeTab];
    const seeds = defaultSeeds[activeTab];

    try {
      setLoadingSeeds(true);
      const payload = seeds.map(s => ({
        company_id: companyId,
        work_id: workId,
        name: s.name,
        color: s.color
      }));

      const { error } = await supabase.from(tableName).insert(payload);
      if (error) throw error;

      await loadSettings();
    } catch (err: any) {
      alert('Erro ao carregar sugestões: ' + err.message);
    } finally {
      setLoadingSeeds(false);
    }
  };

  // Adicionar locais, categorias ou tarefas
  const handleAddOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !user?.company?.id || !workId) return;

    const tableName = TABLE_MAP[activeTab as keyof typeof TABLE_MAP];
    setSaving(true);
    try {
      const { error } = await supabase
        .from(tableName)
        .insert({
          company_id: user.company.id,
          work_id: workId,
          name: newName.trim(),
          color: newColor
        });

      if (error) throw error;
      setNewName('');
      await loadSettings();
    } catch (err: any) {
      alert('Erro ao salvar opção: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (opt: SettingOption) => {
    setEditingId(opt.id);
    setEditName(opt.name);
    setEditColor(opt.color || '#0ea5e9');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    const tableName = TABLE_MAP[activeTab as keyof typeof TABLE_MAP];

    try {
      const { error } = await supabase
        .from(tableName)
        .update({ name: editName.trim(), color: editColor })
        .eq('id', id);

      if (error) throw error;
      setEditingId(null);
      await loadSettings();
    } catch (err: any) {
      alert('Erro ao editar item: ' + err.message);
    }
  };

  const handleDeleteOption = async (id: string) => {
    const tableName = TABLE_MAP[activeTab as keyof typeof TABLE_MAP];
    setOptions(prev => prev.filter(o => o.id !== id));

    try {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) {
        await loadSettings();
        throw error;
      }
    } catch (err: any) {
      alert('Erro ao excluir item: ' + err.message);
    }
  };

  const handleSaveMeasurementType = async (selectedType: 'por_subitem' | 'por_item' | 'sem_medicao') => {
    if (!workId) return;

    try {
      setSavingMeasurement(true);
      const { error } = await supabase
        .from('works')
        .update({
          measurement_type: selectedType,
          updated_at: new Date().toISOString()
        })
        .eq('id', workId);

      if (error) throw error;
      setMeasurementType(selectedType);
    } catch (err: any) {
      alert('Erro ao atualizar modelo de medição: ' + err.message);
    } finally {
      setSavingMeasurement(false);
    }
  };

  const handleCloseModal = () => {
    onUpdated?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
      
      {/* Contêiner: 100% Tela no Mobile / Modal Flutuante no Desktop */}
      <div className="bg-white border-0 sm:border sm:border-slate-200 rounded-none sm:rounded-3xl max-w-4xl w-full shadow-2xl flex flex-col h-full sm:h-[82vh] overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleCloseModal}
              className="sm:hidden w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-slate-900 shrink-0"
              title="Voltar"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shrink-0">
              <Settings size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                Parâmetros e Cadastros da Obra
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate hidden sm:block">
                Configure locais, categorias, modelo de medição e a equipe alocada para a execução.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            className="hidden sm:inline-flex text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Barra de Abas no Mobile (< sm): Scroll Horizontal tipo Carrossel */}
        <div className="flex sm:hidden overflow-x-auto no-scrollbar border-b border-slate-200 bg-slate-50/80 px-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('locations')}
            className={`py-2.5 px-3 border-b-2 text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'locations' ? 'border-sky-600 text-sky-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500'
            }`}
          >
            <MapPin size={13} />
            <span>Locais</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('item_types')}
            className={`py-2.5 px-3 border-b-2 text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'item_types' ? 'border-sky-600 text-sky-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500'
            }`}
          >
            <Layers size={13} />
            <span>Tipos de Item</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('task_types')}
            className={`py-2.5 px-3 border-b-2 text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'task_types' ? 'border-sky-600 text-sky-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500'
            }`}
          >
            <CheckSquare size={13} />
            <span>Subitens</span>
          </button>
          {workId && (
            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className={`py-2.5 px-3 border-b-2 text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                activeTab === 'members' ? 'border-sky-600 text-sky-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500'
              }`}
            >
              <Users size={13} />
              <span>Equipe ({assignedMembers.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('measurement')}
            className={`py-2.5 px-3 border-b-2 text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'measurement' ? 'border-emerald-600 text-emerald-800 bg-white rounded-t-lg' : 'border-transparent text-slate-500'
            }`}
          >
            <Scale size={13} />
            <span>Medição</span>
          </button>
        </div>

        {/* Corpo: Menu Lateral no Desktop / Conteúdo Fluido no Mobile */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          
          {/* Menu Lateral de Abas (Desktop) */}
          <aside className="hidden sm:block w-52 sm:w-60 border-r border-slate-100 p-3 bg-slate-50/50 space-y-1.5 shrink-0 text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab('locations');
                setEditingId(null);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium transition-all text-left cursor-pointer ${
                activeTab === 'locations'
                  ? 'bg-sky-50 text-sky-700 font-bold border border-sky-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <MapPin size={15} />
              <span>Locais / Canteiro</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('item_types');
                setEditingId(null);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium transition-all text-left cursor-pointer ${
                activeTab === 'item_types'
                  ? 'bg-sky-50 text-sky-700 font-bold border border-sky-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers size={15} />
              <span>Tipos de Item</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('task_types');
                setEditingId(null);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium transition-all text-left cursor-pointer ${
                activeTab === 'task_types'
                  ? 'bg-sky-50 text-sky-700 font-bold border border-sky-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CheckSquare size={15} />
              <span>Tipos de Subitem</span>
            </button>

            {workId && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('members');
                  setEditingId(null);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium transition-all text-left cursor-pointer ${
                  activeTab === 'members'
                    ? 'bg-sky-50 text-sky-700 font-bold border border-sky-200 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Users size={15} />
                <span>Equipe da Obra ({assignedMembers.length})</span>
              </button>
            )}

            <div className="pt-2 border-t border-slate-200/60 my-1" />

            <button
              type="button"
              onClick={() => {
                setActiveTab('measurement');
                setEditingId(null);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium transition-all text-left cursor-pointer ${
                activeTab === 'measurement'
                  ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Scale size={15} className={activeTab === 'measurement' ? 'text-emerald-600' : 'text-slate-400'} />
              <span>Modelo de Medição</span>
            </button>
          </aside>

          {/* Área Principal de Conteúdo */}
          <main className="flex-1 min-w-0 p-3.5 sm:p-6 overflow-y-auto flex flex-col justify-between">
            
            {/* ABA: EQUIPE DA OBRA (BUSCA ESCALÁVEL E ENCARREGADO) */}
            {activeTab === 'members' ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Equipe Alocada na Obra
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Busque os colaboradores para alocar e defina quem será o Encarregado da obra.
                    </p>
                  </div>

                  <span className="text-xs font-bold text-sky-700 bg-sky-50 px-3 py-1 rounded-xl border border-sky-200 self-start sm:self-auto shrink-0">
                    {assignedMembers.length} {assignedMembers.length === 1 ? 'colaborador' : 'colaboradores'} na equipe
                  </span>
                </div>

                {/* BARRA DE BUSCA + ADIÇÃO */}
                <div ref={searchContainerRef} className="relative bg-slate-50 border border-slate-200 rounded-2xl p-2.5 sm:p-3 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar colaborador no RH por nome, cargo ou setor..."
                      value={selectedWorkerToAdd ? selectedWorkerToAdd.full_name : searchWorkerQuery}
                      onFocus={() => setIsSearchDropdownOpen(true)}
                      onChange={e => {
                        setSelectedWorkerToAdd(null);
                        setSearchWorkerQuery(e.target.value);
                        setIsSearchDropdownOpen(true);
                      }}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />

                    {/* Dropdown com colaboradores disponíveis */}
                    {isSearchDropdownOpen && (
                      <div className="absolute left-0 top-full mt-1.5 w-full bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-56 overflow-y-auto p-1.5 space-y-1 animate-in fade-in duration-100">
                        {availableWorkersForAdd.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400 italic">
                            Nenhum colaborador disponível encontrado.
                          </div>
                        ) : (
                          availableWorkersForAdd.map(worker => (
                            <button
                              key={worker.user_id}
                              type="button"
                              onClick={() => {
                                setSelectedWorkerToAdd(worker);
                                setSearchWorkerQuery(worker.full_name);
                                setIsSearchDropdownOpen(false);
                              }}
                              className="w-full p-2 rounded-xl text-left hover:bg-sky-50 flex items-center justify-between gap-2.5 transition cursor-pointer group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden border border-slate-200">
                                  {worker.avatar_url ? (
                                    <img src={worker.avatar_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    worker.full_name.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-800 group-hover:text-sky-700 truncate">
                                    {worker.full_name}
                                  </p>
                                  <p className="text-[10px] text-slate-400 truncate">
                                    {worker.role_title} {worker.department_name && `• ${worker.department_name}`}
                                  </p>
                                </div>
                              </div>

                              <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                                {worker.has_system_access ? 'Com Acesso' : 'Sem Login'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!selectedWorkerToAdd || addingWorker}
                    onClick={handleAddWorkerToWork}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs transition disabled:opacity-50 cursor-pointer active:scale-98 shrink-0 min-h-[38px]"
                  >
                    {addingWorker ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                    <span>Adicionar à Obra</span>
                  </button>
                </div>

                {/* LISTA DE ALOCADOS NA OBRA */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Colaboradores da Obra
                  </span>

                  {loading ? (
                    <div className="p-10 text-center text-xs text-slate-400">
                      <Loader2 size={18} className="animate-spin mx-auto mb-1 text-sky-600" />
                      Carregando equipe da obra...
                    </div>
                  ) : assignedMembers.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 italic border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      Nenhum colaborador alocado nesta obra ainda. Use o campo acima para adicionar.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl bg-white divide-y divide-slate-100 shadow-2xs max-h-[46vh] sm:max-h-[48vh] overflow-y-auto">
                      {assignedMembers.map(member => {
                        const isUpdating = actionUserId === member.user_id;

                        return (
                          <div
                            key={member.user_id}
                            className={`p-2.5 sm:p-3 sm:px-4 flex items-center justify-between gap-2.5 transition ${
                              member.is_foreman ? 'bg-amber-50/40' : 'hover:bg-slate-50/70'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border ${
                                member.is_foreman 
                                  ? 'bg-amber-500 text-white border-amber-400' 
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {member.avatar_url ? (
                                  <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  member.full_name.charAt(0).toUpperCase()
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-slate-900 truncate">
                                    {member.full_name}
                                  </span>

                                  {member.is_foreman && (
                                    <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-extrabold bg-amber-500 text-white px-1.5 sm:px-2 py-0.5 rounded-md shadow-2xs shrink-0">
                                      <Star size={9} className="fill-white" /> Encarregado
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5">
                                  <span className="truncate">{member.role_title}</span>
                                  {member.department_name && (
                                    <>
                                      <span>•</span>
                                      <span className="font-semibold text-slate-500 truncate">{member.department_name}</span>
                                    </>
                                  )}
                                  {!member.has_system_access && (
                                    <>
                                      <span>•</span>
                                      <span className="text-slate-400 italic shrink-0">Sem login</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Ações da Linha */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleToggleForeman(member)}
                                className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold border transition cursor-pointer active:scale-95 ${
                                  member.is_foreman
                                    ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                                    : 'bg-white text-slate-500 border-slate-200 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50'
                                }`}
                                title={member.is_foreman ? 'Remover função de encarregado' : 'Definir como encarregado responsável'}
                              >
                                <Star size={13} className={member.is_foreman ? 'fill-amber-600 text-amber-600' : ''} />
                                <span className="hidden sm:inline">
                                  {member.is_foreman ? 'Encarregado' : 'Tornar Encarregado'}
                                </span>
                              </button>

                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleRemoveWorker(member.user_id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                                title="Desalocar da obra"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'measurement' ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Como esta obra será medida e faturada?
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Defina a regra para apuração dos Boletins de Medição (BM). Essa definição determina como os valores financeiros serão calculados.
                  </p>
                </div>

                <div className="space-y-2.5 pt-1">
                  <div
                    onClick={() => handleSaveMeasurementType('por_subitem')}
                    className={`p-3.5 sm:p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3.5 ${
                      measurementType === 'por_subitem'
                        ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                      measurementType === 'por_subitem' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {measurementType === 'por_subitem' && <Check size={12} strokeWidth={3} />}
                    </div>
                    <div className="space-y-0.5">
                      <strong className="text-xs font-bold text-slate-900 block">
                        Medição por Subitem / Tarefa (Recomendado)
                      </strong>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Cada atividade operacional possui o seu preço unitário e quantitativo. O boletim apura o valor exato concluído no período.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => handleSaveMeasurementType('por_item')}
                    className={`p-3.5 sm:p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3.5 ${
                      measurementType === 'por_item'
                        ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                      measurementType === 'por_item' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {measurementType === 'por_item' && <Check size={12} strokeWidth={3} />}
                    </div>
                    <div className="space-y-0.5">
                      <strong className="text-xs font-bold text-slate-900 block">
                        Medição por Item / Componente Macro
                      </strong>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        O valor do contrato é distribuído nos componentes principais da EAP. A medição é calculada proporcionalmente ao avanço percentual físico (0% a 100%).
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => handleSaveMeasurementType('sem_medicao')}
                    className={`p-3.5 sm:p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3.5 ${
                      measurementType === 'sem_medicao'
                        ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                      measurementType === 'sem_medicao' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {measurementType === 'sem_medicao' && <Check size={12} strokeWidth={3} />}
                    </div>
                    <div className="space-y-0.5">
                      <strong className="text-xs font-bold text-slate-900 block">
                        Contrato Fechado / Sem Medição Física
                      </strong>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        As tarefas não possuem preços unitários. O faturamento é realizado de forma direta através de parcelas contratuais fixas ou faturas avulsas.
                      </p>
                    </div>
                  </div>
                </div>

                {savingMeasurement && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold pt-1">
                    <Loader2 size={13} className="animate-spin" />
                    <span>Salvando diretriz de medição da obra...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Formulário Inline de Adição */}
                <form onSubmit={handleAddOption} className="bg-slate-50 border border-slate-200 p-2.5 sm:p-3 rounded-2xl flex items-center gap-2 flex-wrap shadow-2xs">
                  <input
                    type="text"
                    required
                    placeholder={
                      activeTab === 'locations'
                        ? 'Ex: Telhado Leste, QGBT...'
                        : activeTab === 'item_types'
                        ? 'Ex: Inversores, Estruturas...'
                        : 'Ex: Montagem, Passagem de Cabos...'
                    }
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="flex-1 min-w-[140px] px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-sky-500"
                  />

                  <div className="flex items-center gap-1.5 shrink-0 bg-white border border-slate-200 px-2 py-1 rounded-xl">
                    <input
                      type="color"
                      value={newColor}
                      onChange={e => setNewColor(e.target.value)}
                      className="w-5 h-5 p-0 border-0 rounded cursor-pointer"
                      title="Escolher cor da etiqueta"
                    />
                    <span className="text-[11px] font-mono text-slate-400">{newColor}</span>
                  </div>

                  <button
                    type="submit"
                    disabled={saving || !newName.trim()}
                    className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition shadow-2xs disabled:opacity-50"
                  >
                    <Plus size={14} />
                    <span>Adicionar</span>
                  </button>
                </form>

                {/* Lista com Edição e Exclusão */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white divide-y divide-slate-100 shadow-2xs">
                  {loading ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      <Loader2 size={16} className="animate-spin mx-auto mb-1 text-sky-600" />
                      Carregando cadastros desta obra...
                    </div>
                  ) : options.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 space-y-3">
                      <p className="italic">Nenhum registro cadastrado nesta categoria para esta obra.</p>
                      <button
                        type="button"
                        disabled={loadingSeeds}
                        onClick={handleLoadDefaultSeeds}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-xl font-bold cursor-pointer transition"
                      >
                        {loadingSeeds ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        <span>Carregar 5 sugestões padrão</span>
                      </button>
                    </div>
                  ) : (
                    options.map(opt => {
                      const isEditing = editingId === opt.id;

                      return (
                        <div
                          key={opt.id}
                          className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                        >
                          {isEditing ? (
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <input
                                type="color"
                                value={editColor}
                                onChange={e => setEditColor(e.target.value)}
                                className="w-5 h-5 p-0 border-0 rounded cursor-pointer shrink-0"
                              />
                              <input
                                type="text"
                                value={editName}
                                autoFocus
                                onChange={e => setEditName(e.target.value)}
                                className="flex-1 px-2.5 py-1 bg-white border border-sky-400 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(opt.id)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"
                                title="Salvar alterações"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg cursor-pointer"
                                title="Cancelar edição"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2.5 min-w-0">
                                {opt.color && (
                                  <span
                                    className="w-3 h-3 rounded-full shrink-0 shadow-2xs border border-white"
                                    style={{ backgroundColor: opt.color }}
                                  />
                                )}
                                <span className="text-xs font-bold text-slate-800 truncate">
                                  {opt.name}
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(opt)}
                                  className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                                  title="Editar item"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOption(opt.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Remover item"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            )}

            {/* Rodapé Fixo */}
            <div className="pt-3.5 border-t border-slate-100 flex justify-end bg-white">
              <button
                type="button"
                onClick={handleCloseModal}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition"
              >
                Concluir
              </button>
            </div>
          </main>

        </div>

      </div>
    </div>
  );
};

export default WorkCustomSettingsModal;