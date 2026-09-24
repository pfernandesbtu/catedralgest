import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { ConfirmModal, ConfirmDialogState } from './ConfirmModal';
import { ScheduledEvent, AttendanceType, Catechist, UserRole, Student, ClassGroup, AttendanceLog } from '../types';
import { Plus, Trash2, CalendarClock, Clock, X, Users, FileSpreadsheet, FileText, Edit2, Timer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Attendee {
    student: Student;
    className: string;
    checkInTime: string;
    logId: string;
    presentParents?: string[];
}

const EventManager: React.FC = () => {
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
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
  const [showModal, setShowModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  
  // View Attendees Modal State
  const [viewingEvent, setViewingEvent] = useState<ScheduledEvent | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  
  // Auth State
  const currentUserStr = localStorage.getItem('currentUser');
  const currentUser: Catechist | null = currentUserStr ? JSON.parse(currentUserStr) : null;
  const isCoordinator = currentUser?.role === UserRole.COORDINATOR;
  const isPadre = currentUser?.role === UserRole.PADRE;
  
  // Padre tem acesso total a eventos, igual coordenação
  const canManageEvents = isCoordinator || isPadre;

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<AttendanceType>(AttendanceType.RETIRO);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);

  const toLocalInputString = (date: Date) => {
    const pad = (n: number) => n < 10 ? '0' + n : n;
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes || minutes <= 0) return '-';
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h < 24) {
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    const days = Math.floor(h / 24);
    const remainingH = h % 24;
    return remainingH > 0 ? `${days}d ${remainingH}h` : `${days} dia${days > 1 ? 's' : ''}`;
  };

  const refreshEvents = () => {
    const allEvents = db.getScheduledEvents();
    const now = new Date().getTime();
    allEvents.sort((a, b) => {
        const aEnd = new Date(a.endDate).getTime();
        const bEnd = new Date(b.endDate).getTime();
        const aStart = new Date(a.startDate).getTime();
        const bStart = new Date(b.startDate).getTime();
        
        const aActive = aEnd >= now;
        const bActive = bEnd >= now;
        
        if (aActive && bActive) {
            return aStart - bStart;
        } else if (!aActive && !bActive) {
            return bStart - aStart;
        } else {
            return aActive ? -1 : 1;
        }
    });
    setEvents(allEvents);
  };

  useEffect(() => {
    refreshEvents();
    const unsubscribe = db.onChange(refreshEvents);
    return unsubscribe;
  }, []);

  const openModal = (eventToEdit?: ScheduledEvent) => {
    if (eventToEdit) {
      setEditingEventId(eventToEdit.id);
      setName(eventToEdit.name);
      setType(eventToEdit.type);
      setStartDate(toLocalInputString(new Date(eventToEdit.startDate)));
      setEndDate(toLocalInputString(new Date(eventToEdit.endDate)));
      const diffMin = Math.round((new Date(eventToEdit.endDate).getTime() - new Date(eventToEdit.startDate).getTime()) / 60000);
      setDurationMinutes(eventToEdit.durationMinutes || (diffMin > 0 ? diffMin : 60));
    } else {
      setEditingEventId(null);
      const now = new Date();
      now.setSeconds(0, 0);
      const remainder = 30 - (now.getMinutes() % 30);
      if (remainder < 30) now.setMinutes(now.getMinutes() + remainder);

      const startStr = toLocalInputString(now);
      setStartDate(startStr);
      setDurationMinutes(60);
      const later = new Date(now.getTime() + 60 * 60 * 1000); 
      setEndDate(toLocalInputString(later));
      setName('');
      setType(AttendanceType.RETIRO);
    }
    setShowModal(true);
  };

  const handleStartDateChange = (newStartStr: string) => {
    setStartDate(newStartStr);
    if (newStartStr && durationMinutes > 0) {
      const startD = new Date(newStartStr);
      if (!isNaN(startD.getTime())) {
        const endD = new Date(startD.getTime() + durationMinutes * 60 * 1000);
        setEndDate(toLocalInputString(endD));
      }
    }
  };

  const handleDurationChange = (newDuration: number) => {
    const validDuration = Math.max(1, newDuration);
    setDurationMinutes(validDuration);
    if (startDate) {
      const startD = new Date(startDate);
      if (!isNaN(startD.getTime())) {
        const endD = new Date(startD.getTime() + validDuration * 60 * 1000);
        setEndDate(toLocalInputString(endD));
      }
    }
  };

  const handleEndDateChange = (newEndStr: string) => {
    setEndDate(newEndStr);
    if (startDate && newEndStr) {
      const startD = new Date(startDate);
      const endD = new Date(newEndStr);
      if (!isNaN(startD.getTime()) && !isNaN(endD.getTime()) && endD > startD) {
        const diffMins = Math.round((endD.getTime() - startD.getTime()) / 60000);
        setDurationMinutes(diffMins);
      }
    }
  };

  const openAttendeesModal = (event: ScheduledEvent) => {
      const allStudents = db.getStudents();
      const allClasses = db.getClasses();
      const allLogs = db.getAttendance();
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      const eventLogs = allLogs.filter(log => {
          if (log.type !== event.type) return false;
          const logDate = new Date(log.timestamp);
          return logDate >= start && logDate <= end;
      });
      const uniqueStudentIds = new Set();
      const attendeesList: Attendee[] = [];
      eventLogs.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      eventLogs.forEach(log => {
          if (!uniqueStudentIds.has(log.studentId)) {
              uniqueStudentIds.add(log.studentId);
              const student = allStudents.find(s => s.id === log.studentId);
              if (student) {
                  const cls = allClasses.find(c => c.id === student.classId);
                  attendeesList.push({
                      student,
                      className: cls ? cls.name : 'Sem Turma',
                      checkInTime: log.timestamp,
                      logId: log.id,
                      presentParents: log.presentParents
                  });
              }
          }
      });
      setAttendees(attendeesList);
      setViewingEvent(event);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !endDate) return;
    if (new Date(startDate) >= new Date(endDate)) {
      alert('A data de fim deve ser posterior à data de início.');
      return;
    }
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    const calculatedDuration = durationMinutes > 0 ? durationMinutes : Math.round((endMs - startMs) / 60000);

    const eventPayload: ScheduledEvent = {
      id: editingEventId || Math.random().toString(36).substr(2, 9),
      name,
      type,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      durationMinutes: calculatedDuration
    };

    if (editingEventId) {
      db.updateScheduledEvent(eventPayload);
    } else {
      db.addScheduledEvent(eventPayload);
    }
    setShowModal(false);
    refreshEvents();
  };

  const handleDelete = (id: string) => {
    requestConfirm('Tem certeza que deseja excluir este evento?', () => {
      db.deleteScheduledEvent(id);
      refreshEvents();
    }, true, "Excluir");
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleExportCSV = () => {
    if (!viewingEvent) return;
    const isPaisEvent = viewingEvent.type === AttendanceType.PAIS_PADRINHOS;
    const headers = ['Nome', 'Turma', 'PIN', 'Data/Hora Check-in', 'Evento'];
    if (isPaisEvent) headers.push('Presentes (Pais/Padrinhos)');
    
    const rows = attendees.map(a => {
        const row = [a.student.name, a.className, a.student.pin, new Date(a.checkInTime).toLocaleString('pt-BR'), viewingEvent.name];
        if (isPaisEvent) row.push(a.presentParents ? a.presentParents.join(', ') : '-');
        return row;
    });
    
    let csvContent = "\uFEFF" + headers.join(";") + "\n";
    rows.forEach(row => { csvContent += row.map(i => `"${i}"`).join(";") + "\n"; });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `lista_presenca_${viewingEvent.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (!viewingEvent) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Lista de Presença: ${viewingEvent.name}`, 14, 20);
    
    const isPaisEvent = viewingEvent.type === AttendanceType.PAIS_PADRINHOS;
    const tableColumn = ["Nome", "Turma", "PIN", "Hora Check-in"];
    if (isPaisEvent) tableColumn.push("Presentes");
    
    const tableRows = attendees.map(a => {
        const row = [a.student.name, a.className, a.student.pin, new Date(a.checkInTime).toLocaleString('pt-BR')];
        if (isPaisEvent) row.push(a.presentParents ? a.presentParents.join(', ') : '-');
        return row;
    });
    
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 42, headStyles: { fillColor: [29, 78, 216] } });
    doc.save(`lista_presenca_${viewingEvent.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Agenda de Eventos</h2>
          <p className="text-slate-600 font-medium">Agende Retiros e Missões para aparecerem no Totem</p>
        </div>
        {canManageEvents && (
            <button onClick={openModal} className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg flex items-center font-bold shadow-md transition-colors"><Plus size={20} className="mr-2" /> Novo Evento</button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Evento</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Início</th>
                <th className="px-6 py-4">Duração</th>
                <th className="px-6 py-4">Fim</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((event) => {
                const now = new Date();
                const isActive = now >= new Date(event.startDate) && now <= new Date(event.endDate);
                const isPast = now > new Date(event.endDate);
                const eventDiffMins = Math.round((new Date(event.endDate).getTime() - new Date(event.startDate).getTime()) / 60000);
                const eventDuration = event.durationMinutes || (eventDiffMins > 0 ? eventDiffMins : 60);
                return (
                  <tr key={event.id} className="hover:bg-blue-50/30">
                    <td className="px-6 py-4 font-bold text-slate-900">{event.name}</td>
                    <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${event.type === AttendanceType.RETIRO ? 'bg-green-100 text-green-800 border-green-200' : 'bg-orange-100 text-orange-800 border-orange-200'}`}>{event.type}</span></td>
                    <td className="px-6 py-4 text-slate-700 font-medium text-sm">{formatDateTime(event.startDate)}</td>
                    <td className="px-6 py-4 text-slate-700 font-semibold text-sm">
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded text-slate-800 border border-slate-200 text-xs font-bold">
                        <Timer size={13} className="text-blue-600" />
                        {formatDuration(eventDuration)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-medium text-sm">{formatDateTime(event.endDate)}</td>
                    <td className="px-6 py-4">{isActive ? <span className="text-green-700 flex items-center text-sm font-bold"><Clock size={14} className="mr-1"/> Ativo Agora</span> : isPast ? <span className="text-slate-500 text-sm font-medium">Encerrado</span> : <span className="text-blue-700 flex items-center text-sm font-bold"><CalendarClock size={14} className="mr-1"/> Agendado</span>}</td>
                    <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                             <button onClick={() => openAttendeesModal(event)} className="text-slate-500 hover:text-blue-600 transition-colors p-2 bg-slate-100 hover:bg-blue-50 rounded-lg" title="Ver Lista de Presença"><Users size={18} /></button>
                            {canManageEvents && (
                              <>
                                <button onClick={() => openModal(event)} className="text-slate-400 hover:text-blue-600 transition-colors p-2 hover:bg-blue-50 rounded-lg" title="Editar Evento"><Edit2 size={18} /></button>
                                <button onClick={() => handleDelete(event.id)} className="text-slate-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg" title="Excluir Evento"><Trash2 size={18} /></button>
                              </>
                            )}
                        </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && canManageEvents && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200 relative">
            <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4">
              <h3 className="text-xl font-black text-slate-900">
                {editingEventId ? 'Editar Evento' : 'Agendar Evento'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-800 transition-colors bg-slate-100 p-1 rounded-full"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Nome do Evento</label>
                <input required type="text" className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 outline-none text-slate-900 font-medium focus:ring-2 focus:ring-blue-600" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Tipo</label>
                <select className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 outline-none text-slate-900 font-medium focus:ring-2 focus:ring-blue-600" value={type} onChange={(e) => setType(e.target.value as AttendanceType)}>
                  <option value={AttendanceType.RETIRO}>Retiro</option>
                  <option value={AttendanceType.MISSAO}>Missão</option>
                  <option value={AttendanceType.MISSA}>Missa Especial</option>
                  <option value={AttendanceType.PAIS_PADRINHOS}>Reunião de Pais/Padrinhos</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-bold text-slate-800 flex items-center gap-1">
                    <Timer size={16} className="text-blue-700" /> Duração do Evento
                  </label>
                  <span className="text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full">
                    {formatDuration(durationMinutes)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={durationMinutes}
                    onChange={e => handleDurationChange(Number(e.target.value))}
                    className="w-32 bg-white border border-slate-400 rounded-lg px-3 py-2 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <span className="text-sm font-bold text-slate-600">minutos</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '30m', mins: 30 },
                    { label: '1h', mins: 60 },
                    { label: '1h30', mins: 90 },
                    { label: '2h', mins: 120 },
                    { label: '3h', mins: 180 },
                    { label: '4h', mins: 240 },
                    { label: '8h', mins: 480 },
                    { label: '1 dia', mins: 1440 },
                  ].map(p => (
                    <button
                      key={p.mins}
                      type="button"
                      onClick={() => handleDurationChange(p.mins)}
                      className={`text-xs px-2.5 py-1 rounded-md font-bold transition-colors border ${
                        durationMinutes === p.mins
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Início</label>
                  <input required type="datetime-local" className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 outline-none text-slate-900 font-medium focus:ring-2 focus:ring-blue-600" value={startDate} onChange={e => handleStartDateChange(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Término (Calculado)</label>
                  <input required type="datetime-local" className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 outline-none text-slate-900 font-medium focus:ring-2 focus:ring-blue-600" value={endDate} onChange={e => handleEndDateChange(e.target.value)} />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 font-medium flex items-start gap-2">
                <Clock size={15} className="text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Tolerância de Check-in:</strong> O Totem liberará o registro de presença <strong>30 minutos antes do início</strong> e encerrará <strong>30 minutos após o término</strong> do evento.
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-200 mt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 border border-slate-300 bg-white rounded-lg hover:bg-slate-50 text-slate-700 font-bold">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-bold shadow-lg shadow-blue-700/20">
                  {editingEventId ? 'Salvar Alterações' : 'Agendar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingEvent && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-3xl w-full p-6 animate-in fade-in zoom-in duration-200 relative max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-start mb-6 border-b border-slate-200 pb-4"><div><h3 className="text-xl font-black text-slate-900 flex items-center"><Users className="mr-2" />Lista de Presença</h3><p className="text-slate-600 font-bold mt-1 text-lg">{viewingEvent.name}</p></div><button onClick={() => setViewingEvent(null)} className="text-slate-400 hover:text-slate-800 transition-colors bg-slate-100 p-1 rounded-full"><X size={24} /></button></div>
              <div className="flex gap-2 mb-4"><button onClick={handleExportCSV} className="flex items-center px-3 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 font-bold transition-colors shadow-sm text-sm"><FileSpreadsheet size={16} className="mr-2" /> Exportar CSV</button><button onClick={handleExportPDF} className="flex items-center px-3 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 font-bold transition-colors shadow-sm text-sm"><FileText size={16} className="mr-2" /> Exportar PDF</button><div className="ml-auto flex items-center bg-blue-50 px-3 py-2 rounded-lg border border-blue-100"><span className="text-blue-800 font-bold text-sm">Total: {attendees.length} presentes</span></div></div>
              <div className="overflow-auto flex-1 border border-slate-200 rounded-lg">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Nome</th>
                      <th className="px-4 py-3">Turma</th>
                      <th className="px-4 py-3">Check-in</th>
                      {viewingEvent.type === AttendanceType.PAIS_PADRINHOS && (
                        <th className="px-4 py-3">Presentes</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendees.map((attendee) => (
                      <tr key={attendee.logId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-900">{attendee.student.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{attendee.className}</td>
                        <td className="px-4 py-3 text-sm text-slate-500 font-mono">{new Date(attendee.checkInTime).toLocaleString('pt-BR')}</td>
                        {viewingEvent.type === AttendanceType.PAIS_PADRINHOS && (
                            <td className="px-4 py-3 text-sm text-slate-600">
                                {attendee.presentParents && attendee.presentParents.length > 0 ? (
                                    <div className="flex flex-col gap-1">
                                        {attendee.presentParents.map(parent => (
                                            <span key={parent} className="text-xs uppercase font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block w-max">
                                                {parent}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-slate-400 italic">Não informado</span>
                                )}
                            </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </div>
        </div>
      )}
      <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} />
    </div>
  );
};

export default EventManager;