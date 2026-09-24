import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { getSacramentColor } from '../utils/colors';
import { ConfirmModal, ConfirmDialogState } from './ConfirmModal';
import { Catechist, UserRole, SacramentType } from '../types';
import { Plus, Trash2, Edit2, X, UserCog, Mail, Phone, Shield, ShieldCheck, KeyRound, Unlock, FileSpreadsheet, FileText, Ban, BookOpen, GraduationCap, Cross, Calendar } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNavigate } from 'react-router-dom';
import { formatName, formatPhone } from '../utils/formatters';

const CatechistManagement: React.FC = () => {
  const navigate = useNavigate();
  const [catechists, setCatechists] = useState<Catechist[]>([]);
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
  const [sacraments, setSacraments] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<Catechist | null>(null);
  
  // Auth Check
  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
    }
    refreshData();
    const unsubscribe = db.onChange(refreshData);
    return unsubscribe;
  }, []);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('Eucaristia');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    birthDate: '',
    role: UserRole.CATECHIST,
    sacramentSpecialty: 'Todos' as SacramentType | 'Todos'
  });

  useEffect(() => {
      if (currentUser && currentUser.role === UserRole.CATECHIST) {
          setActiveTab(currentUser.sacramentSpecialty || 'Eucaristia');
      } else if (currentUser && currentUser.role === UserRole.MONITOR) {
          setActiveTab('Monitores - ' + (currentUser.sacramentSpecialty || 'Eucaristia'));
      }
  }, [currentUser]);

  const refreshData = () => {
    setCatechists(db.getCatechists());
    setSacraments(db.getSystemConfig().sacraments || []);
  };

  const openModal = (catechist?: Catechist) => {
    if (catechist) {
      setEditingId(catechist.id);
      setFormData({ 
        name: catechist.name, 
        phone: catechist.phone, 
        email: catechist.email,
        birthDate: catechist.birthDate || '',
        role: catechist.role,
        sacramentSpecialty: catechist.sacramentSpecialty || 'Todos'
      });
    } else {
      setEditingId(null);
      setFormData({ 
        name: '', 
        phone: '', 
        email: '',
        birthDate: '',
        role: UserRole.CATECHIST,
        sacramentSpecialty: 'Todos'
      });
    }
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    const dataToSave = {
      ...formData,
      sacramentSpecialty: formData.role === UserRole.PADRE ? null : formData.sacramentSpecialty
    };

    if (editingId) {
      const existing = catechists.find(c => c.id === editingId);
      if (existing) {
        db.updateCatechist({ ...existing, ...dataToSave });
      }
    } else {
      const newCatechist: Catechist = {
        id: Math.random().toString(36).substr(2, 9),
        ...dataToSave
      };
      try {
        db.addCatechist(newCatechist);
      } catch (err: any) {
        alert(err.message);
        return;
      }
    }
    setShowModal(false);
    refreshData();
  };

  const handleDelete = (id: string) => {
    requestConfirm('Tem certeza que deseja excluir este membro da equipe?', () => {
      try {
        db.deleteCatechist(id);
        refreshData();
      } catch (err: any) {
        alert(err.message);
      }
    }, true, "Excluir");
  };

  const handleResetPassword = async (id: string, name: string) => {
      requestConfirm(`Tem certeza que deseja resetar a senha de ${name} para o padrão 'Catedra123'?`, async () => {
          try {
              await db.adminResetPassword(id);
              alert(`Senha de ${name} resetada com sucesso.`);
              refreshData();
          } catch (e: any) {
              alert("Erro ao resetar: " + e.message);
          }
      }, true, "Resetar");
  };

  // --- Export Functions ---
  const handleExportCSV = () => {
    const headers = ['Nome', 'Função', 'Especialidade', 'Data de Nascimento', ...(hasFullAccess ? ['E-mail'] : []), 'Telefone'];
    const rows = activeTabFilteredCatechists.map(c => [
        formatName(c.name),
        c.role,
        c.role === UserRole.PADRE ? '-' : (c.sacramentSpecialty || 'Todos'),
        c.birthDate ? new Date(c.birthDate + 'T12:00:00').toLocaleDateString('pt-BR') : '',
        ...(hasFullAccess ? [c.email] : []),
        formatPhone(c.phone)
    ]);
    let csvContent = "\uFEFF" + headers.join(";") + "\n";
    rows.forEach(row => { csvContent += row.map(i => `"${i}"`).join(";") + "\n"; });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `equipe_pastoral.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text("Relatório da Equipe Pastoral", 14, 20);
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(currentTab === 'Toda a Equipe' ? 'Visão Geral' : currentTab, 14, 28);
    const tableColumn = ["Nome", "Função", "Data Nasc.", ...(hasFullAccess ? ["E-mail"] : []), "Telefone"];
    const tableRows = activeTabFilteredCatechists.map(c => [
        formatName(c.name),
        c.role,
        c.birthDate ? new Date(c.birthDate + 'T12:00:00').toLocaleDateString('pt-BR') : '',
        ...(hasFullAccess ? [c.email] : []),
        formatPhone(c.phone)
    ]);
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 35, headStyles: { fillColor: [29, 78, 216] } });
    doc.save(`equipe_pastoral.pdf`);
  };


  
  const isCoordinator = currentUser?.role === UserRole.COORDINATOR;
  const isPadre = currentUser?.role === UserRole.PADRE;
  const hasFullAccess = isCoordinator;
  let availableTabs: string[] = [];
  if (hasFullAccess || isPadre || currentUser?.sacramentSpecialty === 'Todos') {
      availableTabs = [...sacraments, 'Padre', ...sacraments.map(s => 'Monitores - ' + s), 'Toda a Equipe'];
  } else {
      const spec = currentUser?.sacramentSpecialty || sacraments[0] || 'Eucaristia';
      if (currentUser?.role === UserRole.MONITOR) {
          availableTabs = ['Monitores - ' + spec];
      } else {
          availableTabs = [spec, 'Monitores - ' + spec];
      }
  }

  // Remove the filtering logic that hides tabs if they are empty
  const currentTab = availableTabs.includes(activeTab as any) ? activeTab : (availableTabs[0] as string);

  const activeTabFilteredCatechists = catechists    
    .filter(c => {
      if (currentTab === 'Padre') {
          return c.role === UserRole.PADRE;
      } else if (currentTab === 'Toda a Equipe' || currentTab === 'Todos') {
          return true;
      } else if (currentTab.startsWith('Monitores - ')) {
          const s = currentTab.replace('Monitores - ', '');
          return c.role === UserRole.MONITOR && (c.sacramentSpecialty === s || c.sacramentSpecialty === 'Todos');
      } else {
          return (c.sacramentSpecialty === currentTab || c.sacramentSpecialty === 'Todos') && c.role !== UserRole.PADRE && c.role !== UserRole.MONITOR;
      }
    })
    .sort((a, b) => {
       const idxA = sacraments.indexOf(a.sacramentSpecialty || '');
       const idxB = sacraments.indexOf(b.sacramentSpecialty || '');
       if (idxA !== idxB) return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
       return a.name.localeCompare(b.name);
    });

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Equipe Pastoral</h2>
          <p className="text-slate-600 font-medium">Gestão de Catequistas, Coordenação e Clero</p>
        </div>
        <div className="flex gap-2">
            {hasFullAccess && (
              <>
                <button onClick={handleExportCSV} className="flex items-center px-3 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 font-bold transition-colors shadow-sm text-sm"><FileSpreadsheet size={18} className="mr-2" /> CSV</button>
                <button onClick={handleExportPDF} className="flex items-center px-3 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 font-bold transition-colors shadow-sm text-sm"><FileText size={18} className="mr-2" /> PDF</button>
                <button onClick={() => openModal()} className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg flex items-center font-bold shadow-md transition-colors ml-2"><Plus size={20} className="mr-2" /> Novo Membro</button>
              </>
            )}
        </div>
      </div>

      {availableTabs.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
              {availableTabs.map(tab => (
                  <button 
                      key={tab} 
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                          currentTab === tab 
                          ? 'bg-slate-900 text-white' 
                          : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                      }`}
                  >
                      {tab}
                  </button>
              ))}
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeTabFilteredCatechists.map((member) => (
          <div key={member.id} className="bg-white rounded-xl shadow-md border border-slate-300 p-6 flex flex-col justify-between group hover:border-blue-400 transition-colors">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl border ${member.role === UserRole.PADRE ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : member.role === UserRole.COORDINATOR ? 'bg-purple-100 text-purple-800 border-purple-200' : member.role === UserRole.MONITOR ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                   {member.role === UserRole.PADRE ? <Cross size={24} /> : member.role === UserRole.COORDINATOR ? <ShieldCheck size={24} /> : <UserCog size={24} />}
                </div>
                {hasFullAccess && (
                  <div className="flex gap-1">
                      <button onClick={() => handleResetPassword(member.id, member.name)} className="p-2 text-slate-500 hover:text-orange-600 transition-colors rounded-lg hover:bg-orange-50 border border-transparent hover:border-orange-200" title="Resetar Senha"><Unlock size={18} /></button>
                      <button onClick={() => openModal(member)} className="p-2 text-slate-500 hover:text-blue-700 transition-colors rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200"><Edit2 size={18} /></button>
                      <button onClick={() => handleDelete(member.id)} className="p-2 text-slate-500 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 border border-transparent hover:border-red-200"><Trash2 size={18} /></button>
                  </div>
                )}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{formatName(member.name)}</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black border uppercase ${member.role === UserRole.PADRE ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : member.role === UserRole.COORDINATOR ? 'bg-purple-100 text-purple-800 border-purple-200' : member.role === UserRole.MONITOR ? 'bg-teal-100 text-teal-800 border-teal-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{member.role}</span>
                {member.role !== UserRole.PADRE && (
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black border uppercase ${getSacramentColor(member.sacramentSpecialty || '', db.getSystemConfig().sacramentColors, Math.max(0, sacraments.indexOf(member.sacramentSpecialty || '')))?.badge || 'bg-slate-100 text-slate-700 border-slate-200'}`}>{member.sacramentSpecialty || 'Todos'}</span>
                )}
                {hasFullAccess && member.isDefaultPassword && <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center"><KeyRound size={10} className="mr-1" /> Senha Padrão</span>}
              </div>
              <div className="space-y-2">
                {hasFullAccess && <div className="flex items-center text-sm font-medium text-slate-700"><Mail size={16} className="mr-2 text-slate-400" />{member.email}</div>}
                <div className="flex items-center text-sm font-medium text-slate-700"><Phone size={16} className="mr-2 text-slate-400" />{formatPhone(member.phone)}</div>
                {member.birthDate && (
                  <div className="flex items-center text-sm font-medium text-slate-700"><Calendar size={16} className="mr-2 text-slate-400" />{new Date(member.birthDate + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && hasFullAccess && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-md w-full p-6 animate-in fade-in zoom-in duration-200 relative flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4 flex-shrink-0"><h3 className="text-xl font-black text-slate-900">{editingId ? 'Editar Membro' : 'Novo Membro'}</h3><button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-800 transition-colors bg-slate-100 p-1 rounded-full"><X size={24} /></button></div>
            <form onSubmit={handleSave} className="space-y-5 overflow-y-auto pr-1">
              <div><label className="block text-sm font-bold text-slate-800 mb-1">Nome Completo</label><input required type="text" className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 font-medium placeholder-slate-400" value={formData.name} onChange={e => setFormData({...formData, name: formatName(e.target.value)})} placeholder="Nome do membro" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold text-slate-800 mb-1">Telefone</label><input required type="text" placeholder="(00) 00000-0000" className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 font-medium placeholder-slate-400" value={formData.phone} onChange={e => setFormData({...formData, phone: formatPhone(e.target.value)})} /></div>
                  <div><label className="block text-sm font-bold text-slate-800 mb-1">Data de Nascimento</label><input required type="date" className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 font-medium placeholder-slate-400" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} /></div>
              </div>
              <div><label className="block text-sm font-bold text-slate-800 mb-1">E-mail</label><input required type="email" className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 font-medium placeholder-slate-400" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@exemplo.com" /></div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">Permissão de Acesso</label>
                <div className="grid grid-cols-1 gap-2">
                  <button type="button" onClick={() => setFormData({...formData, role: UserRole.CATECHIST})} className={`p-3 rounded-lg border text-sm font-bold transition-all text-left flex items-center justify-between ${formData.role === UserRole.CATECHIST ? 'bg-blue-50 border-blue-600 text-blue-900 ring-1 ring-blue-600' : 'bg-white border-slate-300 text-slate-600'}`}><span className="flex items-center"><UserCog size={18} className="mr-2"/> Catequista</span><span className="text-[10px] opacity-70">Acesso básico</span></button>
                  <button type="button" onClick={() => setFormData({...formData, role: UserRole.MONITOR})} className={`p-3 rounded-lg border text-sm font-bold transition-all text-left flex items-center justify-between ${formData.role === UserRole.MONITOR ? 'bg-teal-50 border-teal-600 text-teal-900 ring-1 ring-teal-600' : 'bg-white border-slate-300 text-slate-600'}`}><span className="flex items-center"><UserCog size={18} className="mr-2"/> Monitor</span><span className="text-[10px] opacity-70">Acesso restrito</span></button>
                  <button type="button" onClick={() => setFormData({...formData, role: UserRole.COORDINATOR})} className={`p-3 rounded-lg border text-sm font-bold transition-all text-left flex items-center justify-between ${formData.role === UserRole.COORDINATOR ? 'bg-purple-50 border-purple-600 text-purple-900 ring-1 ring-purple-600' : 'bg-white border-slate-300 text-slate-600'}`}><span className="flex items-center"><ShieldCheck size={18} className="mr-2"/> Coordenador</span><span className="text-[10px] opacity-70">Acesso total</span></button>
                  <button type="button" onClick={() => setFormData({...formData, role: UserRole.PADRE})} className={`p-3 rounded-lg border text-sm font-bold transition-all text-left flex items-center justify-between ${formData.role === UserRole.PADRE ? 'bg-yellow-50 border-yellow-600 text-yellow-900 ring-1 ring-yellow-600' : 'bg-white border-slate-300 text-slate-600'}`}><span className="flex items-center"><Cross size={18} className="mr-2"/> Padre</span><span className="text-[10px] opacity-70">Visão Geral</span></button>
                </div>
              </div>
              {formData.role !== UserRole.PADRE && (
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">Especialidade Pastoral</label>
                  <div className={`grid grid-cols-${sacraments.length + 1} gap-2`}>
                    {sacraments.map((sac, idx) => {
                        const isSelected = formData.sacramentSpecialty === sac;
                        const isEven = idx % 2 === 0;
                        return (
                            <button key={sac} type="button" onClick={() => setFormData({...formData, sacramentSpecialty: sac})} className={`p-2 rounded-lg border text-xs font-black transition-all text-center flex flex-col items-center justify-center ${isSelected ? (isEven ? 'bg-blue-50 border-blue-600 text-blue-900 ring-1 ring-blue-600' : 'bg-red-50 border-red-600 text-red-900 ring-1 ring-red-600') : 'bg-white border-slate-300 text-slate-600'}`}><BookOpen size={16} className="mb-1" /> {sac}</button>
                        );
                    })}
                    <button type="button" onClick={() => setFormData({...formData, sacramentSpecialty: 'Todos'})} className={`p-2 rounded-lg border text-xs font-black transition-all text-center flex flex-col items-center justify-center ${formData.sacramentSpecialty === 'Todos' ? 'bg-green-50 border-green-600 text-green-900 ring-1 ring-green-600' : 'bg-white border-slate-300 text-slate-600'}`}><GraduationCap size={16} className="mb-1" /> Todos</button>
                  </div>
                </div>
              )}
              <div className="pt-4 flex gap-3 border-t border-slate-100 mt-2 flex-shrink-0"><button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 border border-slate-300 bg-white rounded-xl hover:bg-slate-50 text-slate-700 font-bold">Cancelar</button><button type="submit" className="flex-1 py-3 bg-blue-700 text-white rounded-xl hover:bg-blue-800 font-bold shadow-lg shadow-blue-700/20">Salvar</button></div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} />
    </div>
  );
};

export default CatechistManagement;