
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { ConfirmModal, ConfirmDialogState } from './ConfirmModal';
import { getSacramentColor } from '../utils/colors';
import { Student, ClassGroup, SacramentType, Catechist, UserRole } from '../types';
import { Search, Plus, Filter, Trash2, Edit2, X, RefreshCw, User, Phone, Users, Calendar, Contact, BookOpen, Mail } from 'lucide-react';
import { formatName, formatPhone } from '../utils/formatters';

const StudentManagement: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [sacraments, setSacraments] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  // Auth & Permissions
  const currentUserStr = localStorage.getItem('currentUser');
  const currentUser: Catechist | null = currentUserStr ? JSON.parse(currentUserStr) : null;
  
  const isCoordinator = currentUser?.role === UserRole.COORDINATOR;
  const isPadre = currentUser?.role === UserRole.PADRE;
  const hasFullAccess = isCoordinator;
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    classId: '',
    sacrament: '',
    pin: '',
    birthDate: '',
    fatherName: '',
    fatherPhone: '',
    fatherEmail: '',
    motherName: '',
    motherPhone: '',
    motherEmail: '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    guardianRelationship: '',
    isBaptized: false,
    baptismPlace: '',
    hasFirstEucaristia: false,
    firstEucaristiaPlace: ''
  });

  const refreshData = () => {
    let allStudents = db.getStudents();
    let allClasses = db.getClasses();

    if (!hasFullAccess && !isPadre && currentUser) {
        const myClassIds = allClasses.filter(c => c.catechistIds.includes(currentUser.id)).map(c => c.id);
        allStudents = allStudents.filter(s => myClassIds.includes(s.classId));
        allClasses = allClasses.filter(c => myClassIds.includes(c.id));
    }

    setStudents(allStudents);
    setClasses(allClasses);
    setSacraments(db.getSystemConfig().sacraments || []);
  };

  useEffect(() => {
    refreshData();
    const unsubscribe = db.onChange(refreshData);
    return unsubscribe;
  }, []);

  const openModal = (student?: Student) => {
    if (!hasFullAccess) return;

    if (student) {
      setEditingId(student.id);
      setFormData({ 
        name: student.name, 
        phone: student.phone || '',
        classId: student.classId || '', 
        sacrament: student.sacrament || '',
        pin: student.pin,
        birthDate: student.birthDate || '',
        fatherName: student.fatherName || '',
        fatherPhone: student.fatherPhone || '',
        fatherEmail: student.fatherEmail || '',
        motherName: student.motherName || '',
        motherPhone: student.motherPhone || '',
        motherEmail: student.motherEmail || '',
        guardianName: student.guardianName || '',
        guardianPhone: student.guardianPhone || '',
        guardianEmail: student.guardianEmail || '',
        guardianRelationship: student.guardianRelationship || '',
        isBaptized: !!student.isBaptized,
        baptismPlace: student.baptismPlace || '',
        hasFirstEucaristia: !!student.hasFirstEucaristia,
        firstEucaristiaPlace: student.firstEucaristiaPlace || ''
      });
    } else {
      setEditingId(null);
      const students = db.getStudents();
      let maxPin = 0;
      for (const student of students) {
          if (student.pin && student.pin.length <= 3) {
              const pinNum = parseInt(student.pin, 10);
              if (!isNaN(pinNum) && pinNum > maxPin && pinNum < 999) {
                  maxPin = pinNum;
              }
          }
      }
      let pin = (maxPin + 1).toString().padStart(3, '0');
      
      setFormData({ 
        name: '', 
        phone: '',
        classId: '', 
        sacrament: '',
        pin,
        birthDate: '',
        fatherName: '',
        fatherPhone: '',
        fatherEmail: '',
        motherName: '',
        motherPhone: '',
        motherEmail: '',
        guardianName: '',
        guardianPhone: '',
        guardianEmail: '',
        guardianRelationship: '',
        isBaptized: false,
        baptismPlace: '',
        hasFirstEucaristia: false,
        firstEucaristiaPlace: ''
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasFullAccess) return; 

    if (!formData.name || !formData.birthDate || (!formData.classId && !formData.sacrament)) {
        alert("Campos obrigatórios: Nome, Data de Nascimento e Turma (ou Sacramento).");
        return;
    }

    const selectedClass = classes.find(c => c.id === formData.classId);
    const resolvedSacrament = selectedClass ? selectedClass.sacrament : (formData.sacrament as SacramentType);

    if (!resolvedSacrament) {
        alert("É necessário definir o sacramento.");
        return;
    }

    setIsSaving(true);
    const commonData = {
      name: formData.name,
      phone: formData.phone,
      classId: formData.classId,
      birthDate: formData.birthDate,
      fatherName: formData.fatherName,
      fatherPhone: formData.fatherPhone,
      fatherEmail: formData.fatherEmail,
      motherName: formData.motherName,
      motherPhone: formData.motherPhone,
      motherEmail: formData.motherEmail,
      guardianName: formData.guardianName,
      guardianPhone: formData.guardianPhone,
      guardianEmail: formData.guardianEmail,
      guardianRelationship: formData.guardianRelationship,
      isBaptized: formData.isBaptized,
      baptismPlace: formData.isBaptized ? formData.baptismPlace : '',
      hasFirstEucaristia: formData.hasFirstEucaristia,
      firstEucaristiaPlace: formData.hasFirstEucaristia ? formData.firstEucaristiaPlace : '',
      sacrament: resolvedSacrament,
    };

    try {
        if (editingId) {
            const existingStudent = students.find(s => s.id === editingId);
            if (existingStudent) await db.updateStudent({ ...existingStudent, ...commonData });
        } else {
            await db.addStudent({
              id: Math.random().toString(36).substr(2, 9),
              pin: formData.pin,
              archived: false,
              ...commonData
            } as Student);
        }
        setShowModal(false);
    } catch (err: any) {
        alert("Erro ao salvar: " + err.message);
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!hasFullAccess) return;
    requestConfirm('Excluir este cadastro?', async () => {
      await db.deleteStudent(id, currentUser ? { email: currentUser.email, name: currentUser.name, role: currentUser.role } : undefined);
    }, true, "Excluir");
  };

  const filteredStudents = students
    .filter(s => (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.pin.includes(searchTerm)) && !s.archived)
    .sort((a, b) => {
       const idxA = sacraments.indexOf(a.sacrament);
       const idxB = sacraments.indexOf(b.sacrament);
       if (idxA !== idxB) return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
       return a.name.localeCompare(b.name);
    });

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Catequizandos</h2>
          <p className="text-slate-600 font-medium">Gestão de acesso e dados cadastrais</p>
        </div>
        {hasFullAccess && (
            <button onClick={() => openModal()} className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg flex items-center font-bold shadow-md">
                <Plus size={20} className="mr-2" /> Novo Catequizando
            </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input type="text" placeholder="Buscar por nome ou PIN..." className="w-full bg-white pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg outline-none font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto"> 
          <table className="w-full text-left">
            <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Nome / Turma</th>
                <th className="px-6 py-4">PIN</th>
                <th className="px-6 py-4">Nascimento</th>
                <th className="px-6 py-4">Contato</th>
                {hasFullAccess && <th className="px-6 py-4 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map(student => {
                  const studentClass = classes.find(c => c.id === student.classId);
                  return (
                    <tr key={student.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">{formatName(student.name)}</p>
                        <p className="text-xs text-slate-500 font-medium">{studentClass?.name || 'Sem Turma'}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-black border uppercase mt-1 inline-block ${getSacramentColor(student.sacrament, db.getSystemConfig().sacramentColors, sacraments.indexOf(student.sacrament)).badge}`}>
                            {student.sacrament}
                        </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-800">{student.pin}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-500">{student.birthDate ? new Date(student.birthDate + 'T12:00:00').toLocaleDateString('pt-BR') : '---'}</td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                        {student.phone && <div className="flex items-center"><Phone size={12} className="mr-1"/> {formatPhone(student.phone)}</div>}
                        {student.fatherPhone && <div className="text-slate-400">Pai: {formatPhone(student.fatherPhone)}</div>}
                        {student.motherPhone && <div className="text-slate-400">Mãe: {formatPhone(student.motherPhone)}</div>}
                        {student.guardianPhone && <div className="text-slate-400">Resp: {formatPhone(student.guardianPhone)}</div>}
                    </td>
                    {hasFullAccess && (
                        <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                                <button onClick={() => openModal(student)} className="p-2 text-slate-400 hover:text-blue-700"><Edit2 size={18} /></button>
                                <button onClick={() => handleDelete(student.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={18} /></button>
                            </div>
                        </td>
                    )}
                    </tr>
                  );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && hasFullAccess && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4 flex-shrink-0">
                <h3 className="text-xl font-black text-slate-900">{editingId ? 'Editar Cadastro' : 'Novo Cadastro'}</h3>
                <button onClick={() => setShowModal(false)} className="bg-slate-100 p-1 rounded-full text-slate-500 hover:text-slate-800"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-6 overflow-y-auto px-1 flex-1">
              {/* Dados do Catequizando */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-sm font-black text-slate-700 uppercase mb-3 flex items-center"><User size={16} className="mr-2"/> Dados do Catequizando</h4>
                  <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-800 mb-1">Nome Completo</label>
                        <input required className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: formatName(e.target.value)})}/>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1">Data de Nascimento</label>
                            <input required type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 font-bold focus:ring-2 focus:ring-blue-600 outline-none" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1">Celular (WhatsApp)</label>
                            <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="(00) 00000-0000" value={formData.phone} onChange={e => setFormData({...formData, phone: formatPhone(e.target.value)})}/>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1">Sacramento <span className="text-red-500">*</span></label>
                            <select required className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 outline-none" value={formData.sacrament} onChange={e => setFormData({...formData, sacrament: e.target.value, classId: ''})}>
                                <option value="">Selecione...</option>
                                {sacraments.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1">Turma (Opcional)</label>
                            <select 
                                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 outline-none disabled:opacity-50 disabled:cursor-not-allowed" 
                                disabled={!formData.sacrament}
                                value={formData.classId} 
                                onChange={e => setFormData({...formData, classId: e.target.value})}
                            >
                                <option value="">Sem Turma</option>
                                {classes
                                  .filter(c => c.sacrament === formData.sacrament && !c.archived)
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-800 mb-1">PIN de Acesso</label>
                        <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-slate-100 font-mono text-center tracking-widest font-bold" value={formData.pin} readOnly />
                    </div>
                  </div>
              </div>

              {/* Dados Sacramentais */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-sm font-black text-slate-700 uppercase mb-3 flex items-center"><BookOpen size={16} className="mr-2"/> Dados Sacramentais</h4>
                  <div className="space-y-4">
                      <div className="flex items-start sm:items-center flex-col sm:flex-row gap-4">
                          <label className="font-bold text-sm text-slate-800 w-32">É batizado?</label>
                          <div className="flex gap-4">
                              <label className="flex items-center cursor-pointer text-sm font-medium"><input type="radio" name="baptized_modal" className="mr-2" checked={formData.isBaptized} onChange={() => setFormData({...formData, isBaptized: true})} /> Sim</label>
                              <label className="flex items-center cursor-pointer text-sm font-medium"><input type="radio" name="baptized_modal" className="mr-2" checked={!formData.isBaptized} onChange={() => setFormData({...formData, isBaptized: false})} /> Não</label>
                          </div>
                          {formData.isBaptized && (
                              <input placeholder="Paróquia do Batismo" className="flex-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600" value={formData.baptismPlace} onChange={e => setFormData({...formData, baptismPlace: e.target.value})} />
                          )}
                      </div>

                      <div className="flex items-start sm:items-center flex-col sm:flex-row gap-4">
                          <label className="font-bold text-sm text-slate-800 w-32">Fez 1ª Eucaristia?</label>
                          <div className="flex gap-4">
                              <label className="flex items-center cursor-pointer text-sm font-medium"><input type="radio" name="eucharist_modal" className="mr-2" checked={formData.hasFirstEucaristia} onChange={() => setFormData({...formData, hasFirstEucaristia: true})} /> Sim</label>
                              <label className="flex items-center cursor-pointer text-sm font-medium"><input type="radio" name="eucharist_modal" className="mr-2" checked={!formData.hasFirstEucaristia} onChange={() => setFormData({...formData, hasFirstEucaristia: false})} /> Não</label>
                          </div>
                          {formData.hasFirstEucaristia && (
                              <input placeholder="Paróquia da 1ª Comunhão" className="flex-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600" value={formData.firstEucaristiaPlace} onChange={e => setFormData({...formData, firstEucaristiaPlace: e.target.value})} />
                          )}
                      </div>
                  </div>
              </div>

              {/* Filiação */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-sm font-black text-slate-700 uppercase mb-3 flex items-center"><Users size={16} className="mr-2"/> Filiação</h4>
                  <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                              <label className="block text-sm font-bold text-slate-800 mb-1">Nome do Pai</label>
                              <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 outline-none" value={formData.fatherName} onChange={e => setFormData({...formData, fatherName: formatName(e.target.value)})}/>
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-800 mb-1">Celular do Pai</label>
                              <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="(00) 00000-0000" value={formData.fatherPhone} onChange={e => setFormData({...formData, fatherPhone: formatPhone(e.target.value)})}/>
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-800 mb-1">E-mail do Pai</label>
                              <input type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="email@exemplo.com" value={formData.fatherEmail} onChange={e => setFormData({...formData, fatherEmail: e.target.value})}/>
                          </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                              <label className="block text-sm font-bold text-slate-800 mb-1">Nome da Mãe</label>
                              <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 outline-none" value={formData.motherName} onChange={e => setFormData({...formData, motherName: formatName(e.target.value)})}/>
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-800 mb-1">Celular da Mãe</label>
                              <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="(00) 00000-0000" value={formData.motherPhone} onChange={e => setFormData({...formData, motherPhone: formatPhone(e.target.value)})}/>
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-800 mb-1">E-mail da Mãe</label>
                              <input type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="email@exemplo.com" value={formData.motherEmail} onChange={e => setFormData({...formData, motherEmail: e.target.value})}/>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Responsável */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-sm font-black text-slate-700 uppercase mb-3 flex items-center"><Contact size={16} className="mr-2"/> Outro Responsável (Opcional)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                          <label className="block text-sm font-bold text-slate-800 mb-1">Nome</label>
                          <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 outline-none" value={formData.guardianName} onChange={e => setFormData({...formData, guardianName: formatName(e.target.value)})}/>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-800 mb-1">Parentesco</label>
                          <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="Ex: Avó" value={formData.guardianRelationship} onChange={e => setFormData({...formData, guardianRelationship: e.target.value})}/>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-800 mb-1">Celular</label>
                          <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="(00) 00000-0000" value={formData.guardianPhone} onChange={e => setFormData({...formData, guardianPhone: formatPhone(e.target.value)})}/>
                      </div>
                      <div className="sm:col-span-2">
                          <label className="block text-sm font-bold text-slate-800 mb-1">E-mail do Responsável</label>
                          <input type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="email@exemplo.com" value={formData.guardianEmail} onChange={e => setFormData({...formData, guardianEmail: e.target.value})}/>
                      </div>
                  </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-200 mt-2 flex-shrink-0">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 bg-blue-700 text-white rounded-xl font-bold hover:bg-blue-800 shadow-lg">{isSaving ? "Salvando..." : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} />
    </div>
  );
};

export default StudentManagement;
