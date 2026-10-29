import React, { useState, useEffect, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { supabase } from '../lib/supabase';
import { 
  User, 
  Camera, 
  Mail, 
  Phone, 
  ShieldCheck, 
  KeyRound, 
  CheckCircle2, 
  Save, 
  Loader2, 
  Lock, 
  ZoomIn, 
  X, 
  Check, 
  Bell,
  Eye,
  EyeOff,
  AlertCircle,
  CreditCard,
  Calendar
} from 'lucide-react';

interface CropArea {
  width: number;
  height: number;
  x: number;
  y: number;
}

interface UserProfileViewProps {
  userId?: string;
  userEmail?: string;
  initialName?: string;
  onProfileUpdated?: (name: string, avatarUrl?: string) => void;
}

interface NotificationSettingsState {
  notify_assigned_tasks: boolean;
  notify_upcoming_deadlines: boolean;
  notify_overdue_tasks: boolean;
  notify_access_changes: boolean;
  notify_platform_news: boolean;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: CropArea
): Promise<{ blob: Blob; url: string }> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Falha ao obter contexto 2D do Canvas.');
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas vazio.'));
        return;
      }
      const url = URL.createObjectURL(blob);
      resolve({ blob, url });
    }, 'image/jpeg', 0.95);
  });
}

const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

const maskCPF = (value: string) => {
  return value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

const maskDate = (value: string) => {
  return value
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/^(\d{2})(\d)/, '$1/$2')
    .replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
};

const dateToInputMask = (isoDate: string) => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
};

const dateToISO = (maskDateStr: string) => {
  const clean = maskDateStr.replace(/\D/g, '');
  if (clean.length !== 8) return null;
  const day = clean.slice(0, 2);
  const month = clean.slice(2, 4);
  const year = clean.slice(4, 8);
  return `${year}-${month}-${day}`;
};

export const UserProfileView: React.FC<UserProfileViewProps> = ({ 
  userId, 
  userEmail, 
  initialName = '',
  onProfileUpdated 
}) => {
  const [activeTab, setActiveTab] = useState<'geral' | 'notificacoes' | 'seguranca'>('geral');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Informações Pessoais
  const [fullName, setFullName] = useState(initialName);
  const [email, setEmail] = useState(userEmail || '');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userRoleName, setUserRoleName] = useState('ADMIN');

  // Preferências de Notificação (Sincronizadas com a tabela user_notification_settings)
  const [notifSettings, setNotifSettings] = useState<NotificationSettingsState>({
    notify_assigned_tasks: true,
    notify_upcoming_deadlines: true,
    notify_overdue_tasks: true,
    notify_access_changes: true,
    notify_platform_news: true,
  });
  const [savingNotifKey, setSavingNotifKey] = useState<string | null>(null);

  // Modal de Recorte / Edição de Avatar
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  // Estados da Lógica de Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);

        const { data: sessionData } = await supabase.auth.getSession();
        const currentId = userId || sessionData.session?.user?.id;
        
        if (sessionData.session?.user?.email) {
          setEmail(sessionData.session.user.email);
        }

        if (!currentId) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentId)
          .maybeSingle();

        if (!error && data) {
          if (data.full_name) setFullName(data.full_name);
          if (data.email) setEmail(data.email);
          setPhone(maskPhone(data.phone || ''));
          setCpf(maskCPF(data.cpf || ''));
          setBirthDate(dateToInputMask(data.birth_date || ''));
          setAvatarUrl(data.avatar_url || null);

          if (data.access_role) {
            const { data: roleData } = await supabase
              .from('company_roles')
              .select('name')
              .eq('id', data.access_role)
              .maybeSingle();
            if (roleData?.name) setUserRoleName(roleData.name);
          } else {
            const { data: membershipData } = await supabase
              .from('memberships')
              .select('role')
              .eq('profile_id', currentId)
              .maybeSingle();
            if (membershipData?.role) {
              setUserRoleName(membershipData.role.toUpperCase());
            }
          }
        }

        // Carrega da nova tabela user_notification_settings
        const { data: settingsData } = await supabase
          .from('user_notification_settings')
          .select('*')
          .eq('user_id', currentId)
          .maybeSingle();

        if (settingsData) {
          setNotifSettings({
            notify_assigned_tasks: settingsData.notify_assigned_tasks ?? true,
            notify_upcoming_deadlines: settingsData.notify_upcoming_deadlines ?? true,
            notify_overdue_tasks: settingsData.notify_overdue_tasks ?? true,
            notify_access_changes: settingsData.notify_access_changes ?? true,
            notify_platform_news: settingsData.notify_platform_news ?? true,
          });
        }
      } catch (err) {
        console.error('Erro ao carregar perfil:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [userId]);

  const handleTogglePreference = async (key: keyof NotificationSettingsState) => {
    const currentVal = notifSettings[key];
    const newVal = !currentVal;

    // Atualização otimista na interface
    setNotifSettings(prev => ({ ...prev, [key]: newVal }));
    setSavingNotifKey(key);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentId = userId || sessionData.session?.user?.id;
      if (!currentId) return;

      const { error } = await supabase
        .from('user_notification_settings')
        .upsert(
          {
            user_id: currentId,
            [key]: newVal,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        );

      if (error) throw error;
    } catch (err) {
      console.error('Erro ao atualizar preferência de notificação:', err);
      // Reverte se houver erro
      setNotifSettings(prev => ({ ...prev, [key]: currentVal }));
    } finally {
      setSavingNotifKey(null);
    }
  };

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const onCropComplete = useCallback((_: any, croppedPixels: CropArea) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleApplyCrop = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;

    try {
      setIsCropping(true);
      const { blob, url } = await getCroppedImg(imageToCrop, croppedAreaPixels);

      setAvatarUrl(url);
      setImageToCrop(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const currentId = userId || sessionData.session?.user?.id;
      if (!currentId) return;

      const fileName = `${currentId}-avatar.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { 
          contentType: 'image/jpeg',
          upsert: true 
        });

      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        if (publicUrlData?.publicUrl) {
          const finalUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
          setAvatarUrl(finalUrl);

          await supabase
            .from('profiles')
            .update({ 
              avatar_url: finalUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', currentId);

          if (onProfileUpdated) {
            onProfileUpdated(fullName, finalUrl);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao recortar imagem:', err);
    } finally {
      setIsCropping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      setSaveSuccess(false);

      const { data: sessionData } = await supabase.auth.getSession();
      const currentId = userId || sessionData.session?.user?.id;

      if (!currentId) {
        alert('Sessão expirada. Inicie sessão novamente.');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          cpf: cpf.trim(),
          birth_date: dateToISO(birthDate),
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentId);

      if (error) {
        alert(`Erro ao guardar perfil: ${error.message}`);
        return;
      }

      setSaveSuccess(true);
      if (onProfileUpdated) {
        onProfileUpdated(fullName.trim(), avatarUrl || undefined);
      }
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError('A nova palavra-passe deve ter no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('A confirmação não coincide com a nova palavra-passe.');
      return;
    }

    if (currentPassword && currentPassword === newPassword) {
      setPasswordError('A nova palavra-passe não pode ser igual à atual.');
      return;
    }

    try {
      setSavingPassword(true);

      if (currentPassword && email) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email,
          password: currentPassword
        });

        if (signInErr) {
          setPasswordError('Palavra-passe atual incorreta. Verifique e tente novamente.');
          setSavingPassword(false);
          return;
        }
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        setPasswordError(`Erro ao atualizar palavra-passe: ${error.message}`);
      } else {
        setPasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(false), 4000);
      }
    } catch {
      setPasswordError('Ocorreu uma falha inesperada ao atualizar a palavra-passe.');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-slate-400 text-sm">
        <Loader2 className="animate-spin mr-2" size={18} />
        A carregar dados do utilizador...
      </div>
    );
  }

  const initial = fullName ? fullName.charAt(0).toUpperCase() : 'U';

  const notificationOptions = [
    {
      key: 'notify_assigned_tasks' as const,
      title: 'Atividades atribuídas a mim',
      description: 'Receber um aviso quando uma nova atividade for atribuída a si.',
    },
    {
      key: 'notify_upcoming_deadlines' as const,
      title: 'Prazos próximos',
      description: 'Receber lembretes antes do vencimento das suas atividades e tarefas.',
    },
    {
      key: 'notify_overdue_tasks' as const,
      title: 'Atividades atrasadas',
      description: 'Receber avisos quando uma atividade sob sua responsabilidade estiver atrasada.',
    },
    {
      key: 'notify_access_changes' as const,
      title: 'Alterações de acesso',
      description: 'Receber avisos sobre permissões concedidas, novos níveis ou atribuições de função.',
    },
    {
      key: 'notify_platform_news' as const,
      title: 'Novidades da Plataforma Lume',
      description: 'Receber informações sobre melhorias importantes e novos recursos da plataforma.',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto flex flex-col lg:h-[calc(100vh-7rem)] overflow-hidden">
      {/* Título de topo */}
      <div className="pb-3 mb-3 border-b border-slate-200 shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Meu Perfil
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Faça a gestão dos seus dados de identificação, canais de contacto e preferências no Lume.
        </p>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleSelectFile} 
        accept="image/*" 
        className="hidden" 
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6 items-start flex-1 min-h-0">
        {/* Painel do Utilizador */}
        <div className="lg:col-span-1 shrink-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 lg:p-5 shadow-2xs">
            <div className="flex items-center gap-3.5 lg:flex-col lg:text-center">
              <div 
                onClick={() => fileInputRef.current?.click()}
                title="Clique para alterar e enquadrar a foto"
                className="group relative h-16 w-16 lg:h-24 lg:w-24 rounded-2xl border-2 border-dashed border-slate-200 hover:border-sky-500 bg-slate-50 hover:bg-sky-50/40 flex items-center justify-center cursor-pointer transition-all overflow-hidden shrink-0 lg:mb-3.5"
              >
                {avatarUrl ? (
                  <>
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] lg:text-[11px] font-semibold gap-1 backdrop-blur-[1px]">
                      <Camera size={13} />
                      Editar
                    </div>
                  </>
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-sky-600 text-white font-bold text-xl lg:text-3xl group-hover:scale-105 transition-transform">
                    {initial}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 lg:w-full">
                <h3 className="font-bold text-slate-900 text-sm truncate">
                  {fullName || 'Utilizador'}
                </h3>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {email}
                </p>
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] lg:text-[10px] font-bold tracking-wide uppercase bg-sky-50 text-sky-700 border border-sky-200/60">
                  <ShieldCheck size={11} />
                  {userRoleName}
                </div>
              </div>
            </div>

            <nav className="mt-3.5 pt-3 border-t border-slate-100 flex lg:flex-col gap-1 overflow-x-auto no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('geral')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 lg:w-full ${
                  activeTab === 'geral'
                    ? 'bg-sky-50 text-sky-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <User size={15} />
                Dados do Perfil
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('notificacoes')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 lg:w-full ${
                  activeTab === 'notificacoes'
                    ? 'bg-sky-50 text-sky-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Bell size={15} />
                Notificações
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('seguranca')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 lg:w-full ${
                  activeTab === 'seguranca'
                    ? 'bg-sky-50 text-sky-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <KeyRound size={15} />
                Segurança e Senha
              </button>
            </nav>
          </div>
        </div>

        {/* Coluna de Conteúdo */}
        <div className="lg:col-span-3 h-full flex flex-col min-h-0">
          {/* ABA GERAL */}
          {activeTab === 'geral' && (
            <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col h-full overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-5">
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3.5 flex items-center gap-2">
                    <User size={15} className="text-slate-400" />
                    INFORMAÇÕES PESSOAIS
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Nome Completo *
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ex: Matheus Bilhalba dos Santos"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        CPF
                      </label>
                      <div className="relative">
                        <CreditCard size={15} className="absolute left-3.5 top-3 text-slate-400" />
                        <input
                          type="text"
                          value={cpf}
                          onChange={(e) => setCpf(maskCPF(e.target.value))}
                          placeholder="000.000.000-00"
                          maxLength={14}
                          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Data de Nascimento
                      </label>
                      <div className="relative">
                        <Calendar size={15} className="absolute left-3.5 top-3 text-slate-400" />
                        <input
                          type="text"
                          value={birthDate}
                          onChange={(e) => setBirthDate(maskDate(e.target.value))}
                          placeholder="DD/MM/AAAA"
                          maxLength={10}
                          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        E-mail de Acesso (Login)
                      </label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3.5 top-3 text-slate-400" />
                        <input
                          type="email"
                          disabled
                          value={email}
                          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-500 cursor-not-allowed shadow-2xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Telemóvel / WhatsApp
                      </label>
                      <div className="relative">
                        <Phone size={15} className="absolute left-3.5 top-3 text-slate-400" />
                        <input
                          type="text"
                          value={phone}
                          onChange={(e) => setPhone(maskPhone(e.target.value))}
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50/90 border-t border-slate-200 px-4 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div>
                  {saveSuccess && (
                    <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200/80">
                      <CheckCircle2 size={15} />
                      Perfil guardado com sucesso!
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      A guardar...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Guardar Alterações
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ABA NOTIFICAÇÕES (Conectada em tempo real com user_notification_settings) */}
          {activeTab === 'notificacoes' && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col h-full overflow-hidden">
              <div className="p-4 sm:p-7 border-b border-slate-200/90 shrink-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Bell size={18} className="text-sky-600" />
                  Notificações do Sistema
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Defina os alertas e lembretes que deseja receber durante as operações no Lume.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {notificationOptions.map((item) => {
                  const isChecked = notifSettings[item.key];
                  const isCurrentSaving = savingNotifKey === item.key;

                  return (
                    <div key={item.key} className="p-4 sm:px-8 flex items-center justify-between gap-4">
                      <div className="space-y-0.5 max-w-xl">
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-900">
                          {item.title}
                        </h4>
                        <p className="text-[11px] sm:text-xs text-slate-500">
                          {item.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={isChecked}
                        disabled={isCurrentSaving}
                        onClick={() => handleTogglePreference(item.key)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isChecked ? 'bg-sky-600' : 'bg-slate-200'
                        } ${isCurrentSaving ? 'opacity-50' : ''}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isChecked ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ABA SEGURANÇA E SENHA */}
          {activeTab === 'seguranca' && (
            <form onSubmit={handleUpdatePassword} className="bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col h-full overflow-hidden">
              <div className="p-4 sm:p-7 border-b border-slate-200/90 shrink-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <KeyRound size={18} className="text-sky-600" />
                  Segurança e Senha
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atualize a sua palavra-passe de autenticação na plataforma Lume.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-lg space-y-4 text-xs sm:text-sm">
                {passwordError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                {passwordSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>Palavra-passe atualizada com sucesso!</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Palavra-passe Atual
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      placeholder="Introduza a sua palavra-passe atual"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Nova Palavra-passe *
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      placeholder="Mínimo de 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Confirmar Nova Palavra-passe *
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      placeholder="Repita a nova palavra-passe"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50/90 border-t border-slate-200 px-4 sm:px-8 py-3 flex items-center justify-end shrink-0">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {savingPassword ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      A atualizar...
                    </>
                  ) : (
                    'Redefinir Palavra-passe'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Modal de Recorte e Enquadramento */}
      {imageToCrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Enquadrar Foto de Perfil</h3>
                <p className="text-xs text-slate-500">Arraste para centralizar o rosto e regule o zoom</p>
              </div>
              <button 
                type="button" 
                onClick={() => setImageToCrop(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative w-full h-64 sm:h-72 bg-slate-900 rounded-2xl overflow-hidden shadow-inner">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <div className="mt-4 px-2 flex items-center gap-3">
              <ZoomIn size={16} className="text-slate-400 shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setImageToCrop(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isCropping}
                onClick={handleApplyCrop}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-2xs cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {isCropping ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    A aplicar...
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    Aplicar Corte
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};