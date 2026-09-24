
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { getSacramentColor } from '../utils/colors';
import { ConfirmModal, ConfirmDialogState } from './ConfirmModal';
import { ClassGroup, SacramentType, Catechist, Student, AttendanceType, AttendanceRules, RecessPeriod, AttendanceLog, UserRole } from '../types';
import { Plus, Trash2, Users, BookOpen, Edit2, X, Check, Square, ArrowLeft, AlertTriangle, CheckCircle2, Calendar, Clock, ClipboardCheck, ClipboardPen, FileSpreadsheet, FileText, ListChecks, Percent, BarChart3, User, Phone, Baby, Save, Archive, ArchiveRestore, Ban, Camera, Pencil } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatName, formatPhone } from '../utils/formatters';
import { EditAttendanceModal, EditAttendanceTarget } from './EditAttendanceModal';

const ClassManagement: React.FC = () => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [catechists, setCatechists] = useState<Catechist[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [requirements, setRequirements] = useState<Record<string, AttendanceRules> | null>(null);
  const [recessPeriods, setRecessPeriods] = useState<RecessPeriod[]>([]);
  const [sacraments, setSacraments] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editingAttendanceLog, setEditingAttendanceLog] = useState<EditAttendanceTarget | null>(null);
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
  const [showArchived, setShowArchived] = useState(false);
  
  // Auth State
  const currentUserStr = localStorage.getItem('currentUser');
  const currentUser: Catechist | null = currentUserStr ? JSON.parse(currentUserStr) : null;
  
  const isCoordinator = currentUser?.role === UserRole.COORDINATOR;
  const isPadre = currentUser?.role === UserRole.PADRE;
  const hasFullAccess = isCoordinator;
  const getTeamLines = (cls: ClassGroup): string[] => {
      if (!cls.catechistIds || cls.catechistIds.length === 0) {
          return [cls.catechistNames && cls.catechistNames.length > 0 ? `Catequistas: ${cls.catechistNames.join(", ")}` : "Sem Catequista"];
      }
      const classCats = cls.catechistIds.map(id => catechists.find(c => c.id === id)).filter((c): c is Catechist => c !== undefined);
      const cats = classCats.filter(c => c.role !== UserRole.MONITOR).map(c => c.name.split(" ")[0]);
      const mons = classCats.filter(c => c.role === UserRole.MONITOR).map(c => c.name.split(" ")[0]);
      let parts: string[] = [];
      if (cats.length > 0) parts.push(`Catequistas: ${cats.join(", ")}`);
      if (mons.length > 0) parts.push(`Monitores: ${mons.join(", ")}`);
      if (parts.length === 0) {
           return [cls.catechistNames && cls.catechistNames.length > 0 ? `Catequistas: ${cls.catechistNames.join(", ")}` : "Sem Catequista"];
      }
      return parts;
  };

  // View State
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // Student Detail Modal State
  const [viewStudent, setViewStudent] = useState<Student | null>(null);
  const [viewPhotoUrl, setViewPhotoUrl] = useState<string | null>(null);
  const [showPendingSelfiesModal, setShowPendingSelfiesModal] = useState(false);
  // Edit Student inside Class View State
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [studentFormData, setStudentFormData] = useState<Partial<Student>>({});

  // Manual Attendance Modal State (Single)
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualStudent, setManualStudent] = useState<Student | null>(null);
  const [manualDate, setManualDate] = useState('');
  const [manualType, setManualType] = useState<AttendanceType>(AttendanceType.ENCONTRO);
  const [manualJustification, setManualJustification] = useState('');

  // Batch Attendance Modal State
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchDates, setBatchDates] = useState<string[]>([]); // Array for multiple dates
  const [tempBatchDate, setTempBatchDate] = useState(''); // Temp input for adding dates
  const [batchType, setBatchType] = useState<AttendanceType>(AttendanceType.ENCONTRO);
  const [batchJustification, setBatchJustification] = useState('Lançamento em Lote');
  const [batchSelectedStudents, setBatchSelectedStudents] = useState<string[]>([]);

  // Form State (Class CRUD)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selectedCatechistIds, setSelectedCatechistIds] = useState<string[]>([]);
  const [sacrament, setSacrament] = useState<string>((db.getSystemConfig().sacraments || [])[0] || '');
  const [meetingDay, setMeetingDay] = useState<number>(6); // Default Saturday
  const [meetingTime, setMeetingTime] = useState<string>('09:00');
  
  // Dates
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  const refreshData = () => {
    let allClasses = db.getClasses();
    
    // Filter classes for Catechists (can only see their own)
    if (!hasFullAccess && !isPadre && currentUser) {
        allClasses = allClasses.filter(c => c.catechistIds.includes(currentUser.id));
    }

    setClasses(allClasses);
    setCatechists(db.getCatechists());
    setStudents(db.getStudents());
    setLogs(db.getAttendance());
    setRequirements(db.getRequirements());
    setRecessPeriods(db.getRecessPeriods());
    setSacraments(db.getSystemConfig().sacraments || []);
  };

  useEffect(() => {
    refreshData();
    const unsubscribe = db.onChange(refreshData);
    return unsubscribe;
  }, []);

  // Update selected class if underlying data changes (e.g. attendance log added)
  useEffect(() => {
    if(selectedClass) {
        const updated = classes.find(c => c.id === selectedClass.id);
        if(updated) setSelectedClass(updated);
    }
  }, [classes, logs]); 

  // --- Helper: Check if a log belongs to the class period ---
  const isLogValidForClass = (logTimestamp: string, cls: ClassGroup) => {
    const logDate = new Date(logTimestamp);
    // Ajustar datas da turma para cobrir o dia inteiro
    const start = new Date(cls.startDate + 'T00:00:00');
    const end = new Date(cls.endDate + 'T23:59:59');
    
    return logDate >= start && logDate <= end;
  };

  const openModal = (cls?: ClassGroup, e?: React.MouseEvent) => {
    e?.stopPropagation(); 
    if (!hasFullAccess) return; // Security check

    const currentYear = new Date().getFullYear();

    if (cls) {
      setEditingId(cls.id);
      setName(cls.name);
      setSelectedCatechistIds(cls.catechistIds || []);
      setSacrament(cls.sacrament);
      setMeetingDay(cls.meetingDay ?? 6);
      setMeetingTime(cls.meetingTime ?? '09:00');
      setStartDate(cls.startDate || `${currentYear}-02-01`);
      setEndDate(cls.endDate || `${currentYear}-12-20`);
    } else {
      setEditingId(null);
      resetForm();
    }
    setShowModal(true);
  };

  const handleToggleArchive = async (cls: ClassGroup, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const action = cls.archived ? 'REABRIR' : 'ENCERRAR';
      
      

      try {
          await db.toggleClassArchive(cls.id, !cls.archived, currentUser ? { email: currentUser.email, name: currentUser.name, role: currentUser.role } : undefined);
          if (selectedClass?.id === cls.id) setSelectedClass(prev => prev ? {...prev, archived: !prev.archived} : null);
          alert(`Turma ${cls.archived ? 'reaberta' : 'encerrada'} com sucesso.`);
      } catch (err: any) {
          alert("Erro: " + err.message);
      }
  };

  // --- Student Edit Logic ---
  const handleOpenStudentDetail = (student: Student) => {
    setViewStudent(student);
    setIsEditingStudent(false); // Reset edit mode
    setStudentFormData({});
  };

  const handleStartEditStudent = () => {
      if (!viewStudent) return;
      setStudentFormData({
          name: viewStudent.name,
          phone: viewStudent.phone,
          fatherName: viewStudent.fatherName,
          fatherPhone: viewStudent.fatherPhone,
          motherName: viewStudent.motherName,
          motherPhone: viewStudent.motherPhone,
          guardianName: viewStudent.guardianName,
          guardianPhone: viewStudent.guardianPhone,
          guardianRelationship: viewStudent.guardianRelationship,
      });
      setIsEditingStudent(true);
  };

  const handleSaveStudentChanges = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!viewStudent) return;
      
      setIsSaving(true);
      try {
          const updatedStudent: Student = {
              ...viewStudent,
              ...studentFormData as Student // Merge changes
          };
          
          await db.updateStudent(updatedStudent);
          setViewStudent(updatedStudent); // Update modal view
          setIsEditingStudent(false);
          refreshData(); // Refresh global data
      } catch (err: any) {
          alert("Erro ao salvar: " + err.message);
      } finally {
          setIsSaving(false);
      }
  };

  // --- Manual Single Attendance ---
  const openManualAttendanceModal = (student: Student) => {
      setManualStudent(student);
      const today = new Date().toISOString().split('T')[0];
      setManualDate(today);
      setManualType(AttendanceType.ENCONTRO);
      setManualJustification('');
      setShowManualModal(true);
  };

  const handleManualAttendanceSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!manualStudent || !manualDate || !manualJustification) {
          alert("Preencha todos os campos obrigatórios.");
          return;
      }

      setIsSaving(true);
      try {
          const result = await db.logAttendance(
              manualStudent.id, 
              manualType, 
              undefined, 
              manualJustification, 
              manualDate
          );
          
          if (result.success) {
             setShowManualModal(false);
             setManualStudent(null);
             refreshData(); // Force refresh to update UI immediately
          } else {
              alert(result.message);
          }
      } catch (err: any) {
          alert("Erro ao lançar presença: " + err.message);
      } finally {
          setIsSaving(false);
      }
  };

  // --- Batch Attendance Logic ---
  const openBatchModal = () => {
      if (!selectedClass) return;
      if (selectedClass.archived) {
          alert("Não é possível lançar presença em turmas encerradas.");
          return;
      }
      
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const today = `${year}-${month}-${day}`;

      setTempBatchDate(today);
      setBatchDates([today]); 
      setBatchType(AttendanceType.ENCONTRO);
      setBatchJustification('Lançamento em Lote');
      setBatchSelectedStudents([]);
      setShowBatchModal(true);
  };

  const addBatchDate = () => {
    if (!tempBatchDate) return;
    if (!batchDates.includes(tempBatchDate)) {
        const newDates = [...batchDates, tempBatchDate].sort();
        setBatchDates(newDates);
    }
  };

  const removeBatchDate = (dateToRemove: string) => {
      setBatchDates(batchDates.filter(d => d !== dateToRemove));
  };

  const toggleBatchStudent = (studentId: string) => {
      setBatchSelectedStudents(prev => 
          prev.includes(studentId) 
              ? prev.filter(id => id !== studentId) 
              : [...prev, studentId]
      );
  };

  const toggleAllBatchStudents = (classStudents: Student[]) => {
      if (batchSelectedStudents.length === classStudents.length) {
          setBatchSelectedStudents([]); // Deselect all
      } else {
          setBatchSelectedStudents(classStudents.map(s => s.id)); // Select all
      }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (batchDates.length === 0 || batchSelectedStudents.length === 0) {
          alert("Selecione pelo menos uma data e um catequizando.");
          return;
      }

      setIsSaving(true);
      let successCount = 0;
      let errorCount = 0;

      for (const dateStr of batchDates) {
          for (const studentId of batchSelectedStudents) {
              try {
                  const result = await db.logAttendance(
                      studentId, 
                      batchType, 
                      undefined, 
                      batchJustification, 
                      dateStr
                  );
                  if (result.success) successCount++;
                  else errorCount++; 
              } catch (err) {
                  errorCount++;
              }
          }
      }

      setIsSaving(false);
      setShowBatchModal(false);
      refreshData();
      
      const totalOps = batchDates.length * batchSelectedStudents.length;
      if (errorCount > 0) {
          alert(`Processo concluído.\nTentativas: ${totalOps}\nSucessos: ${successCount}\nDuplicados/Erros: ${errorCount}`);
      } else {
          alert(`${successCount} presenças lançadas com sucesso!`);
      }
  };


  const toggleCatechist = (id: string) => {
      setSelectedCatechistIds(prev => 
        prev.includes(id) 
            ? prev.filter(cId => cId !== id)
            : [...prev, id]
      );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasFullAccess) return;

    if (selectedCatechistIds.length === 0) {
        alert('Selecione pelo menos um catequista.');
        return;
    }

    if (startDate >= endDate) {
        alert('A data final deve ser posterior à data inicial.');
        return;
    }

    setIsSaving(true);

    const selectedNames = selectedCatechistIds.map(id => {
        const c = catechists.find(cat => cat.id === id);
        return c ? c.name : 'Desconhecido';
    });

    const commonData = {
        name,
        catechistNames: selectedNames,
        catechistIds: selectedCatechistIds,
        sacrament,
        meetingDay,
        meetingTime,
        startDate,
        endDate
    };

    try {
        if (editingId) {
            const updatedClass: ClassGroup = {
              id: editingId,
              ...commonData
            };
            await db.updateClass(updatedClass);
          } else {
            const newClass: ClassGroup = {
              id: Math.random().toString(36).substr(2, 9),
              ...commonData
            };
            await db.addClass(newClass);
          }
      
          setShowModal(false);
          resetForm();
    } catch (err: any) {
        alert(err.message);
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasFullAccess) return;

    requestConfirm('Tem certeza que deseja excluir este registro de turma? Esta ação é destrutiva. Prefira "Encerrar Turma" para arquivar.', async () => {
      try {
        await db.deleteClass(id, currentUser ? { email: currentUser.email, name: currentUser.name, role: currentUser.role } : undefined);
        if (selectedClass?.id === id) setSelectedClass(null);
      } catch (err: any) {
        alert(err.message);
      }
    }, true, "Excluir");
  };

  const resetForm = () => {
    const currentYear = new Date().getFullYear();
    setName('');
    setSelectedCatechistIds([]);
    setSacrament(sacraments[0]);
    setMeetingDay(6);
    setMeetingTime('09:00');
    setStartDate(`${currentYear}-02-01`);
    setEndDate(`${currentYear}-12-20`);
    setEditingId(null);
  };

  // --- Helper: Convert timestamp to local YYYY-MM-DD string ---
  const getLogDateStr = (timestamp: string) => {
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return timestamp.split('T')[0];
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return timestamp.split('T')[0];
    }
  };

  // --- Statistics Logic for Detail View ---
  const isRecess = (dateStr: string, sacrament: SacramentType): boolean => {
      return recessPeriods.some(p => {
          if (p.sacrament !== 'TODOS' && p.sacrament !== sacrament) return false;
          return dateStr >= p.startDate && dateStr <= p.endDate;
      });
  };

  const getClassStats = (cls: ClassGroup) => {
      if (!requirements) return null;

      const classStudents = students
        .filter(s => s.classId === cls.id)
        .sort((a, b) => a.name.localeCompare(b.name));

      const classStudentIds = new Set(classStudents.map(s => s.id));

      // Identificar datas em que alunos desta turma participaram de encontros (ex: encontro conjunto, reposição)
      const attendedEncontroDates = new Set<string>();
      logs.forEach(l => {
          if (l.type === AttendanceType.ENCONTRO && classStudentIds.has(l.studentId) && isLogValidForClass(l.timestamp, cls)) {
              attendedEncontroDates.add(getLogDateStr(l.timestamp));
          }
      });

      const reqs = requirements[cls.sacrament] || { minEncontro: 0, minMissa: 0 };

      const start = new Date(cls.startDate + 'T12:00:00'); 
      const end = new Date(cls.endDate + 'T12:00:00');
      const today = new Date();
      // Only count expected days up to today or end of class, whichever is earlier
      const calcLimit = today < end ? today : end;

      let expectedEncontros = 0;
      let expectedMissas = 0;
      let totalEncontrosAno = 0;
      let totalMissasAno = 0;

      let cursor = new Date(start);
      while (cursor <= end) {
          const dateStr = cursor.toISOString().split('T')[0];
          const dayOfWeek = cursor.getDay(); 
          const isRecessDay = isRecess(dateStr, cls.sacrament);

          const isStandardEncontroDay = (dayOfWeek === cls.meetingDay && !isRecessDay);
          const isExtraEncontroDay = attendedEncontroDates.has(dateStr) && !isStandardEncontroDay;

          if (isStandardEncontroDay || isExtraEncontroDay) {
              totalEncontrosAno++;
              if (cursor <= calcLimit && today >= start) expectedEncontros++;
          }

          if (dayOfWeek === 0) {
              totalMissasAno++;
              if (cursor <= calcLimit && today >= start) expectedMissas++;
          }

          cursor.setDate(cursor.getDate() + 1);
      }

      const validTotalEncontros = expectedEncontros;
      const validTotalMissas = expectedMissas;

      return {
          classStudents,
          totalMissas: validTotalMissas,
          totalEncontros: validTotalEncontros,
          totalMissasAno,
          totalEncontrosAno,
          reqs
      };
  };

  // --- GENERATE DETAILED HISTORY LIST ---
  const getDetailedHistory = (student: Student, cls: ClassGroup) => {
      const history: { date: string, type: string, status: 'PRESENTE' | 'FALTA' | 'RECESSO', isExpected: boolean, photoUrl?: string, log?: AttendanceLog }[] = [];
      const start = new Date(cls.startDate + 'T12:00:00');
      const end = new Date(cls.endDate + 'T12:00:00');
      const today = new Date();
      const limit = today < end ? today : end;

      const studentLogs = logs.filter(l => l.studentId === student.id);

      const classStudents = students.filter(s => s.classId === cls.id);
      const classStudentIds = new Set(classStudents.map(s => s.id));
      const attendedEncontroDates = new Set<string>();
      logs.forEach(l => {
          if (l.type === AttendanceType.ENCONTRO && classStudentIds.has(l.studentId) && isLogValidForClass(l.timestamp, cls)) {
              attendedEncontroDates.add(getLogDateStr(l.timestamp));
          }
      });

      const findMissaLog = (targetDateStr: string) => {
          return studentLogs.find(l => 
              l.type === AttendanceType.MISSA && 
              (l.timestamp.startsWith(targetDateStr) || getLogDateStr(l.timestamp) === targetDateStr)
          );
      };

      const findEncontroLog = (targetDateStr: string) => {
          return studentLogs.find(l => 
              l.type === AttendanceType.ENCONTRO && 
              (l.timestamp.startsWith(targetDateStr) || getLogDateStr(l.timestamp) === targetDateStr)
          );
      };

      const getLogStatus = (log?: AttendanceLog): 'PRESENTE' | 'PENDENTE' | 'FALTA' => {
          if (!log) return 'FALTA';
          if (log.pendingValidation) return 'PENDENTE';
          return 'PRESENTE';
      };

      let cursor = new Date(start);
      while(cursor <= limit) {
          const dateStr = cursor.toISOString().split('T')[0];
          const dayOfWeek = cursor.getDay();
          const isRecessDay = isRecess(dateStr, cls.sacrament);

          const isStandardEncontroDay = (dayOfWeek === cls.meetingDay && !isRecessDay);
          const isExtraEncontroDay = attendedEncontroDates.has(dateStr) && !isStandardEncontroDay;
          const isEncontroDay = isStandardEncontroDay || isExtraEncontroDay;

          const encontroLog = findEncontroLog(dateStr);
          if (isEncontroDay || encontroLog) {
              if (isRecessDay && !encontroLog && !isExtraEncontroDay) {
                  // Skip recess in list unless present
              } else {
                  history.push({
                      date: dateStr,
                      type: 'Encontro',
                      status: getLogStatus(encontroLog),
                      isExpected: isEncontroDay,
                      photoUrl: encontroLog?.photoUrl,
                      log: encontroLog
                  });
              }
          }

          // --- Weekend Mass Logic (Sábado + Domingo = Final de Semana) ---
          if (dayOfWeek === 6) {
              // Sábado: Se o catequizando compareceu a qualquer missa no sábado, registra a presença do preceito de fim de semana
              const satMissaLog = findMissaLog(dateStr);
              if (satMissaLog) {
                  history.push({
                      date: dateStr,
                      type: 'Missa',
                      status: getLogStatus(satMissaLog),
                      isExpected: true,
                      photoUrl: satMissaLog?.photoUrl,
                      log: satMissaLog
                  });
              }
          } else if (dayOfWeek === 0) {
              // Domingo: Verifica se compareceu no domingo ou se já cumpriu a missa no sábado anterior
              const sunMissaLog = findMissaLog(dateStr);
              
              const prevSat = new Date(cursor);
              prevSat.setDate(prevSat.getDate() - 1);
              const prevSatStr = prevSat.toISOString().split('T')[0];
              const attendedSaturday = !!findMissaLog(prevSatStr);

              if (sunMissaLog) {
                  history.push({
                      date: dateStr,
                      type: 'Missa',
                      status: getLogStatus(sunMissaLog),
                      isExpected: true,
                      photoUrl: sunMissaLog?.photoUrl,
                      log: sunMissaLog
                  });
              } else if (!attendedSaturday) {
                  // Não foi no sábado e nem no domingo -> Falta do final de semana
                  history.push({
                      date: dateStr,
                      type: 'Missa',
                      status: 'FALTA',
                      isExpected: true,
                      log: undefined
                  });
              }
              // Se attendedSaturday for true e não foi no domingo:
              // O preceito já foi cumprido no sábado (já está na lista como PRESENTE).
              // NÃO lança falta no domingo!
          } else {
              // Missa durante a semana (extraordinária)
              const weekdayMissaLog = findMissaLog(dateStr);
              if (weekdayMissaLog) {
                  history.push({
                      date: dateStr,
                      type: 'Missa',
                      status: getLogStatus(weekdayMissaLog),
                      isExpected: false,
                      photoUrl: weekdayMissaLog?.photoUrl,
                      log: weekdayMissaLog
                  });
              }
          }

          cursor.setDate(cursor.getDate() + 1);
      }

      // Add extra logs (Retiros, Missoes, or extra days not scheduled)
      studentLogs.forEach(log => {
          const logDateStr = getLogDateStr(log.timestamp);
          const alreadyListed = history.find(h => 
              (h.log?.id && h.log.id === log.id) || 
              (h.date === logDateStr && (h.type === log.type || h.type.startsWith(log.type)))
          );
          
          if (!alreadyListed) {
               history.push({
                   date: logDateStr,
                   type: log.eventName ? `${log.type} (${log.eventName})` : log.type,
                   status: getLogStatus(log),
                   isExpected: false,
                   photoUrl: log.photoUrl,
                   log: log
               });
          }
      });

      return history.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const handleExportIndividualPDF = (student: Student) => {
      if (!selectedClass) return;
      const history = getDetailedHistory(student, selectedClass);
      
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(16);
      doc.text(`Relatório Individual: ${student.name}`, 14, 20);
      doc.setFontSize(10);
      doc.text(`Turma: ${selectedClass.name}`, 14, 26);
      const indTeamLines = getTeamLines(selectedClass);
      doc.text(indTeamLines, 14, 31);
      const indShift = (indTeamLines.length - 1) * 5;
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 150, 20);

      const tableColumn = ["Data", "Evento", "Status"];
      const tableRows = history.map(h => [
          new Date(h.date + 'T12:00:00').toLocaleDateString('pt-BR'),
          h.type,
          h.status
      ]);

      autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: 40 + indShift,
          headStyles: { fillColor: getSacramentColor(selectedClass.sacrament, db.getSystemConfig().sacramentColors, sacraments.indexOf(selectedClass.sacrament)).pdfHead as [number, number, number] },
          didParseCell: function(data) {
              if (data.section === 'body' && data.column.index === 2) {
                  if (data.cell.raw === 'FALTA') {
                      data.cell.styles.textColor = [220, 38, 38];
                      data.cell.styles.fontStyle = 'bold';
                  } else {
                      data.cell.styles.textColor = [22, 163, 74];
                  }
              }
          }
      });

      doc.save(`historico_${student.name.replace(/\s+/g, '_')}.pdf`);
  };

  // --- Export Functions for Class Detail ---
  
  const handleExportClassCSV = (cls: ClassGroup) => {
    const stats = getClassStats(cls);
    if (!stats) return;

    const headers = [
      'Nome do Catequizando', 
      'PIN', 
      'Celular', 
      'Pai', 
      'Tel Pai', 
      'Mãe', 
      'Tel Mãe', 
      'Encontros (%)', 
      'Missas (%)'
    ];

    const rows = stats.classStudents.map(student => {
        const studentLogs = logs.filter(l => l.studentId === student.id);
        
        // Count based on date range, not just year (excluding pending validations)
        const countEncontro = studentLogs.filter(a => 
            a.type === AttendanceType.ENCONTRO && isLogValidForClass(a.timestamp, cls) && !a.pendingValidation
        ).length;

        const countMissa = studentLogs.filter(a => 
            a.type === AttendanceType.MISSA && isLogValidForClass(a.timestamp, cls) && !a.pendingValidation
        ).length;
        
        const effectiveTotalEncontros = Math.max(stats.totalEncontros, countEncontro);
        const effectiveTotalMissas = Math.max(stats.totalMissas, countMissa);

        const pctEncontro = effectiveTotalEncontros > 0 ? Math.round((countEncontro / effectiveTotalEncontros) * 100) : 0;
        const pctMissa = effectiveTotalMissas > 0 ? Math.round((countMissa / effectiveTotalMissas) * 100) : 0;
        
        return [
            formatName(student.name),
            student.pin,
            formatPhone(student.phone) || '-',
            formatName(student.fatherName) || '-',
            formatPhone(student.fatherPhone) || '-',
            formatName(student.motherName) || '-',
            formatPhone(student.motherPhone) || '-',
            `${pctEncontro}%`,
            `${pctMissa}%`
        ];
    });

    let csvContent = "\uFEFF" + headers.join(";") + "\n";
    rows.forEach(row => {
        csvContent += row.map(i => `"${i}"`).join(";") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `turma_${cls.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportClassPDF = (cls: ClassGroup) => {
    const stats = getClassStats(cls);
    if (!stats) return;
    
    const doc = new jsPDF({ orientation: 'landscape' });

    // Header
    doc.setFontSize(18);
    doc.text(`Relatório da Turma: ${cls.name}`, 14, 15);
    
    doc.setFontSize(10);
    const teamLines = getTeamLines(cls);
    doc.text(teamLines, 14, 22);
    const shift = (teamLines.length - 1) * 5;
    doc.text(`Sacramento: ${cls.sacrament}`, 14, 27 + shift);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 200, 15);

    const tableColumn = ["Nome", "PIN", "Celular", "Filiação (Pai/Mãe)", "Encontros", "Missas"];
    const tableRows = stats.classStudents.map(student => {
        const studentLogs = logs.filter(l => l.studentId === student.id);
        
        // Count based on date range (excluding pending validations)
        const countEncontro = studentLogs.filter(a => 
            a.type === AttendanceType.ENCONTRO && isLogValidForClass(a.timestamp, cls) && !a.pendingValidation
        ).length;

        const countMissa = studentLogs.filter(a => 
             a.type === AttendanceType.MISSA && isLogValidForClass(a.timestamp, cls) && !a.pendingValidation
        ).length;
        
        const effectiveTotalEncontros = Math.max(stats.totalEncontros, countEncontro);
        const effectiveTotalMissas = Math.max(stats.totalMissas, countMissa);

        const pctEncontro = effectiveTotalEncontros > 0 ? Math.round((countEncontro / effectiveTotalEncontros) * 100) : 0;
        const pctMissa = effectiveTotalMissas > 0 ? Math.round((countMissa / effectiveTotalMissas) * 100) : 0;
        
        const parents = `${formatName(student.fatherName)?.split(' ')[0] || '-'} / ${formatName(student.motherName)?.split(' ')[0] || '-'}`;
        const phones = `P:${formatPhone(student.fatherPhone) || '-'} \nM:${formatPhone(student.motherPhone) || '-'}`;
        
        return [
            formatName(student.name),
            student.pin,
            formatPhone(student.phone) || '-',
            parents + '\n' + phones,
            `${pctEncontro}% (${countEncontro}/${effectiveTotalEncontros})`,
            `${pctMissa}% (${countMissa}/${effectiveTotalMissas})`
        ];
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 35 + shift,
        rowPageBreak: 'avoid',
        styles: { fontSize: 8, cellPadding: 1 },
        headStyles: { fillColor: getSacramentColor(cls.sacrament, db.getSystemConfig().sacramentColors, sacraments.indexOf(cls.sacrament)).pdfHead as [number, number, number] }, 
        columnStyles: {
            3: { cellWidth: 50 } // Wider column for parents
        }
    });

    doc.save(`turma_${cls.name.replace(/\s+/g, '_')}.pdf`);
  };


  // Render Logic
  if (selectedClass) {
      const isMonitor = currentUser?.role === UserRole.MONITOR;
      const canEditClass = !isMonitor && (hasFullAccess || (currentUser && selectedClass.catechistIds.includes(currentUser.id)));
      const stats = getClassStats(selectedClass);

      // Pending selfie logs for this class
      const classStudentIds = new Set((stats?.classStudents || []).map(s => s.id));
      const pendingClassLogs = logs.filter(l => classStudentIds.has(l.studentId) && l.pendingValidation);
     
      // --- CALCULATE CLASS AVERAGES ---
      let sumEncontros = 0;
      let sumMissas = 0;

      if (stats) {
          stats.classStudents.forEach(student => {
              const studentLogs = logs.filter(l => l.studentId === student.id);
              // Use Valid Date Range for calculation
              sumEncontros += studentLogs.filter(l => l.type === AttendanceType.ENCONTRO && isLogValidForClass(l.timestamp, selectedClass)).length;
              sumMissas += studentLogs.filter(l => l.type === AttendanceType.MISSA && isLogValidForClass(l.timestamp, selectedClass)).length;
          });
      }

      const totalExpectedEncontrosForAll = (stats?.totalEncontros || 1) * (stats?.classStudents.length || 0);
      const totalExpectedMissasForAll = (stats?.totalMissas || 1) * (stats?.classStudents.length || 0);

      const avgEncontro = totalExpectedEncontrosForAll > 0 ? Math.round((sumEncontros / totalExpectedEncontrosForAll) * 100) : 0;
      const avgMissa = totalExpectedMissasForAll > 0 ? Math.round((sumMissas / totalExpectedMissasForAll) * 100) : 0;
      
      return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setSelectedClass(null)}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                    >
                        <ArrowLeft size={24} className="text-slate-700" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-black text-slate-900">{selectedClass.name}</h2>
                            {selectedClass.archived && <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-xs font-bold border border-red-200">ENCERRADA</span>}
                        </div>
                        <div className="flex flex-wrap items-center text-sm text-slate-600 font-medium mt-1 gap-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getSacramentColor(selectedClass.sacrament, db.getSystemConfig().sacramentColors, sacraments.indexOf(selectedClass.sacrament)).badge}`}>
                                {selectedClass.sacrament}
                            </span>
                            <div className="text-xs leading-tight">{getTeamLines(selectedClass).map((line, i) => <div key={i}>{line}</div>)}</div>
                            <div className="hidden md:flex items-center text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                <Clock size={14} className="mr-1" />
                                {days[selectedClass.meetingDay]} às {selectedClass.meetingTime}
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Actions & Exports */}
                <div className="flex gap-2 flex-wrap">
                    {hasFullAccess && (
                        <button
                            onClick={(e) => handleToggleArchive(selectedClass, e)}
                            className="flex items-center px-3 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-bold transition-colors shadow-sm text-sm"
                            title={selectedClass.archived ? "Reabrir Turma" : "Arquivar/Encerrar Turma"}
                        >
                            {selectedClass.archived ? <ArchiveRestore size={16} className="mr-2" /> : <Archive size={16} className="mr-2" />}
                            {selectedClass.archived ? "Reabrir" : "Encerrar"}
                        </button>
                    )}

                    {!selectedClass.archived && canEditClass && (
                        <button 
                            onClick={openBatchModal}
                            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-colors shadow-sm text-sm"
                            title="Lançamento em Lote"
                        >
                            <ListChecks size={16} className="mr-2" /> Lançar
                        </button>
                    )}

                    <button 
                        onClick={() => handleExportClassCSV(selectedClass)}
                        className="flex items-center px-3 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 font-bold transition-colors shadow-sm text-sm"
                        title="Exportar CSV (Excel)"
                    >
                        <FileSpreadsheet size={16} className="mr-2" /> CSV
                    </button>
                    <button 
                        onClick={() => handleExportClassPDF(selectedClass)}
                        className="flex items-center px-3 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 font-bold transition-colors shadow-sm text-sm"
                        title="Exportar Relatório PDF"
                    >
                        <FileText size={16} className="mr-2" /> PDF
                    </button>
                </div>
            </div>

            {/* Summary Cards Row 1: Totals */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-300">
                    <p className="text-sm font-bold text-slate-500 uppercase">Total Catequizandos</p>
                    <p className="text-3xl font-black text-slate-900">{stats?.classStudents.length}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-300">
                    <p className="text-sm font-bold text-slate-500 uppercase">Encontros Esperados</p>
                    <p className="text-3xl font-black text-blue-600">{stats?.totalEncontros}</p>
                    <p className="text-xs text-slate-400 font-medium mt-1">Por catequizando (até hoje)</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-300">
                     <p className="text-sm font-bold text-slate-500 uppercase">Missas Esperadas</p>
                     <p className="text-3xl font-black text-red-600">{stats?.totalMissas}</p>
                     <p className="text-xs text-slate-400 font-medium mt-1">Por catequizando (até hoje)</p>
                </div>
            </div>

            {/* Summary Cards Row 2: Class Averages */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 flex items-center justify-between shadow-sm">
                    <div>
                        <p className="text-sm font-bold text-blue-800 uppercase mb-1">Média da Turma (Encontros)</p>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-black text-blue-700">{avgEncontro}%</span>
                            <span className="text-sm text-blue-600 font-medium mb-1.5">de presença global</span>
                        </div>
                    </div>
                    <div className="bg-blue-200 p-3 rounded-full text-blue-700">
                        <BarChart3 size={24} />
                    </div>
                </div>

                <div className="bg-red-50 p-5 rounded-xl border border-red-100 flex items-center justify-between shadow-sm">
                    <div>
                        <p className="text-sm font-bold text-red-800 uppercase mb-1">Média da Turma (Missas)</p>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-black text-red-700">{avgMissa}%</span>
                            <span className="text-sm text-red-600 font-medium mb-1.5">de presença global</span>
                        </div>
                    </div>
                    <div className="bg-red-200 p-3 rounded-full text-red-700">
                        <BarChart3 size={24} />
                    </div>
                </div>
            </div>

            {/* Pending Selfies Banner */}
            {pendingClassLogs.length > 0 && canEditClass && (
                <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in fade-in">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-500 text-white rounded-xl shadow-sm">
                            <Camera size={24} />
                        </div>
                        <div>
                            <h4 className="text-base font-black text-amber-950 uppercase tracking-tight flex items-center gap-2">
                                <span>Validação Manual de Fotos ({pendingClassLogs.length})</span>
                                <span className="animate-pulse px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black">
                                    Aguardando Catequista
                                </span>
                            </h4>
                            <p className="text-xs text-amber-800 font-medium mt-0.5">
                                Catequizandos com GPS desativado enviaram fotos na igreja para você confirmar a presença.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowPendingSelfiesModal(true)}
                        className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-black rounded-xl shadow transition-all flex items-center justify-center gap-2 w-full md:w-auto cursor-pointer"
                    >
                        <Check size={16} /> Revisar Fotos ({pendingClassLogs.length})
                    </button>
                </div>
            )}

            {/* Students Table */}
            <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <h3 className="font-bold text-slate-800 flex items-center">
                        <Users size={18} className="mr-2" />
                        Acompanhamento de Frequência
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-bold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Catequizando</th>
                                <th className="px-6 py-4 text-center">Encontros (%)</th>
                                <th className="px-6 py-4 text-center">Missas (%)</th>
                                {(!selectedClass.archived && canEditClass) && <th className="px-6 py-4 text-center">Ações</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {stats?.classStudents.map(student => {
                                const studentLogs = logs.filter(l => l.studentId === student.id);
                                
                                const countEncontro = studentLogs.filter(a => 
                                    a.type === AttendanceType.ENCONTRO && isLogValidForClass(a.timestamp, selectedClass) && !a.pendingValidation
                                ).length;
                        
                                const countMissa = studentLogs.filter(a => 
                                    a.type === AttendanceType.MISSA && isLogValidForClass(a.timestamp, selectedClass) && !a.pendingValidation
                                ).length;
                                const hasPendingPhoto = studentLogs.some(a => a.pendingValidation);

                                const effectiveTotalEncontros = Math.max(stats.totalEncontros, countEncontro);
                                const effectiveTotalMissas = Math.max(stats.totalMissas, countMissa);

                                const pctEncontro = effectiveTotalEncontros > 0 ? Math.round((countEncontro / effectiveTotalEncontros) * 100) : 0;
                                const pctMissa = effectiveTotalMissas > 0 ? Math.round((countMissa / effectiveTotalMissas) * 100) : 0;

                                const maxFaltasEncontro = Math.floor(stats.totalEncontrosAno * (1 - ((stats.reqs.minEncontro || 0) / 100)));
                                const maxFaltasMissa = Math.floor(stats.totalMissasAno * (1 - ((stats.reqs.minMissa || 0) / 100)));
                                
                                const faltasEncontroAtual = Math.max(0, effectiveTotalEncontros - countEncontro);
                                const faltasMissaAtual = Math.max(0, effectiveTotalMissas - countMissa);

                                const riskEncontro = faltasEncontroAtual > maxFaltasEncontro;
                                const riskMissa = faltasMissaAtual > maxFaltasMissa;

                                return (
                                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <button 
                                                onClick={() => handleOpenStudentDetail(student)}
                                                className="text-left group outline-none"
                                            >
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{formatName(student.name)}</p>
                                                    {hasPendingPhoto && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                                            <Camera size={11} /> Foto pendente
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 font-mono">PIN: {student.pin}</p>
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-lg font-black ${riskEncontro ? 'text-red-600' : 'text-blue-600'}`}>
                                                    {pctEncontro}%
                                                </span>
                                                <span className="text-xs text-slate-500 font-medium">
                                                    {countEncontro} / {effectiveTotalEncontros}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-lg font-black ${riskMissa ? 'text-red-600' : 'text-red-700'}`}>
                                                    {pctMissa}%
                                                </span>
                                                <span className="text-xs text-slate-500 font-medium">
                                                    {countMissa} / {effectiveTotalMissas}
                                                </span>
                                            </div>
                                        </td>
                                        {(!selectedClass.archived && canEditClass) && (
                                            <td className="px-6 py-4 text-center">
                                                <button 
                                                    onClick={() => openManualAttendanceModal(student)}
                                                    className="text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 hover:border-blue-300 transition-all flex items-center justify-center mx-auto"
                                                >
                                                    <ClipboardCheck size={16} className="mr-1" /> Lançar
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* View Student Details Modal */}
            {viewStudent && (
                 <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-2xl w-full p-6 animate-in fade-in zoom-in duration-200 relative max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-6 border-b border-slate-200 pb-4">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">
                                    {isEditingStudent ? 'Editar Catequizando' : 'Dados & Frequência'}
                                </h3>
                                <p className="text-slate-500 text-sm mt-1">{selectedClass.name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {!isEditingStudent && (!selectedClass.archived && canEditClass) && (
                                    <button 
                                        onClick={handleStartEditStudent}
                                        className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                        title="Editar Dados"
                                    >
                                        <Edit2 size={20} />
                                    </button>
                                )}
                                <button onClick={() => setViewStudent(null)} className="text-slate-400 hover:text-slate-800 bg-slate-100 p-1 rounded-full">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {isEditingStudent ? (
                            /* EDIT MODE */
                            <form onSubmit={handleSaveStudentChanges} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-800 mb-1">Nome Completo</label>
                                    <input 
                                        required
                                        type="text"
                                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                                        value={studentFormData.name || ''}
                                        onChange={e => setStudentFormData({...studentFormData, name: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-800 mb-1">Celular</label>
                                    <input 
                                        type="text"
                                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                                        value={studentFormData.phone || ''}
                                        onChange={e => setStudentFormData({...studentFormData, phone: e.target.value})}
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 mb-1">Nome do Pai</label>
                                        <input 
                                            type="text"
                                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                                            value={studentFormData.fatherName || ''}
                                            onChange={e => setStudentFormData({...studentFormData, fatherName: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 mb-1">Tel. Pai</label>
                                        <input 
                                            type="text"
                                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                                            value={studentFormData.fatherPhone || ''}
                                            onChange={e => setStudentFormData({...studentFormData, fatherPhone: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 mb-1">Nome da Mãe</label>
                                        <input 
                                            type="text"
                                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                                            value={studentFormData.motherName || ''}
                                            onChange={e => setStudentFormData({...studentFormData, motherName: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 mb-1">Tel. Mãe</label>
                                        <input 
                                            type="text"
                                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                                            value={studentFormData.motherPhone || ''}
                                            onChange={e => setStudentFormData({...studentFormData, motherPhone: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-slate-100">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Outro Responsável</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                                        <input 
                                            placeholder="Nome"
                                            type="text"
                                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                                            value={studentFormData.guardianName || ''}
                                            onChange={e => setStudentFormData({...studentFormData, guardianName: e.target.value})}
                                        />
                                        <input 
                                            placeholder="Parentesco (Ex: Avó)"
                                            type="text"
                                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                                            value={studentFormData.guardianRelationship || ''}
                                            onChange={e => setStudentFormData({...studentFormData, guardianRelationship: e.target.value})}
                                        />
                                    </div>
                                    <input 
                                        placeholder="Telefone Responsável"
                                        type="text"
                                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                                        value={studentFormData.guardianPhone || ''}
                                        onChange={e => setStudentFormData({...studentFormData, guardianPhone: e.target.value})}
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button 
                                        type="button" 
                                        onClick={() => setIsEditingStudent(false)}
                                        className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="flex-1 py-2 bg-blue-700 text-white rounded-lg font-bold hover:bg-blue-800 flex items-center justify-center shadow-lg shadow-blue-700/20"
                                        disabled={isSaving}
                                    >
                                        <Save size={18} className="mr-2" />
                                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            /* VIEW MODE */
                            <div className="space-y-6">
                                {/* Header / Personal */}
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <div className="flex items-center mb-3">
                                        <div className="bg-blue-100 text-blue-700 p-2 rounded-full mr-3">
                                            <User size={24} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-lg text-slate-900 leading-tight">{viewStudent.name}</p>
                                            <p className="text-sm text-slate-500 font-mono">PIN: {viewStudent.pin}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="block text-slate-500 font-bold text-xs uppercase">Celular</span>
                                            <span className="font-medium text-slate-800">{viewStudent.phone || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-500 font-bold text-xs uppercase">Sacramento</span>
                                            <span className="font-medium text-slate-800">{viewStudent.sacrament}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Family Contact Info (Simplified view) */}
                                <div className="text-xs text-slate-500">
                                    <p><strong className="text-slate-700">Pai:</strong> {viewStudent.fatherName || '-'} <strong className="ml-2 text-slate-700">Tel:</strong> {viewStudent.fatherPhone || '-'}</p>
                                    <p><strong className="text-slate-700">Mãe:</strong> {viewStudent.motherName || '-'} <strong className="ml-2 text-slate-700">Tel:</strong> {viewStudent.motherPhone || '-'}</p>
                                </div>

                                {/* DETAILED ATTENDANCE REPORT */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="flex items-center text-sm font-black text-slate-700 uppercase tracking-wide">
                                            <Calendar size={16} className="mr-2 text-slate-400" />
                                            Histórico Detalhado
                                        </h4>
                                        <button 
                                            onClick={() => handleExportIndividualPDF(viewStudent)}
                                            className="text-[10px] flex items-center bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded hover:bg-red-100 font-bold"
                                        >
                                            <FileText size={12} className="mr-1"/> PDF
                                        </button>
                                    </div>
                                    
                                    <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto overflow-x-auto bg-white">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-100 text-slate-600 text-xs font-bold uppercase sticky top-0">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">Data</th>
                                                    <th className="px-3 py-2 text-left">Evento</th>
                                                    <th className="px-3 py-2 text-center">Status</th>
                                                    <th className="px-3 py-2 text-center">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {getDetailedHistory(viewStudent, selectedClass).map((h, i) => (
                                                    <tr key={i} className="hover:bg-slate-50">
                                                        <td className="px-3 py-2 text-slate-700 font-mono text-xs">
                                                            {new Date(h.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-800 font-medium">
                                                            {h.type}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            {h.status === 'PRESENTE' ? (
                                                                <span className="text-[10px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">PRESENTE</span>
                                                            ) : h.status === 'PENDENTE' ? (
                                                                <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300 animate-pulse inline-flex items-center justify-center gap-1">
                                                                    <Camera size={11} /> PENDENTE
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200">FALTA</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                {h.photoUrl && (
                                                                    <button onClick={() => setViewPhotoUrl(h.photoUrl!)} className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors inline-flex justify-center items-center cursor-pointer" title="Ver foto">
                                                                        <Camera size={14} />
                                                                    </button>
                                                                )}
                                                                {h.log?.pendingValidation && canEditClass && (
                                                                    <>
                                                                        <button
                                                                            onClick={async () => {
                                                                                await db.validateAttendanceLog(h.log!.id, currentUser?.name || 'Catequista');
                                                                                refreshData();
                                                                            }}
                                                                            className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-300 transition-colors inline-flex justify-center items-center shadow-sm cursor-pointer"
                                                                            title="Aprovar Presença por Foto"
                                                                        >
                                                                            <Check size={14} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                requestConfirm('Deseja rejeitar e remover este registro de foto?', async () => {
                                                                                    await db.rejectAttendanceLog(h.log!.id);
                                                                                    refreshData();
                                                                                });
                                                                            }}
                                                                            className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-md border border-red-200 transition-colors inline-flex justify-center items-center shadow-sm cursor-pointer"
                                                                            title="Rejeitar Presença"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {h.status === 'PRESENTE' && h.log && (
                                                                    <button 
                                                                        onClick={() => setEditingAttendanceLog({
                                                                            logId: h.log!.id,
                                                                            studentId: viewStudent.id,
                                                                            studentName: viewStudent.name,
                                                                            className: selectedClass.name,
                                                                            timestamp: h.log!.timestamp,
                                                                            currentType: h.log!.type,
                                                                            currentEventName: h.log!.eventName,
                                                                            currentJustification: h.log!.justification
                                                                        })}
                                                                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md border border-slate-200 transition-colors inline-flex justify-center items-center cursor-pointer" 
                                                                        title="Editar Frequência / Categoria"
                                                                    >
                                                                        <Pencil size={14} />
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
                            </div>
                        )}
                    </div>
                 </div>
            )}

            {/* Manual Attendance Modal (Single) */}
            {showManualModal && manualStudent && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200 relative">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4">
                            <h3 className="text-lg font-black text-slate-900">Lançamento Manual</h3>
                            <button onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-slate-800 bg-slate-100 p-1 rounded-full">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="mb-6">
                             <p className="text-sm text-slate-500 uppercase font-bold">Catequizando</p>
                             <p className="text-xl font-bold text-slate-900">{manualStudent.name}</p>
                        </div>

                        <form onSubmit={handleManualAttendanceSubmit} className="space-y-4">
                             <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Data da Presença</label>
                                <input 
                                    type="date"
                                    required
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                                    value={manualDate}
                                    onChange={e => setManualDate(e.target.value)}
                                />
                                <p className="text-xs text-orange-600 mt-1">
                                    Atenção: A data deve estar dentro do período letivo da turma para contabilizar.
                                </p>
                             </div>
                             
                             <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Tipo de Evento</label>
                                <select 
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                                    value={manualType}
                                    onChange={e => setManualType(e.target.value as AttendanceType)}
                                >
                                    <option value={AttendanceType.ENCONTRO}>Encontro</option>
                                    <option value={AttendanceType.MISSA}>Missa</option>
                                    <option value={AttendanceType.MISSAO}>Missão</option>
                                    <option value={AttendanceType.RETIRO}>Retiro</option>
                                </select>
                             </div>

                             <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Justificativa / Observação</label>
                                <textarea 
                                    required
                                    rows={3}
                                    placeholder="Ex: Esqueceu o PIN, Lista de papel..."
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 outline-none resize-none"
                                    value={manualJustification}
                                    onChange={e => setManualJustification(e.target.value)}
                                />
                             </div>

                             <button 
                                type="submit"
                                disabled={isSaving}
                                className="w-full py-3 bg-blue-700 text-white rounded-xl hover:bg-blue-800 font-bold shadow-lg shadow-blue-700/20 flex justify-center items-center"
                             >
                                {isSaving ? "Salvando..." : "Confirmar Presença"}
                             </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Batch Attendance Modal */}
            {showBatchModal && selectedClass && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-2xl w-full p-6 animate-in fade-in zoom-in duration-200 relative flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-4 flex-shrink-0">
                            <h3 className="text-xl font-black text-slate-900">Lançamento em Lote</h3>
                            <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-slate-800 bg-slate-100 p-1 rounded-full">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 flex-shrink-0">
                             <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Datas Selecionadas ({batchDates.length})</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="date"
                                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                                        value={tempBatchDate}
                                        onChange={e => setTempBatchDate(e.target.value)}
                                    />
                                    <button 
                                        type="button" 
                                        onClick={addBatchDate}
                                        className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2 max-h-20 overflow-y-auto">
                                    {batchDates.map(d => (
                                        <span key={d} className="bg-slate-100 border border-slate-300 px-2 py-1 rounded text-xs font-bold text-slate-700 flex items-center">
                                            {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}
                                            <button onClick={() => removeBatchDate(d)} className="ml-2 text-slate-400 hover:text-red-500">
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                    {batchDates.length === 0 && <span className="text-xs text-red-500 font-medium">Nenhuma data selecionada</span>}
                                </div>
                             </div>
                             
                             <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-bold text-slate-800 mb-1">Tipo</label>
                                    <select 
                                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                                        value={batchType}
                                        onChange={e => setBatchType(e.target.value as AttendanceType)}
                                    >
                                        <option value={AttendanceType.ENCONTRO}>Encontro</option>
                                        <option value={AttendanceType.MISSA}>Missa</option>
                                        <option value={AttendanceType.MISSAO}>Missão</option>
                                        <option value={AttendanceType.RETIRO}>Retiro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-800 mb-1">Motivo</label>
                                    <input 
                                        type="text"
                                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                                        value={batchJustification}
                                        onChange={e => setBatchJustification(e.target.value)}
                                        placeholder="Ex: Lançamento em Lote"
                                    />
                                </div>
                             </div>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col min-h-0 border border-slate-200 rounded-xl">
                            <div className="bg-slate-100 p-3 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                                <h4 className="font-bold text-slate-700">Selecione os Catequizandos</h4>
                                <button 
                                    type="button"
                                    onClick={() => toggleAllBatchStudents(stats!.classStudents)}
                                    className="text-xs font-bold text-blue-700 hover:text-blue-900 uppercase"
                                >
                                    {batchSelectedStudents.length === stats!.classStudents.length ? "Desmarcar Todos" : "Selecionar Todos"}
                                </button>
                            </div>
                            <div className="overflow-y-auto p-2 bg-slate-50 flex-1">
                                {stats?.classStudents.map(student => (
                                    <div 
                                        key={student.id} 
                                        onClick={() => toggleBatchStudent(student.id)}
                                        className={`flex items-center p-3 mb-2 rounded-lg cursor-pointer transition-all border ${
                                            batchSelectedStudents.includes(student.id) 
                                                ? 'bg-blue-100 border-blue-300 shadow-sm' 
                                                : 'bg-white border-slate-200 hover:border-blue-300'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors ${
                                            batchSelectedStudents.includes(student.id)
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'bg-white border-slate-400'
                                        }`}>
                                            {batchSelectedStudents.includes(student.id) && <Check size={14} strokeWidth={4} />}
                                        </div>
                                        <span className={`font-medium ${batchSelectedStudents.includes(student.id) ? 'text-blue-900 font-bold' : 'text-slate-700'}`}>
                                            {formatName(student.name)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4 flex gap-3 flex-shrink-0">
                            <button 
                                type="button"
                                onClick={() => setShowBatchModal(false)}
                                className="flex-1 py-3 border border-slate-300 bg-white rounded-xl hover:bg-slate-50 text-slate-700 font-bold"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="button"
                                onClick={handleBatchSubmit}
                                disabled={isSaving}
                                className="flex-1 py-3 bg-blue-700 text-white rounded-xl hover:bg-blue-800 font-bold shadow-lg flex justify-center items-center"
                            >
                                {isSaving ? "Processando..." : `Confirmar (${batchSelectedStudents.length} catequizandos x ${batchDates.length} datas)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Modal */}
            {viewPhotoUrl && (
                <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[110] p-4 backdrop-blur-sm">
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

            {/* Pending Selfies Modal for Class */}
            {showPendingSelfiesModal && selectedClass && (
                <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-[105] p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 max-w-2xl w-full p-6 max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-200 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-sm">
                                    <Camera size={22} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Validar Presenças por Foto (Selfie)</h3>
                                    <p className="text-xs text-slate-500 font-medium">{selectedClass.name} • {pendingClassLogs.length} {pendingClassLogs.length === 1 ? 'pendência' : 'pendências'}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowPendingSelfiesModal(false)}
                                className="text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto py-4 space-y-3 flex-1 pr-1">
                            {pendingClassLogs.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-2" />
                                    <p className="font-bold text-slate-800">Todas as presenças com foto foram validadas!</p>
                                    <p className="text-xs text-slate-400 mt-1">Não há nenhuma foto aguardando revisão nesta turma.</p>
                                </div>
                            ) : (
                                pendingClassLogs.map(log => {
                                    const student = students.find(s => s.id === log.studentId);
                                    const logDate = new Date(log.timestamp);
                                    const formattedDate = !isNaN(logDate.getTime()) 
                                        ? logDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                        : log.timestamp;

                                    return (
                                        <div key={log.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-amber-300 transition-all">
                                            <div className="flex items-center gap-3">
                                                {log.photoUrl ? (
                                                    <div 
                                                        onClick={() => setViewPhotoUrl(log.photoUrl!)}
                                                        className="relative w-14 h-14 rounded-xl overflow-hidden cursor-pointer border-2 border-amber-300 hover:opacity-90 transition-opacity flex-shrink-0 group"
                                                        title="Clique para ampliar foto"
                                                    >
                                                        <img src={log.photoUrl} alt="Selfie" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                            <Camera size={16} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-14 h-14 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                                        Sem foto
                                                    </div>
                                                )}

                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-black text-slate-900 text-sm">{student ? formatName(student.name) : 'Catequizando'}</p>
                                                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded border border-amber-300">
                                                            Selfie na Igreja
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                                        {log.type} {log.eventName ? `(${log.eventName})` : ''} • {formattedDate}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400 font-mono">
                                                        PIN: {student?.pin || '-'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                                                <button
                                                    onClick={async () => {
                                                        await db.validateAttendanceLog(log.id, currentUser?.name || 'Catequista');
                                                        refreshData();
                                                    }}
                                                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <Check size={14} /> Aprovar
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        requestConfirm('Deseja rejeitar e excluir esta presença por foto?', async () => {
                                                            await db.rejectAttendanceLog(log.id);
                                                            refreshData();
                                                        });
                                                    }}
                                                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <Trash2 size={14} /> Rejeitar
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 flex-shrink-0">
                            <button
                                onClick={() => setShowPendingSelfiesModal(false)}
                                className="w-full sm:w-auto px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold rounded-lg text-sm transition-colors cursor-pointer"
                            >
                                Fechar
                            </button>
                            {pendingClassLogs.length > 1 && (
                                <button
                                    onClick={async () => {
                                        for (const l of pendingClassLogs) {
                                            await db.validateAttendanceLog(l.id, currentUser?.name || 'Catequista');
                                        }
                                        refreshData();
                                        setShowPendingSelfiesModal(false);
                                    }}
                                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <Check size={16} /> Aprovar Todas as Fotos ({pendingClassLogs.length})
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
      );
  }
  // --- Class List View (Default) ---

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Turmas</h2>
          <p className="text-slate-600 font-medium">Gerenciamento de turmas e diário de classe</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setShowArchived(!showArchived)}
                className={`px-4 py-2 rounded-lg font-bold border transition-colors text-sm flex items-center ${showArchived ? 'bg-slate-200 text-slate-800 border-slate-300' : 'bg-white text-slate-600 border-slate-300'}`}
            >
                <Archive size={16} className="mr-2" />
                {showArchived ? "Ocultar Arquivadas" : "Ver Arquivadas"}
            </button>
            {hasFullAccess && (
                <button 
                onClick={(e) => openModal(undefined, e)}
                className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg flex items-center font-bold shadow-md transition-colors"
                >
                <Plus size={20} className="mr-2" /> Nova Turma
                </button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {classes
          .filter(c => showArchived ? true : !c.archived)
          .sort((a, b) => {
             const idxA = sacraments.indexOf(a.sacrament);
             const idxB = sacraments.indexOf(b.sacrament);
             if (idxA !== idxB) return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
             return a.name.localeCompare(b.name);
          })
          .map((cls) => {
            const classStudentIds = new Set(students.filter(s => s.classId === cls.id).map(s => s.id));
            const pendingCount = logs.filter(l => classStudentIds.has(l.studentId) && l.pendingValidation).length;

            return (
              <div 
                key={cls.id} 
                onClick={() => setSelectedClass(cls)}
                className={`group rounded-xl shadow-md border overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 relative ${cls.archived ? 'bg-slate-100 border-slate-300 opacity-75 grayscale' : 'bg-white border-slate-300 hover:border-blue-400'}`}
              >
                 {/* Card Content */}
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                        getSacramentColor(cls.sacrament, db.getSystemConfig().sacramentColors, sacraments.indexOf(cls.sacrament)).badge
                      }`}>
                        {cls.sacrament}
                      </span>
                      {pendingCount > 0 && !cls.archived && (
                        <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse shadow-sm" title={`${pendingCount} foto(s) aguardando validação`}>
                          <Camera size={12} /> {pendingCount} {pendingCount === 1 ? 'Foto' : 'Fotos'}
                        </span>
                      )}
                    </div>
                    {cls.archived && <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-xs font-bold uppercase">Arquivada</span>}
                {hasFullAccess && !cls.archived && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={(e) => openModal(cls, e)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            <Edit2 size={18} />
                        </button>
                        <button 
                            onClick={(e) => handleDelete(cls.id, e)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                )}
              </div>

              <h3 className="text-xl font-black text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">{cls.name}</h3>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-start text-xs text-slate-500 font-medium leading-tight mt-1">
                  <Users size={14} className="mr-2 text-slate-400 flex-shrink-0" />
                  <div>{getTeamLines(cls).map((line, i) => <div key={i}>{line}</div>)}</div>
                </div>
                <div className="flex items-start text-xs text-slate-500 font-medium leading-tight mt-1">
                  <Clock size={16} className="mr-2 text-slate-400" />
                  {days[cls.meetingDay]} às {cls.meetingTime}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-bold uppercase">
                      {students.filter(s => s.classId === cls.id).length} Catequizandos
                  </span>
                  <span className="text-blue-600 text-sm font-bold flex items-center group-hover:translate-x-1 transition-transform">
                      Abrir Diário <BookOpen size={16} className="ml-1" />
                  </span>
              </div>
            </div>
          </div>
        );
      })}
      </div>

       {/* Edit Class Modal - High Contrast */}
       {showModal && hasFullAccess && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200 relative">
            <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4">
              <h3 className="text-xl font-black text-slate-900">{editingId ? 'Editar Turma' : 'Nova Turma'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-800 transition-colors bg-slate-100 p-1 rounded-full">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto px-1">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Nome da Turma</label>
                <input 
                  required
                  type="text" 
                  placeholder="Ex: Eucaristia I - Sábado Manhã"
                  className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-slate-900 font-medium"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">Catequistas Responsáveis</label>
                <div className="border border-slate-400 rounded-lg max-h-40 overflow-y-auto bg-slate-50 p-2 space-y-1">
                    {catechists.map(cat => (
                        <div 
                            key={cat.id} 
                            onClick={() => toggleCatechist(cat.id)}
                            className={`flex items-center p-2 rounded cursor-pointer transition-colors ${selectedCatechistIds.includes(cat.id) ? 'bg-blue-100 text-blue-900 font-bold' : 'hover:bg-slate-200 text-slate-700'}`}
                        >
                            <div className={`w-4 h-4 border rounded mr-2 flex items-center justify-center ${selectedCatechistIds.includes(cat.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-400'}`}>
                                {selectedCatechistIds.includes(cat.id) && <Check size={12} className="text-white" />}
                            </div>
                            {cat.name} {cat.role === UserRole.MONITOR && <span className="ml-2 text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-black uppercase">Monitor</span>}
                        </div>
                    ))}
                    {catechists.length === 0 && <p className="text-sm text-slate-500 p-2">Nenhum catequista cadastrado.</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">Sacramento</label>
                    <select 
                    className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-slate-900 font-medium"
                    value={sacrament}
                    onChange={(e) => setSacrament(e.target.value)}
                    >
                    {sacraments.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">Dia do Encontro</label>
                    <select 
                    className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-slate-900 font-medium"
                    value={meetingDay}
                    onChange={(e) => setMeetingDay(Number(e.target.value))}
                    >
                    {days.map((d, i) => (
                        <option key={i} value={i}>{d}</option>
                    ))}
                    </select>
                </div>
              </div>
              
              <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Horário</label>
                  <input 
                    type="time" 
                    className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-slate-900 font-medium"
                    value={meetingTime}
                    onChange={e => setMeetingTime(e.target.value)}
                  />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-bold text-slate-800 mb-1">Início dos Encontros</label>
                      <input 
                        type="date" 
                        required
                        className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-slate-900 font-medium"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-bold text-slate-800 mb-1">Fim dos Encontros</label>
                      <input 
                        type="date" 
                        required
                        className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-slate-900 font-medium"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                      />
                  </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-200 mt-2 sticky bottom-0 bg-white">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 border border-slate-300 bg-white rounded-xl hover:bg-slate-50 text-slate-700 font-bold"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 bg-blue-700 text-white rounded-xl hover:bg-blue-800 font-bold shadow-lg shadow-blue-700/20"
                >
                  {isSaving ? "Salvando..." : (editingId ? 'Salvar Alterações' : 'Criar Turma')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} />

      <EditAttendanceModal
        target={editingAttendanceLog}
        onClose={() => setEditingAttendanceLog(null)}
        onSaved={refreshData}
      />
    </div>
  );
};

export default ClassManagement;
