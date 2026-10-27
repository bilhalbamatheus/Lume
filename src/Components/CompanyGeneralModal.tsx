import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Cropper from 'react-easy-crop';
import { supabase } from '../lib/supabase';
import {
  Building2,
  Camera,
  MapPin,
  Mail,
  Phone,
  FileText,
  CheckCircle2,
  Save,
  Loader2,
  X,
  Check,
  ZoomIn,
  Plus,
  Percent,
  Sparkles,
  Calculator
} from 'lucide-react';

interface CropArea {
  width: number;
  height: number;
  x: number;
  y: number;
}

interface CompanyGeneralModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  onCompanyUpdated?: (name: string, logoUrl?: string) => void;
}

export interface TaxRegimeTemplate {
  label: string;
  desc: string;
  fields: {
    key: string;
    label: string;
    defaultRate: number;
    helpText: string;
    group: 'obrigatorio' | 'patronal' | 'provisao';
  }[];
}

const TAX_REGIMES_CONFIG: Record<string, TaxRegimeTemplate> = {
  simples_anexo_iv: {
    label: 'Simples Nacional - Anexo IV (Construção Civil & Obras)',
    desc: 'Empresas de obras, montagem e instalações no Anexo IV são obrigadas a pagar o INSS Patronal de 20% e RAT/FAP, sendo isentas apenas de Terceiros/Sistema S.',
    fields: [
      { key: 'fgts', label: 'FGTS Mensal', defaultRate: 8.0, helpText: 'Alíquota padrão mensal do FGTS', group: 'obrigatorio' },
      { key: 'inss_patronal', label: 'INSS Patronal', defaultRate: 20.0, helpText: 'Contribuição previdenciária patronal', group: 'patronal' },
      { key: 'rat_fap', label: 'RAT / FAP Ajustado', defaultRate: 2.0, helpText: 'Risco Ambiental do Trabalho × Fator Acidentário', group: 'patronal' },
      { key: 'decimo_terceiro', label: 'Provisão de 13º Salário', defaultRate: 8.33, helpText: 'Fração de 1/12 avos guardada mensalmente', group: 'provisao' },
      { key: 'ferias_terco', label: 'Provisão de Férias + 1/3', defaultRate: 11.11, helpText: 'Férias anuais com terço constitucional', group: 'provisao' },
      { key: 'multa_fgts', label: 'Multa Rescisória (40% FGTS)', defaultRate: 4.0, helpText: 'Reserva para rescisões sem justa causa', group: 'provisao' },
      { key: 'encargos_provisoes', label: 'Encargos s/ 13º e Férias', defaultRate: 5.44, helpText: 'Incidência de FGTS e INSS sobre as provisões', group: 'provisao' }
    ]
  },
  simples_nacional: {
    label: 'Simples Nacional - Geral / Anexo III (Isento de Patronal)',
    desc: 'Regime simplificado sem recolhimento de INSS Patronal de 20%, RAT ou Sistema S. Apenas FGTS e provisões trabalhistas.',
    fields: [
      { key: 'fgts', label: 'FGTS Mensal', defaultRate: 8.0, helpText: 'Alíquota padrão mensal do FGTS', group: 'obrigatorio' },
      { key: 'decimo_terceiro', label: 'Provisão de 13º Salário', defaultRate: 8.33, helpText: 'Fração de 1/12 avos', group: 'provisao' },
      { key: 'ferias_terco', label: 'Provisão de Férias + 1/3', defaultRate: 11.11, helpText: 'Férias anuais com terço constitucional', group: 'provisao' },
      { key: 'multa_fgts', label: 'Multa Rescisória (40% FGTS)', defaultRate: 4.0, helpText: 'Reserva para rescisões sem justa causa', group: 'provisao' },
      { key: 'encargos_provisoes', label: 'FGTS s/ 13º e Férias', defaultRate: 1.55, helpText: 'Incidência exclusiva de FGTS sobre provisões', group: 'provisao' }
    ]
  },
  lucro_presumido: {
    label: 'Lucro Presumido ou Lucro Real (Regime Completo)',
    desc: 'Regime completo com carga integral: 20% INSS Patronal, Terceiros/Sistema S (~5,8%), RAT/FAP, FGTS e provisões.',
    fields: [
      { key: 'fgts', label: 'FGTS Mensal', defaultRate: 8.0, helpText: 'Alíquota padrão mensal do FGTS', group: 'obrigatorio' },
      { key: 'inss_patronal', label: 'INSS Patronal', defaultRate: 20.0, helpText: 'Contribuição previdenciária da empresa', group: 'patronal' },
      { key: 'sistema_s', label: 'Terceiros / Sistema S', defaultRate: 5.8, helpText: 'SESI, SENAI, INCRA, Salário Educação e SEBRAE', group: 'patronal' },
      { key: 'rat_fap', label: 'RAT / FAP Ajustado', defaultRate: 2.0, helpText: 'Risco Ambiental do Trabalho × FAP', group: 'patronal' },
      { key: 'decimo_terceiro', label: 'Provisão de 13º Salário', defaultRate: 8.33, helpText: 'Fração de 1/12 avos', group: 'provisao' },
      { key: 'ferias_terco', label: 'Provisão de Férias + 1/3', defaultRate: 11.11, helpText: 'Férias anuais com 1/3 constitucional', group: 'provisao' },
      { key: 'multa_fgts', label: 'Multa Rescisória (40% FGTS)', defaultRate: 4.0, helpText: 'Reserva rescisória de FGTS', group: 'provisao' },
      { key: 'encargos_provisoes', label: 'Encargos s/ 13º e Férias', defaultRate: 7.0, helpText: 'INSS + FGTS + Terceiros sobre as provisões', group: 'provisao' }
    ]
  },
  desonerado: {
    label: 'Desoneração da Folha (CPRB)',
    desc: 'O INSS patronal de 20% é substituído pela alíquota sobre o faturamento da empresa (CPRB), mantendo RAT, Sistema S, FGTS e provisões.',
    fields: [
      { key: 'fgts', label: 'FGTS Mensal', defaultRate: 8.0, helpText: 'Alíquota padrão mensal do FGTS', group: 'obrigatorio' },
      { key: 'sistema_s', label: 'Terceiros / Sistema S', defaultRate: 5.8, helpText: 'SESI, SENAI, Salário Educação e SEBRAE', group: 'patronal' },
      { key: 'rat_fap', label: 'RAT / FAP Ajustado', defaultRate: 2.0, helpText: 'Risco de Acidente do Trabalho × FAP', group: 'patronal' },
      { key: 'decimo_terceiro', label: 'Provisão de 13º Salário', defaultRate: 8.33, helpText: 'Fração de 1/12 avos', group: 'provisao' },
      { key: 'ferias_terco', label: 'Provisão de Férias + 1/3', defaultRate: 11.11, helpText: 'Férias anuais com terço constitucional', group: 'provisao' },
      { key: 'multa_fgts', label: 'Multa Rescisória (40% FGTS)', defaultRate: 4.0, helpText: 'Reserva para rescisões sem justa causa', group: 'provisao' },
      { key: 'encargos_provisoes', label: 'Encargos s/ 13º e Férias', defaultRate: 3.11, helpText: 'Encargos sem os 20% patronais sobre provisões', group: 'provisao' }
    ]
  }
};

const maskCNPJ = (value: string) => {
  return value
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

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

const maskCEP = (value: string) => {
  return value
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, '$1-$2');
};

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

  if (!ctx) throw new Error('Falha ao obter contexto 2D do Canvas.');

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
    }, 'image/png');
  });
}

export const CompanyGeneralModal: React.FC<CompanyGeneralModalProps> = ({
  isOpen,
  onClose,
  companyId,
  onCompanyUpdated
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchingCep, setSearchingCep] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Dados Fiscais e Cadastrais
  const [corporateName, setCorporateName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [stateRegistration, setStateRegistration] = useState('');
  const [commercialEmail, setCommercialEmail] = useState('');
  const [commercialPhone, setCommercialPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Parâmetros Tributários & Encargos de Mão de Obra
  const [taxRegime, setTaxRegime] = useState<string>('simples_anexo_iv');
  const [chargesBreakdown, setChargesBreakdown] = useState<Record<string, string>>({});

  // Recorte da Logo
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Endereço
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Inicializa os campos do breakdown quando o regime muda ou quando carrega do banco
  const initializeBreakdown = (regimeKey: string, savedBreakdown?: Record<string, number | string>) => {
    const config = TAX_REGIMES_CONFIG[regimeKey] || TAX_REGIMES_CONFIG.simples_anexo_iv;
    const initialValues: Record<string, string> = {};

    config.fields.forEach(f => {
      if (savedBreakdown && savedBreakdown[f.key] !== undefined && savedBreakdown[f.key] !== null) {
        initialValues[f.key] = savedBreakdown[f.key].toString();
      } else {
        initialValues[f.key] = f.defaultRate.toString();
      }
    });

    setChargesBreakdown(initialValues);
  };

  useEffect(() => {
    async function loadCompanyData() {
      if (!companyId || !isOpen) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .eq('id', companyId)
          .single();

        if (error) {
          console.error('Erro ao carregar empresa:', error.message);
        } else if (data) {
          setCorporateName(data.corporate_name || data.name || '');
          setTradeName(data.trade_name || data.name || '');
          setCnpj(maskCNPJ(data.document || data.cnpj || ''));
          setStateRegistration(data.state_registration || '');
          setCommercialEmail(data.commercial_email || '');
          setCommercialPhone(maskPhone(data.commercial_phone || ''));
          setLogoUrl(data.logo_url || null);

          // Tributário e Encargos
          const loadedRegime = data.tax_regime || 'simples_anexo_iv';
          setTaxRegime(loadedRegime);
          initializeBreakdown(loadedRegime, data.clt_charges_breakdown);

          setCep(maskCEP(data.cep || ''));
          setStreet(data.street || '');
          setNumber(data.number || '');
          setComplement(data.complement || '');
          setNeighborhood(data.neighborhood || '');
          setCity(data.city || '');
          setState((data.state || '').toUpperCase());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadCompanyData();
  }, [companyId, isOpen]);

  // Ao alterar o regime, preenche automaticamente os campos específicos daquele regime
  const handleTaxRegimeChange = (newRegime: string) => {
    setTaxRegime(newRegime);
    initializeBreakdown(newRegime);
  };

  // Atualiza um campo individual de alíquota
  const handleBreakdownRateChange = (fieldKey: string, value: string) => {
    setChargesBreakdown(prev => ({
      ...prev,
      [fieldKey]: value
    }));
  };

  // Soma dinâmica de todos os encargos em tempo real
  const totalCalculatedRate = useMemo(() => {
    const activeConfig = TAX_REGIMES_CONFIG[taxRegime] || TAX_REGIMES_CONFIG.simples_anexo_iv;
    let sum = 0;
    activeConfig.fields.forEach(f => {
      const rawVal = chargesBreakdown[f.key];
      const val = parseFloat((rawVal || '0').replace(',', '.')) || 0;
      sum += val;
    });
    return parseFloat(sum.toFixed(2));
  }, [taxRegime, chargesBreakdown]);

  const handleCepBlur = async () => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    try {
      setSearchingCep(true);
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setStreet(data.logradouro || '');
        setNeighborhood(data.bairro || '');
        setCity(data.localidade || '');
        setState((data.uf || '').toUpperCase());
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setSearchingCep(false);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

      setLogoUrl(url);
      setImageToCrop(null);

      const fileName = `${companyId}-logo-${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, blob, { contentType: 'image/png', upsert: true });

      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage
          .from('company-logos')
          .getPublicUrl(fileName);

        if (publicUrlData?.publicUrl) {
          const finalUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
          setLogoUrl(finalUrl);
          await supabase
            .from('companies')
            .update({ logo_url: finalUrl })
            .eq('id', companyId);

          if (onCompanyUpdated) {
            onCompanyUpdated(tradeName || corporateName, finalUrl);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao recortar logo:', err);
    } finally {
      setIsCropping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSaveSuccess(false);

      const activeConfig = TAX_REGIMES_CONFIG[taxRegime] || TAX_REGIMES_CONFIG.simples_anexo_iv;
      const formattedBreakdown: Record<string, number> = {};
      
      activeConfig.fields.forEach(f => {
        formattedBreakdown[f.key] = parseFloat((chargesBreakdown[f.key] || '0').replace(',', '.')) || 0;
      });

      const updatePayload = {
        name: tradeName.trim() || corporateName.trim(),
        corporate_name: corporateName.trim(),
        trade_name: tradeName.trim(),
        document: cnpj.replace(/\D/g, ''),
        cnpj: cnpj.replace(/\D/g, ''),
        state_registration: stateRegistration.trim(),
        commercial_email: commercialEmail.trim(),
        commercial_phone: commercialPhone.trim(),
        logo_url: logoUrl,
        tax_regime: taxRegime,
        clt_charges_rate_percent: totalCalculatedRate,
        clt_charges_breakdown: formattedBreakdown,
        cep: cep.trim(),
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('companies')
        .update(updatePayload)
        .eq('id', companyId);

      if (error) throw error;

      setSaveSuccess(true);
      if (onCompanyUpdated) {
        onCompanyUpdated(tradeName || corporateName, logoUrl || undefined);
      }
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Erro ao salvar dados corporativos: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const activeRegimeConfig = TAX_REGIMES_CONFIG[taxRegime] || TAX_REGIMES_CONFIG.simples_anexo_iv;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full shadow-2xl flex flex-col h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Topo */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                Dados Gerais & Parâmetros Fiscais
              </h3>
              <p className="text-xs text-slate-500">
                Identidade corporativa, enquadramento tributário e alíquotas de encargos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
            <Loader2 size={20} className="animate-spin text-sky-600 mr-2" />
            Carregando dados corporativos...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-6">
              
              {/* Área da Logomarca */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center gap-5">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoFileChange}
                  accept="image/*"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative w-36 h-24 rounded-xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center cursor-pointer hover:border-sky-500 transition-all overflow-hidden shrink-0 shadow-2xs"
                  title="Clique para enviar ou ajustar logotipo"
                >
                  {logoUrl ? (
                    <>
                      <img src={logoUrl} alt="Logo" className="max-h-20 max-w-[90%] object-contain" />
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-bold gap-1 transition-opacity">
                        <Camera size={13} />
                        Editar Logo
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-2 text-slate-400">
                      <Plus size={18} className="mx-auto mb-1" />
                      <span className="text-[10px] font-bold block">Adicionar Logo</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="font-bold text-slate-900 text-sm">Logomarca Oficial</h4>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                    Utilizada nas folhas timbradas de orçamentos, propostas comerciais e boletins de medição.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-sky-600 hover:underline pt-1 cursor-pointer block"
                  >
                    Fazer upload de nova imagem
                  </button>
                </div>
              </div>

              {/* Informações Fiscais e Cadastrais */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1">
                  <FileText size={14} className="text-slate-400" />
                  <span>Identificação e Contato</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Razão Social *</label>
                    <input
                      type="text"
                      required
                      value={corporateName}
                      onChange={e => setCorporateName(e.target.value)}
                      placeholder="Ex: Ciclo Engenharia e Soluções LTDA"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nome Fantasia</label>
                    <input
                      type="text"
                      value={tradeName}
                      onChange={e => setTradeName(e.target.value)}
                      placeholder="Ex: Ciclo Solar"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">CNPJ</label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={e => setCnpj(maskCNPJ(e.target.value))}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Inscrição Estadual (I.E.)</label>
                    <input
                      type="text"
                      value={stateRegistration}
                      onChange={e => setStateRegistration(e.target.value)}
                      placeholder="Isento ou número de I.E."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Telefone Comercial / WhatsApp</label>
                    <input
                      type="text"
                      value={commercialPhone}
                      onChange={e => setCommercialPhone(maskPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">E-mail Comercial</label>
                    <input
                      type="email"
                      value={commercialEmail}
                      onChange={e => setCommercialEmail(e.target.value)}
                      placeholder="contato@empresa.com.br"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO: REGIME TRIBUTÁRIO COM ITENS DISCRIMINADOS DINAMICAMENTE */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-1">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Percent size={14} className="text-slate-400" />
                    <span>Regime Tributário & Encargos de Mão de Obra (CLT)</span>
                  </h4>
                  <span className="text-[10px] text-sky-600 font-bold flex items-center gap-1">
                    <Sparkles size={11} /> Aplicação automática em todo o RH
                  </span>
                </div>

                <div className="p-4 sm:p-5 bg-sky-50/50 border border-sky-100 rounded-2xl space-y-4 text-xs">
                  
                  {/* Seletor de Regime */}
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Enquadramento Tributário da Empresa *
                    </label>
                    <select
                      value={taxRegime}
                      onChange={e => handleTaxRegimeChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 cursor-pointer focus:ring-2 focus:ring-sky-500"
                    >
                      {Object.entries(TAX_REGIMES_CONFIG).map(([key, item]) => (
                        <option key={key} value={key}>{item.label}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {activeRegimeConfig.desc}
                    </p>
                  </div>

                  {/* Informação sobre a Carga Horária vinculada ao Cargo */}
                  <div className="pt-2 border-t border-sky-100 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">
                        Carga Horária & Divisor de Cálculo da Hora
                      </span>
                      <span className="text-[11px] text-slate-500">
                        A carga horária semanal e o divisor mensal (220h, 200h, 150h) são configurados individualmente em cada <strong>Cargo</strong>.
                      </span>
                    </div>
                  </div>

                  {/* DISCRIMINAÇÃO DINÂMICA DOS ENCARGOS DO REGIME SELECIONADO */}
                  <div className="pt-3 border-t border-sky-100 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <Calculator size={13} className="text-sky-600" />
                        <span>Composição Detalhada dos Encargos (%)</span>
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Ajuste os percentuais conforme orientado pelo seu contador
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {activeRegimeConfig.fields.map(field => {
                        const val = chargesBreakdown[field.key] || field.defaultRate.toString();

                        return (
                          <div
                            key={field.key}
                            className="p-2.5 bg-white border border-slate-200/90 rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-sky-300 transition-colors"
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-slate-800 block text-xs truncate">
                                {field.label}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate" title={field.helpText}>
                                {field.helpText}
                              </span>
                            </div>

                            <div className="relative w-24 shrink-0">
                              <input
                                type="text"
                                required
                                value={val}
                                onChange={e => handleBreakdownRateChange(field.key, e.target.value)}
                                className="w-full px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg font-black text-slate-900 text-xs pr-6 text-right focus:bg-white focus:ring-1 focus:ring-sky-500"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-[11px]">%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* CARD CONSOLIDADOR DO TOTAL */}
                    <div className="p-3 bg-white border-2 border-sky-200 rounded-xl flex items-center justify-between shadow-2xs mt-3">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Alíquota Total Consolidada de Encargos & Provisões
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Soma automática aplicada sobre o salário bruto dos funcionários CLT
                        </span>
                      </div>

                      <div className="text-right">
                        <strong className="text-lg font-black text-sky-700">
                          {totalCalculatedRate.toFixed(2)}%
                        </strong>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1">
                  <MapPin size={14} className="text-slate-400" />
                  <span>Localidade da Sede</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      CEP {searchingCep && <span className="text-sky-600 text-[10px]">(Buscando...)</span>}
                    </label>
                    <input
                      type="text"
                      value={cep}
                      onBlur={handleCepBlur}
                      onChange={e => setCep(maskCEP(e.target.value))}
                      placeholder="00000-000"
                      maxLength={9}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Rua / Logradouro</label>
                    <input
                      type="text"
                      value={street}
                      onChange={e => setStreet(e.target.value)}
                      placeholder="Avenida, Rua..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Número</label>
                    <input
                      type="text"
                      value={number}
                      onChange={e => setNumber(e.target.value)}
                      placeholder="Ex: 100"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Complemento</label>
                    <input
                      type="text"
                      value={complement}
                      onChange={e => setComplement(e.target.value)}
                      placeholder="Sala, Bloco, Galpão..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bairro</label>
                    <input
                      type="text"
                      value={neighborhood}
                      onChange={e => setNeighborhood(e.target.value)}
                      placeholder="Bairro"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Cidade</label>
                    <input
                      type="text"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      placeholder="Cidade"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Estado (UF)</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={state}
                      onChange={e => setState(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase())}
                      placeholder="RS"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl uppercase focus:ring-2 focus:ring-sky-500 font-medium"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Rodapé Fixo */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <div>
                {saveSuccess && (
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 size={15} />
                    Dados e parâmetros tributários salvos com sucesso!
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Salvar Dados</span>
                </button>
              </div>
            </div>
          </form>
        )}

      </div>

      {/* Modal de Crop */}
      {imageToCrop && (
        <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h4 className="font-bold text-sm text-slate-900">Enquadrar Logomarca</h4>
              <button onClick={() => setImageToCrop(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="relative w-full h-72 bg-slate-900 rounded-2xl overflow-hidden shadow-inner">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={16 / 9}
                cropShape="rect"
                showGrid={true}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <div className="flex items-center gap-3">
              <ZoomIn size={15} className="text-slate-400 shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setImageToCrop(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isCropping}
                onClick={handleApplyCrop}
                className="px-4 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isCropping ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                <span>Aplicar Logomarca</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CompanyGeneralModal;