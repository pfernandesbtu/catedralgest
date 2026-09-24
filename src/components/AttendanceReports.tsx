import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { ConfirmModal, ConfirmDialogState } from './ConfirmModal';
import { AttendanceLog, AttendanceType, Student, ClassGroup, Catechist, UserRole } from '../types';
import { Calendar, Filter, FileSpreadsheet, FileText, Info, Trash2, Camera, X, Pencil } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatName } from '../utils/formatters';
import { EditAttendanceModal, EditAttendanceTarget } from './EditAttendanceModal';

const AttendanceReports: React.FC = () => {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [editingLog, setEditingLog] = useState<EditAttendanceTarget | null>(null);
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
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [viewPhotoUrl, setViewPhotoUrl] = useState<string | null>(null);
  
  // Auth & Permissions
  const currentUserStr = localStorage.getItem('currentUser');
  const currentUser: Catechist | null = currentUserStr ? JSON.parse(currentUserStr) : null;
  
  const isCoordinator = currentUser?.role === UserRole.COORDINATOR;
  const isPadre = currentUser?.role === UserRole.PADRE;
  const hasFullAccess = isCoordinator;

  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');

  const refreshData = () => {
    let allLogs = db.getAttendance();
    let allClasses = db.getClasses();
    let allStudents = db.getStudents();

    // Se for Catequista comum, filtra apenas o que ele gerencia
    if (!hasFullAccess && !isPadre && currentUser) {
        allClasses = allClasses.filter(c => c.catechistIds.includes(currentUser.id));
        const myClassIds = allClasses.map(c => c.id);
        allStudents = allStudents.filter(s => myClassIds.includes(s.classId));
        const myStudentIds = allStudents.map(s => s.id);
        allLogs = allLogs.filter(l => myStudentIds.includes(l.studentId));
    }

    // Ordena por data mais recente
    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    setLogs(allLogs);
    setStudents(allStudents);
    setClasses(allClasses);
  };

  useEffect(() => {
    refreshData();
    const unsubscribe = db.onChange(refreshData);
    return unsubscribe;
  }, []);

  const getStudentName = (id: string) => {
    return formatName(students.find(s => s.id === id)?.name) || 'Desconhecido';
  };

  const getStudentClass = (id: string) => {
    const student = students.find(s => s.id === id);
    if (!student) return '---';
    const cls = classes.find(c => c.id === student.classId);
    return cls ? cls.name : 'Sem Turma';
  };

  const filteredLogs = logs.filter(log => {
    if (filterType !== 'all' && log.type !== filterType) return false;
    if (filterClass !== 'all') {
      const student = students.find(s => s.id === log.studentId);
      if (student?.classId !== filterClass) return false;
    }
    return true;
  });

  const handleDelete = async (id: string) => {
      if (!hasFullAccess) return;
      requestConfirm("Tem certeza que deseja excluir este registro?", async () => {
          try {
              await db.deleteAttendanceLog(id);
          } catch (e: any) {
              alert("Erro ao excluir: " + e.message);
          }
      }, true, "Excluir");
  };

  const getTypeColor = (type: AttendanceType) => {
    switch(type) {
      case AttendanceType.MISSA: return 'text-purple-600 bg-purple-50';
      case AttendanceType.MISSAO: return 'text-orange-600 bg-orange-50';
      case AttendanceType.RETIRO: return 'text-green-600 bg-green-50';
      case AttendanceType.PAIS_PADRINHOS: return 'text-indigo-600 bg-indigo-50 border-indigo-200';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  const handleExportCSV = () => {
      const headers = ['Data', 'Hora', 'Nome do Catequizando', 'Turma', 'Tipo de Evento', 'Detalhes'];
    
      const rows = filteredLogs.map(log => {
        const dateObj = new Date(log.timestamp);
        const row = [
          dateObj.toLocaleDateString('pt-BR'),
          dateObj.toLocaleTimeString('pt-BR'),
          getStudentName(log.studentId),
          getStudentClass(log.studentId),
          log.type
        ];
        let details = '';
        if (log.eventName) details += log.eventName + ' ';
        if (log.justification) details += `(Justif.) ${log.justification} `;
        if (log.presentParents && log.presentParents.length > 0) details += `(Pais/Padrinhos) ${log.presentParents.join(', ')}`;
        row.push(details.trim() || '-');
        return row;
      });

    let csvContent = "\uFEFF";
    csvContent += headers.join(";") + "\n";
    rows.forEach(rowArray => {
      const row = rowArray.map(item => `"${item}"`).join(";");
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `frequencia_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Relatório de Frequência - CatedralGest", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);
    
    const tableColumn = ["Data", "Hora", "Catequizando", "Turma", "Tipo", "Detalhes"];
    
    const tableRows = filteredLogs.map(log => {
       const dateObj = new Date(log.timestamp);
       const row = [
        dateObj.toLocaleDateString('pt-BR'),
        dateObj.toLocaleTimeString('pt-BR'),
        getStudentName(log.studentId),
        getStudentClass(log.studentId),
        log.type
       ];
       let details = '';
       if (log.eventName) details += log.eventName + ' ';
       if (log.justification) details += `(J) ${log.justification} `;
       if (log.presentParents && log.presentParents.length > 0) details += `(Pais/Padrinhos) ${log.presentParents.join(', ')}`;
       row.push(details.trim() || '-');
       return row;
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [29, 78, 216] }
    });

    doc.save(`relatorio_frequencia_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Frequência</h2>
          <p className="text-slate-600 font-medium">Histórico detalhado de presenças</p>
        </div>
        <div className="flex gap-2">
            <button onClick={handleExportCSV} className="flex items-center px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 font-bold transition-colors shadow-sm">
                <FileSpreadsheet size={18} className="mr-2" /> CSV
            </button>
            <button onClick={handleExportPDF} className="flex items-center px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 font-bold transition-colors shadow-sm">
                <FileText size={18} className="mr-2" /> PDF
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-slate-300">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-center rounded-t-xl">
          <div className="flex items-center text-slate-700 mr-2 font-bold">
            <Filter size={18} className="mr-2" />
            <span>Filtros:</span>
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border border-slate-400 rounded-lg px-3 py-2 bg-white text-slate-900 font-medium">
            <option value="all">Todos os Eventos</option>
            {Object.values(AttendanceType).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="border border-slate-400 rounded-lg px-3 py-2 bg-white text-slate-900 font-medium">
            <option value="all">{(hasFullAccess || isPadre) ? "Todas as Turmas" : "Minhas Turmas"}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Data / Hora</th>
                <th className="px-6 py-4">Catequizando</th>
                <th className="px-6 py-4">Turma</th>
                <th className="px-6 py-4">Evento</th>
                <th className="px-6 py-4">Detalhes</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-slate-700 font-medium">
                    <div className="flex items-center">
                      <Calendar size={16} className="mr-2 text-slate-400" />
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">{getStudentName(log.studentId)}</td>
                  <td className="px-6 py-4 text-slate-700">{getStudentClass(log.studentId)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getTypeColor(log.type)}`}>
                        {log.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                     {log.eventName && <span className="text-xs text-slate-500 font-medium block">{log.eventName}</span>}
                     {log.justification && (
                        <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-semibold inline-flex items-center mt-1">
                            <Info size={10} className="mr-1" /> {log.justification}
                        </span>
                    )}
                    {log.presentParents && log.presentParents.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                            {log.presentParents.map(parent => (
                                <span key={parent} className="text-[10px] uppercase font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    {parent}
                                </span>
                            ))}
                        </div>
                    )}
                    {log.photoUrl && (
                        <button onClick={() => setViewPhotoUrl(log.photoUrl!)} className="mt-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 flex items-center transition-colors">
                            <Camera size={12} className="mr-1" />
                            Ver Foto
                        </button>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button 
                        onClick={() => setEditingLog({
                          logId: log.id,
                          studentId: log.studentId,
                          studentName: getStudentName(log.studentId),
                          className: getStudentClass(log.studentId),
                          timestamp: log.timestamp,
                          currentType: log.type,
                          currentEventName: log.eventName,
                          currentJustification: log.justification
                        })} 
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar Frequência / Categoria"
                      >
                        <Pencil size={17} />
                      </button>
                      {hasFullAccess && (
                        <button 
                          onClick={() => handleDelete(log.id)} 
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir Registro"
                        >
                          <Trash2 size={17} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} />

      <EditAttendanceModal
        target={editingLog}
        onClose={() => setEditingLog(null)}
        onSaved={refreshData}
      />
      
      {viewPhotoUrl && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="text-lg font-black text-slate-900 flex items-center">
                        <Camera className="mr-2 text-blue-600" size={20} /> Foto do Check-in
                    </h3>
                    <button onClick={() => setViewPhotoUrl(null)} className="text-slate-400 hover:text-slate-800 transition-colors bg-slate-200 hover:bg-slate-300 p-1.5 rounded-full">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 flex justify-center bg-slate-100">
                    <img src={viewPhotoUrl} alt="Foto do Check-in" className="max-w-full h-auto rounded-lg shadow-sm border border-slate-300" />
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                     <button onClick={() => setViewPhotoUrl(null)} className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-bold transition-colors">
                         Fechar
                     </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceReports;