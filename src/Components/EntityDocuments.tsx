import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  FileText,
  UploadCloud,
  File,
  Image,
  FileCode,
  Trash2,
  Download,
  Eye,
  Loader2,
  X,
  ExternalLink} from 'lucide-react';

export interface DocumentItem {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string | null;
  document_type: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
  created_by_name?: string;
}

interface EntityDocumentsProps {
  entityType: 'contact' | 'opportunity';
  entityId: string;
  companyId: string;
}

const DOCUMENT_CATEGORIES: Record<string, string> = {
  identificacao: 'Documento de Identificação (RG / CNH / CPF)',
  comprovante_residencia: 'Comprovante de Endereço',
  contrato_social: 'Contrato Social / Cartão CNPJ',
  proposta: 'Proposta Comercial / Orçamento',
  contrato: 'Contrato Assinado',
  laudo_tecnico: 'Laudo Técnico / Parecer de Engenharia',
  projeto_eletrico: 'Projeto Elétrico / Diagrama Unifilar',
  fatura_energia: 'Conta / Fatura de Energia',
  comprovante_pagamento: 'Comprovante de Pagamento',
  outro: 'Outro Documento'
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const EntityDocuments: React.FC<EntityDocumentsProps> = ({
  entityType,
  entityId,
  companyId
}) => {
  const { user } = useAuth();
  const { permissions } = usePermissions();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string; isImage: boolean } | null>(null);

  // Estados do formulário de Upload
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocType, setSelectedDocType] = useState('outro');
  const [docDescription, setDocDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    if (!entityId || !companyId) return;

    try {
      setLoading(true);

      let query = supabase
        .from('attachments')
        .select(`
          id,
          file_name,
          file_path,
          file_size,
          content_type,
          document_type,
          description,
          created_at,
          created_by,
          profile:profiles!created_by(full_name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (entityType === 'contact') {
        query = query.eq('contact_id', entityId);
      } else {
        query = query.eq('opportunity_id', entityId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped: DocumentItem[] = (data || []).map((doc: any) => ({
        id: doc.id,
        file_name: doc.file_name,
        file_path: doc.file_path,
        file_size: doc.file_size || 0,
        content_type: doc.content_type,
        document_type: doc.document_type || 'outro',
        description: doc.description,
        created_at: doc.created_at,
        created_by: doc.created_by,
        created_by_name: doc.profile?.full_name || 'Usuário'
      }));

      setDocuments(mapped);
    } catch (err) {
      console.error('Erro ao carregar documentos:', err);
    } finally {
      setLoading(false);
    }
  }, [entityId, companyId, entityType]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowUploadModal(true);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !entityId || !companyId || uploading) return;

    try {
      setUploading(true);
      const currentUserId = user?.profile?.id || user?.id;

      // Sanitiza o nome do arquivo
      const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `documents/${entityType}/${entityId}/${Date.now()}_${sanitizedName}`;

      // 1. Upload no Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from('company-assets')
        .upload(storagePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadErr) throw uploadErr;

      // 2. Registro na tabela attachments
      const payload: any = {
        company_id: companyId,
        contact_id: entityType === 'contact' ? entityId : null,
        opportunity_id: entityType === 'opportunity' ? entityId : null,
        created_by: currentUserId || null,
        file_name: selectedFile.name,
        file_path: storagePath,
        file_size: selectedFile.size,
        content_type: selectedFile.type,
        document_type: selectedDocType,
        description: docDescription.trim() || null
      };

      const { error: dbErr } = await supabase.from('attachments').insert(payload);
      if (dbErr) throw dbErr;

      setShowUploadModal(false);
      setSelectedFile(null);
      setDocDescription('');
      setSelectedDocType('outro');
      if (fileInputRef.current) fileInputRef.current.value = '';

      await fetchDocuments();
    } catch (err: any) {
      console.error('Falha no upload:', err);
      alert(`Erro ao enviar arquivo: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setUploading(false);
    }
  };

  const getFileUrl = (filePath: string) => {
    const { data } = supabase.storage.from('company-assets').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleViewDocument = (doc: DocumentItem) => {
    const url = getFileUrl(doc.file_path);
    const isImage = (doc.content_type || '').startsWith('image/');
    const isPdf = (doc.content_type || '').includes('pdf') || doc.file_name.toLowerCase().endsWith('.pdf');

    if (isImage || isPdf) {
      setPreviewDoc({ url, name: doc.file_name, isImage });
    } else {
      window.open(url, '_blank');
    }
  };

  const handleDeleteDocument = async (doc: DocumentItem) => {
    const canDelete = permissions.isOwnerOrAdmin || doc.created_by === (user?.profile?.id || user?.id);
    if (!canDelete) {
      alert('Você não tem permissão para excluir este documento.');
      return;
    }

    if (!window.confirm(`Deseja excluir o documento "${doc.file_name}"?`)) return;

    try {
      // 1. Remove do storage
      await supabase.storage.from('company-assets').remove([doc.file_path]);

      // 2. Remove da base de dados
      const { error } = await supabase.from('attachments').delete().eq('id', doc.id);
      if (error) throw error;

      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    } catch (err: any) {
      alert(`Falha ao excluir documento: ${err.message}`);
    }
  };

  const getFileIcon = (contentType?: string | null, fileName: string = '') => {
    if (contentType?.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(fileName)) {
      return <Image size={18} className="text-emerald-600" />;
    }
    if (contentType?.includes('pdf') || fileName.toLowerCase().endsWith('.pdf')) {
      return <FileText size={18} className="text-rose-600" />;
    }
    if (/\.(dwg|dxf|cad|zip|rar)$/i.test(fileName)) {
      return <FileCode size={18} className="text-violet-600" />;
    }
    return <File size={18} className="text-sky-600" />;
  };

  return (
    <div className="space-y-4">
      {/* Botão de Ação / Barra Superior */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-100 flex-wrap gap-2">
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Documentos e Anexos ({documents.length})
          </h4>
          <p className="text-[11px] text-slate-400">
            Armazene contratos, faturas, documentos de identificação e laudos técnicos.
          </p>
        </div>

        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-98"
          >
            <UploadCloud size={14} />
            <span>Anexar Documento</span>
          </button>
        </div>
      </div>

      {/* Lista de Documentos */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
          <Loader2 size={20} className="animate-spin text-sky-600" />
          <span className="text-xs">Carregando documentos...</span>
        </div>
      ) : documents.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <UploadCloud size={24} />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-slate-700">Nenhum documento anexado</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Clique no botão acima para fazer upload de contratos, projetos, faturas ou fotos.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {documents.map((doc) => {
            const canDelete = permissions.isOwnerOrAdmin || doc.created_by === (user?.profile?.id || user?.id);

            return (
              <div
                key={doc.id}
                className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-sky-300 hover:shadow-xs transition-all flex flex-col justify-between gap-3 group"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0">
                    {getFileIcon(doc.content_type, doc.file_name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200/60">
                        {DOCUMENT_CATEGORIES[doc.document_type] || doc.document_type}
                      </span>
                    </div>

                    <h5
                      onClick={() => handleViewDocument(doc)}
                      title={doc.file_name}
                      className="font-bold text-xs text-slate-900 group-hover:text-sky-600 transition-colors truncate mt-1 cursor-pointer"
                    >
                      {doc.file_name}
                    </h5>

                    {doc.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                        {doc.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Rodapé do Card */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="truncate pr-2">
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span className="mx-1">•</span>
                    <span>{doc.created_by_name}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleViewDocument(doc)}
                      title="Visualizar documento"
                      className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Eye size={14} />
                    </button>

                    <a
                      href={getFileUrl(doc.file_path)}
                      download={doc.file_name}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Baixar arquivo"
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Download size={14} />
                    </a>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc)}
                        title="Excluir anexo"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Confirmação de Upload com Tipo de Documento */}
      {showUploadModal && selectedFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-50 text-sky-600 rounded-xl">
                  <UploadCloud size={18} />
                </div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Classificar e Enviar Documento
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                  {getFileIcon(selectedFile.type, selectedFile.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 truncate">{selectedFile.name}</p>
                  <p className="text-[11px] text-slate-400">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tipo do Documento *
                </label>
                <select
                  value={selectedDocType}
                  onChange={(e) => setSelectedDocType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  {Object.entries(DOCUMENT_CATEGORIES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Descrição ou Observação (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={docDescription}
                  onChange={(e) => setDocDescription(e.target.value)}
                  placeholder="Ex: Documento assinado pelo sócio em 15/10..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                  }}
                  className="px-3.5 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={14} />
                      <span>Salvar Documento</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Pré-visualização de Arquivos */}
      {previewDoc && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
              <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate pr-4">
                {previewDoc.name}
              </h4>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-slate-500 hover:text-sky-600 bg-white border border-slate-200 rounded-lg cursor-pointer shadow-2xs"
                  title="Abrir em nova aba"
                >
                  <ExternalLink size={15} />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer shadow-2xs"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center p-4">
              {previewDoc.isImage ? (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.name}
                  className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
                />
              ) : (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.name}
                  className="w-full h-full rounded-lg border border-slate-200 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};  