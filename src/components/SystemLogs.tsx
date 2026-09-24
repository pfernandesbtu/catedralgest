import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { AuditLog, Catechist, ClassGroup, SacramentType, Student, UserRole } from '../types';
import { 
  ShieldAlert, 
  RotateCcw, 
  Trash2, 
  Archive, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  Search, 
  Filter, 
  ArrowLeft, 
  Clock, 
  User, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  RefreshCw,
  Info,
  Layers,
  Sparkles,
  ShieldCheck,
  FileJson,
  X,
  PlusCircle,
  Edit3,
  ClipboardCheck,
  Settings as SettingsIcon,
  History as HistoryIcon
} from 'lucide-react';

const SUPPORT_EMAIL = 'suporte@viacaeli.net';

export const SystemLogs: React.FC = () => {
  const navigate = useNavigate();

  // Current logged in user
  const currentUserStr = localStorage.getItem('currentUser');
  const currentUser: Catechist | null = currentUserStr ? JSON.parse(currentUserStr) : null;
  const isAuthorized = currentUser?.email?.toLowerCase().trim() === SUPPORT_EMAIL;

  // State
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [orphanClasses, setOrphanClasses] = useState<Array<{ classId: string; sacrament: string; students: Student[]; attendanceCount: number }>>([]);
  const [catechists, setCatechists] = useState<Catechist[]>([]);
  const [sacraments, setSacraments] = useState<string[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  
  // Modals & UI States
  const [selectedSnapshot, setSelectedSnapshot] = useState<any | null>(null);
  const [expandedOrphans, setExpandedOrphans] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Restore Orphan Class Modal
  const [orphanToRestore, setOrphanToRestore] = useState<{
    classId: string;
    sacrament: SacramentType;
    students: Student[];
  } | null>(null);

  const [restoreForm, setRestoreForm] = useState({
    name: '',
    sacrament: '',
    meetingDay: 3, // default Wednesday (Quarta-feira)
    meetingTime: '19:30',
    startDate: `${new Date().getFullYear()}-02-01`,
    endDate: `${new Date().getFullYear()}-12-20`,
    selectedCatechistIds: [] as string[]
  });

  // Undo confirmation modal
  const [undoTargetLog, setUndoTargetLog] = useState<AuditLog | null>(null);

  // Load and subscribe to DB updates
  useEffect(() => {
    const updateData = () => {
      setLogs(db.getAuditLogs());
      setOrphanClasses(db.getDetectedOrphanClasses());
      setCatechists(db.getCatechists());
      const sysConfig = db.getSystemConfig();
      setSacraments(sysConfig.sacraments && sysConfig.sacraments.length > 0 ? sysConfig.sacraments : ['Crisma', 'Primeira Eucaristia', 'Batismo', 'Perseverança']);
    };

    updateData();
    const unsubscribe = db.onChange(updateData);
    return () => unsubscribe();
  }, []);

  const openRestoreOrphanModal = (orphan: { classId: string; sacrament: string; students: Student[] }) => {
    setOrphanToRestore({
      classId: orphan.classId,
      sacrament: orphan.sacrament as SacramentType,
      students: orphan.students
    });

    const currentYear = new Date().getFullYear();
    setRestoreForm({
      name: `Turma de ${orphan.sacrament || 'Crisma'} (Restaurada)`,
      sacrament: orphan.sacrament || 'Crisma',
      meetingDay: 3, // Quarta-feira
      meetingTime: '19:30',
      startDate: `${currentYear}-02-01`,
      endDate: `${currentYear}-12-20`,
      selectedCatechistIds: []
    });
  };

  const handleConfirmRestoreOrphan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orphanToRestore) return;
    if (!restoreForm.name.trim()) {
      alert("Por favor, preencha o nome da turma.");
      return;
    }

    setIsProcessing(true);
    setFeedbackMsg(null);

    try {
      const selectedNames = catechists
        .filter(c => restoreForm.selectedCatechistIds.includes(c.id))
        .map(c => c.name);

      await db.restoreOrphanClass(
        orphanToRestore.classId,
        {
          name: restoreForm.name.trim(),
          sacrament: restoreForm.sacrament as SacramentType,
          catechistIds: restoreForm.selectedCatechistIds,
          catechistNames: selectedNames,
          meetingDay: Number(restoreForm.meetingDay),
          meetingTime: restoreForm.meetingTime,
          startDate: restoreForm.startDate,
          endDate: restoreForm.endDate,
          meetingDurationMinutes: 60
        },
        currentUser ? { email: currentUser.email, name: currentUser.name, role: currentUser.role } : undefined
      );

      setFeedbackMsg({
        type: 'success',
        text: `Turma "${restoreForm.name}" restaurada com sucesso! ${orphanToRestore.students.length} catequizando(s) foram reconectados.`
      });
      setOrphanToRestore(null);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: `Erro ao restaurar turma: ${err.message}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmUndoAction = async () => {
    if (!undoTargetLog) return;
    setIsProcessing(true);
    setFeedbackMsg(null);

    try {
      await db.undoAuditAction(
        undoTargetLog.id,
        currentUser ? { email: currentUser.email, name: currentUser.name, role: currentUser.role } : undefined
      );

      setFeedbackMsg({
        type: 'success',
        text: `Ação "${undoTargetLog.action}" desfeita com sucesso! O registro foi restaurado no banco de dados.`
      });
      setUndoTargetLog(null);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: `Erro ao desfazer ação: ${err.message}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleOrphanExpanded = (classId: string) => {
    setExpandedOrphans(prev => ({ ...prev, [classId]: !prev[classId] }));
  };

  // If user is not suporte@viacaeli.net
  if (!isAuthorized) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-md w-full text-center shadow-xl space-y-4">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert size={36} />
          </div>
          <h2 className="text-2xl font-black text-slate-900">Acesso Restrito</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Esta tela de auditoria e recuperação de registros é exclusiva para o suporte técnico credenciado (<span className="font-mono font-bold text-slate-800">{SUPPORT_EMAIL}</span>).
          </p>
          <div className="pt-2">
            <button
              onClick={() => navigate('/admin')}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              <ArrowLeft size={18} /> Voltar ao Painel Geral
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.entityName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.entityId || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (actionFilter === 'ALL') return true;
    if (actionFilter === 'DELETES') return log.action.startsWith('DELETE_');
    if (actionFilter === 'APPROVALS') return log.action.includes('APPROVE') || log.action.includes('VALIDATE');
    if (actionFilter === 'UPDATES') return log.action.startsWith('UPDATE_');
    if (actionFilter === 'CREATES') return log.action.startsWith('CREATE_');
    if (actionFilter === 'ATTENDANCE') return log.action.includes('ATTENDANCE');
    if (actionFilter === 'RESTORES') return log.action.startsWith('RESTORE_') || log.action === 'SYSTEM_RECOVERY' || log.action === 'UNARCHIVE_CLASS';
    if (actionFilter === 'ARCHIVES') return log.action.includes('ARCHIVE');
    return log.action === actionFilter;
  });

  const getActionBadge = (action: AuditLog['action']) => {
    switch (action) {
      case 'DELETE_CLASS':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-red-100 text-red-700 border border-red-200"><Trash2 size={12} className="mr-1" /> Exclusão de Turma</span>;
      case 'CREATE_CLASS':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200"><PlusCircle size={12} className="mr-1" /> Nova Turma</span>;
      case 'UPDATE_CLASS':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200"><Edit3 size={12} className="mr-1" /> Edição de Turma</span>;
      case 'RESTORE_CLASS':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 border border-emerald-200"><RotateCcw size={12} className="mr-1" /> Restauração de Turma</span>;
      case 'ARCHIVE_CLASS':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200"><Archive size={12} className="mr-1" /> Turma Encerrada</span>;
      case 'UNARCHIVE_CLASS':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-700 border border-indigo-200"><RotateCcw size={12} className="mr-1" /> Turma Reaberta</span>;
      case 'DELETE_STUDENT':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-700 border border-rose-200"><Trash2 size={12} className="mr-1" /> Exclusão de Aluno</span>;
      case 'CREATE_STUDENT':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200"><PlusCircle size={12} className="mr-1" /> Novo Catequizando</span>;
      case 'UPDATE_STUDENT':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-sky-100 text-sky-800 border border-sky-200"><Edit3 size={12} className="mr-1" /> Edição de Aluno</span>;
      case 'VALIDATE_ATTENDANCE':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-green-100 text-green-800 border border-green-200"><CheckCircle2 size={12} className="mr-1" /> Presença Aprovada</span>;
      case 'REJECT_ATTENDANCE':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-100 text-orange-800 border border-orange-200"><X size={12} className="mr-1" /> Presença Rejeitada</span>;
      case 'DELETE_ATTENDANCE':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-red-100 text-red-700 border border-red-200"><Trash2 size={12} className="mr-1" /> Exclusão de Presença</span>;
      case 'UPDATE_ATTENDANCE':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-800 border border-purple-200"><Edit3 size={12} className="mr-1" /> Edição de Presença</span>;
      case 'MANUAL_ATTENDANCE':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-violet-100 text-violet-800 border border-violet-200"><Clock size={12} className="mr-1" /> Lançamento de Presença</span>;
      case 'APPROVE_REGISTRATION':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-teal-100 text-teal-800 border border-teal-200"><ClipboardCheck size={12} className="mr-1" /> Inscrição Aprovada</span>;
      case 'REJECT_REGISTRATION':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200"><X size={12} className="mr-1" /> Inscrição Recusada</span>;
      case 'CREATE_CATECHIST':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200"><PlusCircle size={12} className="mr-1" /> Novo Usuário</span>;
      case 'UPDATE_CATECHIST':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-800 border border-slate-300"><Edit3 size={12} className="mr-1" /> Edição de Usuário</span>;
      case 'DELETE_CATECHIST':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-red-100 text-red-700 border border-red-200"><Trash2 size={12} className="mr-1" /> Exclusão de Usuário</span>;
      case 'CREATE_EVENT':
      case 'UPDATE_EVENT':
      case 'DELETE_EVENT':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200"><Calendar size={12} className="mr-1" /> {action === 'CREATE_EVENT' ? 'Novo Evento' : action === 'UPDATE_EVENT' ? 'Edição Evento' : 'Exclusão Evento'}</span>;
      case 'UPDATE_CONFIG':
      case 'CREATE_CONFIG':
      case 'DELETE_CONFIG':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-800 border border-slate-300"><SettingsIcon size={12} className="mr-1" /> Configuração</span>;
      case 'SYSTEM_RECOVERY':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-700 border border-blue-200"><ShieldCheck size={12} className="mr-1" /> Recuperação do Sistema</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-700 border border-slate-200">{action}</span>;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-black bg-blue-100 text-blue-800 uppercase tracking-wide">
              Suporte Técnico Avançado
            </span>
            <span className="text-xs text-slate-500 font-mono">suporte@viacaeli.net</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ShieldAlert className="text-blue-600" size={32} />
            Auditoria e Logs de Ações
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Rastreie exclusões e alterações críticas do sistema com capacidade de restauração e reversão imediata.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
          >
            <ArrowLeft size={16} /> Painel Geral
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          feedbackMsg.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-red-50 border-red-200 text-red-900'
        }`}>
          <div className="flex items-center gap-3">
            {feedbackMsg.type === 'success' ? <CheckCircle2 size={20} className="text-emerald-600" /> : <AlertTriangle size={20} className="text-red-600" />}
            <span className="font-semibold text-sm">{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="p-1 hover:bg-black/5 rounded-lg">
            <X size={16} />
          </button>
        </div>
      )}

      {/* SECTION 1: DETECTED ORPHANED CLASSES (RECOVERY BANNER) */}
      {orphanClasses.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 shadow-sm space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-amber-200/70 text-amber-900 rounded-xl mt-0.5">
                <AlertTriangle size={24} />
              </div>
              <div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black uppercase bg-amber-200 text-amber-900 tracking-wider mb-1">
                  Exclusão Detectada no Banco de Dados
                </span>
                <h2 className="text-lg font-black text-amber-950">
                  {orphanClasses.length} {orphanClasses.length === 1 ? 'Turma Excluída Encontrada' : 'Turmas Excluídas Encontradas'} (Catequizandos Desvinculados)
                </h2>
                <p className="text-xs sm:text-sm text-amber-800 mt-1 max-w-3xl">
                  Identificamos catequizandos cadastrados ativos vinculados a um identificador de turma que foi removido da listagem. Você pode restaurar a turma instantaneamente preservando o ID original, religando todos os catequizandos e mantendo todo o histórico de presenças.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {orphanClasses.map(orphan => {
              const isExpanded = !!expandedOrphans[orphan.classId];
              return (
                <div key={orphan.classId} className="bg-white border border-amber-200 rounded-xl p-5 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black px-2.5 py-1 bg-amber-100 text-amber-900 rounded-md">
                          Sacramento: {orphan.sacrament}
                        </span>
                        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
                          ID: {orphan.classId}
                        </span>
                      </div>
                      <h3 className="font-black text-slate-900 text-base">
                        Turma de {orphan.sacrament} ({orphan.students.length} Catequizandos Afetados)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Total de registros de presença acumulados: <strong className="text-slate-800">{orphan.attendanceCount}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleOrphanExpanded(orphan.classId)}
                        className="px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isExpanded ? 'Ocultar Catequizandos' : `Ver Catequizandos (${orphan.students.length})`}
                      </button>

                      <button
                        onClick={() => openRestoreOrphanModal(orphan)}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-lg text-xs transition-all shadow flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw size={14} /> Desfazer Exclusão / Restaurar Turma
                      </button>
                    </div>
                  </div>

                  {/* Expanded Student List */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        Catequizandos que faziam parte desta turma:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {orphan.students.map(student => (
                          <div key={student.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 truncate pr-2">{student.name}</span>
                            <span className="font-mono bg-white px-1.5 py-0.5 border border-slate-200 rounded text-[10px] text-slate-500 shrink-0">
                              PIN: {student.pin}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: AUDIT LOGS TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Table Top Bar & Search */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Clock size={18} className="text-slate-500" />
              Histórico de Ações e Modificações
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Registros cronológicos de todas as exclusões, arquivamentos e restaurações.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por nome, usuário, ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>

            {/* Action Filter */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-200/70 p-1 rounded-xl text-xs">
              <button
                onClick={() => setActionFilter('ALL')}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors ${actionFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Todos
              </button>
              <button
                onClick={() => setActionFilter('DELETES')}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors ${actionFilter === 'DELETES' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Exclusões
              </button>
              <button
                onClick={() => setActionFilter('APPROVALS')}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors ${actionFilter === 'APPROVALS' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Aprovações
              </button>
              <button
                onClick={() => setActionFilter('UPDATES')}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors ${actionFilter === 'UPDATES' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Alterações
              </button>
              <button
                onClick={() => setActionFilter('CREATES')}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors ${actionFilter === 'CREATES' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Cadastros
              </button>
              <button
                onClick={() => setActionFilter('ATTENDANCE')}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors ${actionFilter === 'ATTENDANCE' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Presenças
              </button>
              <button
                onClick={() => setActionFilter('ARCHIVES')}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors ${actionFilter === 'ARCHIVES' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Arquivamentos
              </button>
              <button
                onClick={() => setActionFilter('RESTORES')}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors ${actionFilter === 'RESTORES' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Restaurações
              </button>
            </div>
          </div>
        </div>

        {/* Logs List / Table */}
        {filteredLogs.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map(log => {
              const reversibleActions = [
                'DELETE_CLASS',
                'DELETE_STUDENT',
                'ARCHIVE_CLASS',
                'DELETE_CATECHIST',
                'DELETE_ATTENDANCE',
                'REJECT_ATTENDANCE',
                'DELETE_EVENT',
                'UPDATE_STUDENT',
                'UPDATE_CLASS'
              ];
              const canUndo = !log.undone && reversibleActions.includes(log.action) && Boolean(log.snapshot);

              return (
                <div key={log.id} className="p-5 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {getActionBadge(log.action)}
                      
                      <span className="text-xs text-slate-400 font-mono">
                        {formatDate(log.timestamp)}
                      </span>

                      {log.undone && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={12} className="mr-1" /> Ação Desfeita / Restaurada
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">
                        {log.entityName || 'Registro sem nome'}
                      </h4>
                      <span className="text-xs text-slate-400 font-mono">
                        ({log.entityType} ID: {log.entityId})
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {log.details || 'Sem detalhes informados.'}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                      <span className="flex items-center gap-1 font-medium">
                        <User size={13} className="text-slate-400" />
                        Executado por: <strong className="text-slate-700">{log.userName}</strong> ({log.userEmail})
                      </span>
                      {log.undone && log.undoneAt && (
                        <span className="text-slate-500">
                          Revertido em: {formatDate(log.undoneAt)} {log.undoneBy ? `por ${log.undoneBy}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                    {/* View Snapshot JSON */}
                    {log.snapshot && (
                      <button
                        onClick={() => setSelectedSnapshot(log.snapshot)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                        title="Ver snapshot salvo dos dados antes da exclusão"
                      >
                        <FileJson size={14} /> Dados Salvos
                      </button>
                    )}

                    {/* Undo / Revert Button */}
                    {canUndo ? (
                      <button
                        onClick={() => setUndoTargetLog(log)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw size={14} /> Desfazer Ação
                      </button>
                    ) : log.undone ? (
                      <span className="px-3 py-1.5 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-lg border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 size={14} /> Restaurado
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mx-auto">
              <HistoryIcon size={24} />
            </div>
            <p className="font-bold text-sm text-slate-700">Nenhum registro de log encontrado</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Quando alguma turma ou catequizando for excluído ou alterado, a ação e seus dados completos serão registrados aqui automaticamente.
            </p>
          </div>
        )}
      </div>

      {/* MODAL: RESTORE ORPHAN CLASS */}
      {orphanToRestore && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-150">
            
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <div>
                <span className="text-[11px] font-black uppercase text-amber-700 tracking-wider">
                  Restauração com Preservação de ID
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  Restaurar Turma Excluída
                </h3>
              </div>
              <button 
                onClick={() => setOrphanToRestore(null)} 
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmRestoreOrphan} className="p-6 space-y-4 overflow-y-auto flex-1">
              
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Info size={14} className="text-blue-600" />
                  ID Original Preservado: <span className="font-mono font-black">{orphanToRestore.classId}</span>
                </p>
                <p>
                  Esta turma será recriada com o mesmo ID do banco de dados. Todos os <strong>{orphanToRestore.students.length} catequizandos</strong> serão reconectados instantaneamente sem nenhuma perda de histórico!
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nome da Turma *
                </label>
                <input
                  type="text"
                  required
                  value={restoreForm.name}
                  onChange={e => setRestoreForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Turma Crisma - Quarta-feira"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Sacramento
                  </label>
                  <select
                    value={restoreForm.sacrament}
                    onChange={e => setRestoreForm(prev => ({ ...prev, sacrament: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {sacraments.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Dia do Encontro
                  </label>
                  <select
                    value={restoreForm.meetingDay}
                    onChange={e => setRestoreForm(prev => ({ ...prev, meetingDay: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value={0}>Domingo</option>
                    <option value={1}>Segunda-feira</option>
                    <option value={2}>Terça-feira</option>
                    <option value={3}>Quarta-feira</option>
                    <option value={4}>Quinta-feira</option>
                    <option value={5}>Sexta-feira</option>
                    <option value={6}>Sábado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Horário
                  </label>
                  <input
                    type="time"
                    value={restoreForm.meetingTime}
                    onChange={e => setRestoreForm(prev => ({ ...prev, meetingTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Início
                  </label>
                  <input
                    type="date"
                    value={restoreForm.startDate}
                    onChange={e => setRestoreForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Término
                  </label>
                  <input
                    type="date"
                    value={restoreForm.endDate}
                    onChange={e => setRestoreForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Catechists Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Vincular Catequistas (Opcional)
                </label>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50">
                  {catechists.map(cat => {
                    const isChecked = restoreForm.selectedCatechistIds.includes(cat.id);
                    return (
                      <label key={cat.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setRestoreForm(prev => ({
                              ...prev,
                              selectedCatechistIds: isChecked
                                ? prev.selectedCatechistIds.filter(id => id !== cat.id)
                                : [...prev.selectedCatechistIds, cat.id]
                            }));
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-bold text-slate-800">{cat.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({cat.role})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOrphanToRestore(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? <RefreshCw className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                  Confirmar e Restaurar Turma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM UNDO ACTION */}
      {undoTargetLog && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <RotateCcw size={24} />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">
                Confirmar Reversão da Ação?
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Você está prestes a desfazer a seguinte ação registrada no sistema:
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <p><strong>Ação:</strong> {undoTargetLog.action}</p>
              <p><strong>Item:</strong> {undoTargetLog.entityName} ({undoTargetLog.entityType})</p>
              <p><strong>Executado por:</strong> {undoTargetLog.userName} ({undoTargetLog.userEmail})</p>
              <p><strong>Data:</strong> {formatDate(undoTargetLog.timestamp)}</p>
            </div>

            <p className="text-xs text-slate-500">
              O documento original salvo no snapshot de auditoria será restaurado no banco de dados e os vínculos serão reestabelecidos.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setUndoTargetLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmUndoAction}
                disabled={isProcessing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? <RefreshCw className="animate-spin" size={14} /> : <RotateCcw size={14} />}
                Confirmar e Restaurar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW SNAPSHOT JSON */}
      {selectedSnapshot && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FileJson size={18} className="text-blue-600" />
                Dados Salvos no Snapshot de Auditoria
              </h3>
              <button onClick={() => setSelectedSnapshot(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto">
                {JSON.stringify(selectedSnapshot, null, 2)}
              </pre>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-end">
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SystemLogs;
