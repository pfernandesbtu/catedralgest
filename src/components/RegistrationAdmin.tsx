
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { ConfirmModal, ConfirmDialogState } from './ConfirmModal';
import { getSacramentColor } from '../utils/colors';
import { RegistrationCampaign, RegistrationSubmission, SacramentType, UserRole } from '../types';
import { Plus, Trash2, Edit2, Calendar, Users, CheckCircle, XCircle, FileText, ClipboardList, Settings, ChevronDown, ChevronUp, Phone, Archive, ArchiveRestore } from 'lucide-react';

const RegistrationAdmin: React.FC = () => {
  const [campaigns, setCampaigns] = useState<RegistrationCampaign[]>([]);
  const [submissions, setSubmissions] = useState<RegistrationSubmission[]>([]);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'submissions'>('campaigns');
  
  // Campaign Form State
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [campTitle, setCampTitle] = useState('');
  const [campSacrament, setCampSacrament] = useState<string>((db.getSystemConfig().sacraments || [])[0] || '');
  const [campStart, setCampStart] = useState('');
  const [campEnd, setCampEnd] = useState('');
  const [campYear, setCampYear] = useState(new Date().getFullYear());
  const [meetingOptionsInput, setMeetingOptionsInput] = useState('');
  const [campActive, setCampActive] = useState(true);
  const [sacraments, setSacraments] = useState<string[]>([]);

  // Submissions Filter
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ isOpen: false, message: '', onConfirm: () => {} });
  const requestConfirm = (message: string, onConfirm: () => void, isDestructive = true, confirmButtonText = 'Confirmar') => {
      setConfirmDialog({
          isOpen: true,
          message,
          onConfirm: () => {
              onConfirm();
              setConfirmDialog(prev => ({...prev, isOpen: false}));
          },
          isDestructive,
          confirmButtonText
      });
  };
  const [showArchivedSubmissions, setShowArchivedSubmissions] = useState(false);

  const refreshData = () => {
    setCampaigns(db.getRegistrationCampaigns());
    setSubmissions(db.getRegistrationSubmissions());
    setSacraments(db.getSystemConfig().sacraments || []);
  };

  useEffect(() => {
    refreshData();
    const unsubscribe = db.onChange(refreshData);
    return unsubscribe;
  }, []);

  // --- Campaign Management ---

  const openCampaignModal = (c?: RegistrationCampaign) => {
      if (c) {
          setEditingId(c.id);
          setCampTitle(c.title);
          setCampSacrament(c.sacrament);
          setCampStart(c.startDate);
          setCampEnd(c.sacramentDate);
          setCampYear(c.year);
          setMeetingOptionsInput(c.meetingOptions.join('; '));
          setCampActive(c.active);
      } else {
          setEditingId(null);
          setCampTitle('');
          setCampSacrament(sacraments[0]);
          setCampStart('');
          setCampEnd('');
          setCampYear(new Date().getFullYear());
          setMeetingOptionsInput('');
          setCampActive(true);
      }
      setShowCampaignModal(true);
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
      e.preventDefault();
      const options = meetingOptionsInput.split(';').map(s => s.trim()).filter(s => s !== '');
      const data: any = {
          title: campTitle,
          sacrament: campSacrament,
          startDate: campStart,
          sacramentDate: campEnd,
          year: campYear,
          meetingOptions: options,
          active: campActive
      };

      try {
          if (editingId) {
              await db.updateRegistrationCampaign({ id: editingId, ...data });
          } else {
              await db.addRegistrationCampaign({ id: Math.random().toString(36).substr(2, 9), ...data });
          }
          setShowCampaignModal(false);
      } catch (err: any) {
          alert("Erro: " + err.message);
      }
  };

  const handleDeleteCampaign = async (id: string) => {
      requestConfirm("Excluir esta campanha? As inscrições associadas não serão apagadas, mas perderão o vínculo.", async () => {
          await db.deleteRegistrationCampaign(id);
          refreshData();
      }, true, "Excluir");
  };

  // --- Submission Management ---

  const handleApprove = (sub: RegistrationSubmission) => {
      requestConfirm(`Confirma a matrícula de ${sub.studentName}? Isso criará um registro oficial de Catequizando.`, async () => {
      
      const campaign = campaigns.find(c => c.id === sub.campaignId);
      if (!campaign) {
          alert("Campanha original não encontrada. Verifique se foi excluída.");
          return;
          return;
      }

      try {
          await db.approveSubmission(sub.id, campaign);
          alert("Matrícula efetivada com sucesso! O Catequizando foi adicionado à lista geral.");
      } catch (err: any) {
          alert("Erro ao aprovar: " + err.message);
      }
      }, false, "Matricular");
  };

  const handleReject = async (id: string) => {
      
      requestConfirm("Deseja rejeitar/arquivar esta inscrição?", async () => {
          await db.rejectSubmission(id);
      }, true, "Rejeitar");
  };

  const filteredSubmissions = submissions.filter(s => {
      const matchesCampaign = selectedCampaignId === 'all' ? true : s.campaignId === selectedCampaignId;
      const matchesStatus = showArchivedSubmissions 
          ? s.status === 'REJECTED' 
          : s.status !== 'REJECTED';
      
      return matchesCampaign && matchesStatus;
  }).sort((a,b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());

  // --- Render ---

  return (
    <div className="p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <h2 className="text-2xl font-black text-slate-900">Inscrições Online</h2>
                <p className="text-slate-600 font-medium">Gerencie as aberturas de turmas e aprove as matrículas recebidas.</p>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={() => setActiveTab('campaigns')}
                    className={`px-4 py-2 rounded-lg font-bold transition-all ${activeTab === 'campaigns' ? 'bg-slate-800 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-300'}`}
                >
                    Configurar Aberturas
                </button>
                <button 
                    onClick={() => setActiveTab('submissions')}
                    className={`px-4 py-2 rounded-lg font-bold transition-all relative ${activeTab === 'submissions' ? 'bg-blue-700 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-300'}`}
                >
                    Gerenciar Inscritos
                    {submissions.some(s => s.status === 'PENDING') && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                    )}
                </button>
            </div>
        </div>

        {/* --- CAMPAIGNS TAB --- */}
        {activeTab === 'campaigns' && (
            <div>
                <button onClick={() => openCampaignModal()} className="mb-6 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg flex items-center font-bold shadow-md">
                    <Plus size={20} className="mr-2" /> Nova Abertura de Inscrição
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {campaigns.map(camp => (
                        <div key={camp.id} className={`bg-white rounded-xl shadow-md border p-6 relative overflow-hidden ${camp.active ? 'border-green-400 ring-1 ring-green-100' : 'border-slate-300 bg-slate-50'}`}>
                            {camp.active && <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">ABERTA</div>}
                            
                            <h3 className="text-lg font-black text-slate-900 mb-1">{camp.title}</h3>
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black border uppercase mb-4 ${getSacramentColor(camp.sacrament, db.getSystemConfig().sacramentColors, sacraments.indexOf(camp.sacrament)).badge}`}>
                                {camp.sacrament} • {camp.year}
                            </span>

                            <div className="space-y-2 text-sm text-slate-600">
                                {/* FIX: Add T12:00:00 to prevent timezone rollback */}
                                <div className="flex items-center"><Calendar size={14} className="mr-2 text-slate-400" /> Início: {new Date(camp.startDate + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                                <div className="flex items-center"><CheckCircle size={14} className="mr-2 text-slate-400" /> Sacramento: {new Date(camp.sacramentDate + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                                <div className="flex items-start"><Users size={14} className="mr-2 text-slate-400 mt-0.5" /> <span className="flex-1">{camp.meetingOptions.join(', ')}</span></div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end gap-2">
                                <button onClick={() => openCampaignModal(camp)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={18} /></button>
                                <button onClick={() => handleDeleteCampaign(camp.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- SUBMISSIONS TAB --- */}
        {activeTab === 'submissions' && (
            <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <span className="font-bold text-slate-700 flex items-center"><Settings size={18} className="mr-2"/> Filtrar Campanha:</span>
                        <select 
                            className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none font-medium"
                            value={selectedCampaignId}
                            onChange={e => setSelectedCampaignId(e.target.value)}
                        >
                            <option value="all">Todas</option>
                            {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                    </div>
                    
                    <button 
                        onClick={() => setShowArchivedSubmissions(!showArchivedSubmissions)}
                        className={`flex items-center px-3 py-2 rounded-lg font-bold text-sm transition-colors ${showArchivedSubmissions ? 'bg-slate-200 text-slate-800' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                    >
                        {showArchivedSubmissions ? <ArchiveRestore size={16} className="mr-2" /> : <Archive size={16} className="mr-2" />}
                        {showArchivedSubmissions ? "Ver Ativos/Pendentes" : "Ver Arquivados"}
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-bold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Candidato</th>
                                <th className="px-6 py-4">Responsáveis</th>
                                <th className="px-6 py-4">Opção de Horário</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredSubmissions.map(sub => (
                                <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                                        {new Date(sub.submissionDate).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-slate-900">{sub.studentName}</p>
                                        <div className="flex flex-wrap items-center text-xs text-slate-500 mt-1 gap-x-2 gap-y-1">
                                            {/* FIX: Add T12:00:00 to prevent timezone rollback */}
                                            <span>Nasc: {new Date(sub.birthDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                                            {sub.studentPhone && (
                                                <span className="flex items-center text-green-700 font-bold bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                                                    <Phone size={10} className="mr-1" /> {sub.studentPhone}
                                                </span>
                                            )}
                                            {sub.isBaptized && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">Batizado</span>}
                                            {sub.hasFirstEucaristia && <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-bold">1ª Eucaristia</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {sub.fatherName && <div><span className="font-bold text-xs">Pai:</span> {sub.fatherName} {sub.fatherPhone && `(${sub.fatherPhone})`} {sub.fatherEmail && <span className="text-slate-400 text-xs block truncate">{sub.fatherEmail}</span>}</div>}
                                        {sub.motherName && <div className="mt-1"><span className="font-bold text-xs">Mãe:</span> {sub.motherName} {sub.motherPhone && `(${sub.motherPhone})`} {sub.motherEmail && <span className="text-slate-400 text-xs block truncate">{sub.motherEmail}</span>}</div>}
                                        {sub.guardianName && <div className="mt-1"><span className="font-bold text-xs">Resp:</span> {sub.guardianName} {sub.guardianPhone && `(${sub.guardianPhone})`} {sub.guardianEmail && <span className="text-slate-400 text-xs block truncate">{sub.guardianEmail}</span>}</div>}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-blue-700">
                                        {sub.preferredMeetingTime}
                                    </td>
                                    <td className="px-6 py-4">
                                        {sub.status === 'PENDING' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">Pendente</span>}
                                        {sub.status === 'APPROVED' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">Matriculado</span>}
                                        {sub.status === 'REJECTED' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">Arquivado</span>}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {sub.status === 'PENDING' && (
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => handleApprove(sub)} className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 shadow-sm" title="Efetivar Matrícula">
                                                    <CheckCircle size={18} />
                                                </button>
                                                <button onClick={() => handleReject(sub.id)} className="bg-white border border-slate-300 text-slate-500 p-2 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200" title="Arquivar">
                                                    <XCircle size={18} />
                                                </button>
                                            </div>
                                        )}
                                        {sub.status !== 'PENDING' && <span className="text-slate-400 text-xs">-</span>}
                                    </td>
                                </tr>
                            ))}
                            {filteredSubmissions.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-medium">Nenhuma inscrição encontrada com este filtro.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* Modal Nova Campanha */}
        {showCampaignModal && (
            <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200">
                    <h3 className="text-xl font-black mb-6">{editingId ? 'Editar Abertura' : 'Nova Abertura de Inscrição'}</h3>
                    <form onSubmit={handleSaveCampaign} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
                        <div><label className="block text-sm font-bold mb-1">Título da Campanha</label><input required className="w-full border rounded-lg px-3 py-2" placeholder="Ex: Crisma 2026 - Inscrições Abertas" value={campTitle} onChange={e => setCampTitle(e.target.value)}/></div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><label className="block text-sm font-bold mb-1">Sacramento</label><select className="w-full border rounded-lg px-3 py-2" value={campSacrament} onChange={e => setCampSacrament(e.target.value)}>{sacraments.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                            <div><label className="block text-sm font-bold mb-1">Ano Letivo</label><input type="number" className="w-full border rounded-lg px-3 py-2" value={campYear} onChange={e => setCampYear(Number(e.target.value))}/></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><label className="block text-sm font-bold mb-1">Início Provável</label><input type="date" required className="w-full border rounded-lg px-3 py-2" value={campStart} onChange={e => setCampStart(e.target.value)}/></div>
                            <div><label className="block text-sm font-bold mb-1">Data Sacramento (Final)</label><input type="date" required className="w-full border rounded-lg px-3 py-2" value={campEnd} onChange={e => setCampEnd(e.target.value)}/></div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">Opções de Horário (separar por ponto e vírgula)</label>
                            <input required className="w-full border rounded-lg px-3 py-2" placeholder="Sábado 09h; Sábado 16h; Domingo 08h" value={meetingOptionsInput} onChange={e => setMeetingOptionsInput(e.target.value)}/>
                            <p className="text-xs text-slate-500 mt-1">Estas opções aparecerão para os pais escolherem.</p>
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                            <input type="checkbox" id="active" className="w-5 h-5" checked={campActive} onChange={e => setCampActive(e.target.checked)} />
                            <label htmlFor="active" className="font-bold text-slate-700">Inscrições Abertas (Visível ao Público)</label>
                        </div>
                        <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowCampaignModal(false)} className="flex-1 py-2 border rounded-lg font-bold">Cancelar</button><button type="submit" className="flex-1 py-2 bg-blue-700 text-white rounded-lg font-bold">Salvar</button></div>
                    </form>
                </div>
            </div>
        )}
      <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} />
    </div>
  );
};

export default RegistrationAdmin;
