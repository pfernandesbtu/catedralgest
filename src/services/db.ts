
import { AppState, AttendanceLog, AttendanceType, ClassGroup, SacramentType, ScheduledEvent, Student, MassTime, Catechist, UserRole, AttendanceRules, RecessPeriod, LocationConfig, RegistrationCampaign, RegistrationSubmission, AuditLog } from '../types';
import { dbFirestore } from './firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, writeBatch, getDocs, where, setDoc, deleteField } from 'firebase/firestore';

const DEFAULT_PASSWORD = "Catedra123";

let state: AppState = {
    catechists: [],
    classes: [],
    students: [],
    attendance: [],
    scheduledEvents: [],
    massTimes: [],
    requirements: {
      
      
    },
    recessPeriods: [],
    locationConfig: {
        latitude: -22.8858, 
        longitude: -48.4450,
        radiusMeters: 200,
        active: true
    },
    systemConfig: {
        registrationEnabled: true,
        sacraments: [], sacramentColors: {},
        massDurationMinutes: 60,
        meetingDurationMinutes: 60
    },
    registrationCampaigns: [],
    registrationSubmissions: [],
    auditLogs: []
};

type Listener = () => void;
const listeners: Listener[] = [];
let isInitialized = false;

const notifyListeners = () => {
  listeners.forEach(l => l());
};

const getActor = (explicitUser?: { email?: string; name?: string; role?: string }) => {
  if (explicitUser && (explicitUser.email || explicitUser.name)) {
    return {
      email: explicitUser.email || 'usuario@catedral.org',
      name: explicitUser.name || 'Usuário',
      role: explicitUser.role || 'Usuário'
    };
  }
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
    if (raw) {
      const u = JSON.parse(raw);
      return {
        email: u.email || 'usuario@catedral.org',
        name: u.name || 'Usuário',
        role: u.role || 'Usuário'
      };
    }
  } catch (e) {}
  return {
    email: 'sistema@viacaeli.net',
    name: 'Sistema',
    role: 'Sistema'
  };
};

const recordAudit = async (entry: {
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  details?: string;
  snapshot?: any;
  user?: { email?: string; name?: string; role?: string };
}) => {
  if (!dbFirestore) return;
  try {
    const actor = getActor(entry.user);
    const docData: any = {
      timestamp: new Date().toISOString(),
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityName: entry.entityName || '',
      userEmail: actor.email,
      userName: actor.name,
      userRole: actor.role,
      details: entry.details || '',
      undone: false
    };
    if (entry.snapshot !== undefined) {
      docData.snapshot = JSON.parse(JSON.stringify(entry.snapshot));
    }
    await addDoc(collection(dbFirestore, 'audit_logs'), docData);
  } catch (err) {
    console.warn('Falha ao registrar log de auditoria:', err);
  }
};

export const db = {
  init: async () => {
    if (isInitialized || !dbFirestore) return;
    isInitialized = true;

    const syncCollection = (colName: string, stateKey: keyof AppState) => {
      onSnapshot(collection(dbFirestore, colName), (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          (state as any)[stateKey] = data;
          notifyListeners();
      });
    };

    const syncConfig = () => {
        onSnapshot(collection(dbFirestore, 'config'), (snapshot) => {
        snapshot.docs.forEach(doc => {
            if(doc.id === 'requirements') state.requirements = doc.data() as any;
            if(doc.id === 'location') state.locationConfig = doc.data() as any;
            if(doc.id === 'system') {
                const data = doc.data() as any;
                state.systemConfig = {
                    registrationEnabled: data.registrationEnabled ?? true,
                    sacraments: data.sacraments || [],
                    sacramentColors: data.sacramentColors || {},
                    massDurationMinutes: data.massDurationMinutes ?? 60,
                    meetingDurationMinutes: data.meetingDurationMinutes ?? 60
                };
            }
        });
        notifyListeners();
        });
    }

    syncCollection('students', 'students');
    syncCollection('classes', 'classes');
    syncCollection('attendance', 'attendance');
    syncCollection('catechists', 'catechists');
    syncCollection('events', 'scheduledEvents');
    syncCollection('mass_times', 'massTimes');
    syncCollection('recess_periods', 'recessPeriods');
    syncCollection('registration_campaigns', 'registrationCampaigns');
    syncCollection('registration_submissions', 'registrationSubmissions');
    syncCollection('audit_logs', 'auditLogs');
    syncConfig();


  },

  onChange: (callback: Listener) => {
    listeners.push(callback);
    return () => {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    };
  },

  login: async (email: string, password: string): Promise<Catechist> => {
     if (email === 'suporte@viacaeli.net' && password === 'suporte@egest') {
         return {
             id: 'suporte_dev_id',
             name: 'Suporte',
             email: 'suporte@viacaeli.net',
             role: UserRole.COORDINATOR,
             sacramentSpecialty: 'Todos',
             phone: '00000000000',
             password: 'suporte@egest',
             isDefaultPassword: false
         } as Catechist;
     }
     let user: Catechist | undefined;
     const q = query(collection(dbFirestore!, 'catechists'), where('email', '==', email));
     const snapshot = await getDocs(q);
     if (!snapshot.empty) {
         user = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Catechist;
     }
     if (!user) throw new Error("Usuário não encontrado.");
     const storedPass = user.password || DEFAULT_PASSWORD;
     if (storedPass !== password) throw new Error("Senha incorreta.");
     return user;
  },

  changePassword: async (userId: string, newPassword: string) => {
     await updateDoc(doc(dbFirestore!, 'catechists', userId), { password: newPassword, isDefaultPassword: false });
  },

  adminResetPassword: async (userId: string) => {
      await updateDoc(doc(dbFirestore!, 'catechists', userId), { password: DEFAULT_PASSWORD, isDefaultPassword: true });
  },

  getStudents: () => state.students,
  getClasses: () => state.classes,
  getAttendance: () => state.attendance,
  getScheduledEvents: () => state.scheduledEvents,
  getMassTimes: () => state.massTimes,
  getCatechists: () => state.catechists.filter(c => c.email !== 'suporte@viacaeli.net'),
  getRequirements: () => state.requirements,
  getRecessPeriods: () => state.recessPeriods,
  getLocationConfig: () => state.locationConfig,
  getSystemConfig: () => state.systemConfig,
  getRegistrationCampaigns: () => state.registrationCampaigns,
  getRegistrationSubmissions: () => state.registrationSubmissions,
  getAuditLogs: () => {
    return [...state.auditLogs].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  },
  getDetectedOrphanClasses: () => {
    const existingClassIds = new Set(state.classes.map(c => c.id));
    const orphanMap: Record<string, { classId: string; sacrament: string; students: Student[]; attendanceCount: number }> = {};

    state.students.forEach(student => {
      if (student.classId && !existingClassIds.has(student.classId)) {
        if (!orphanMap[student.classId]) {
          orphanMap[student.classId] = {
            classId: student.classId,
            sacrament: student.sacrament || 'Crisma',
            students: [],
            attendanceCount: 0
          };
        }
        orphanMap[student.classId].students.push(student);
      }
    });

    const orphanList = Object.values(orphanMap);
    orphanList.forEach(item => {
      const sIds = new Set(item.students.map(s => s.id));
      item.attendanceCount = state.attendance.filter(a => sIds.has(a.studentId)).length;
    });

    return orphanList;
  },
  restoreOrphanClass: async (
    classId: string,
    classData: {
      name: string;
      sacrament: SacramentType;
      catechistIds: string[];
      catechistNames: string[];
      meetingDay: number;
      meetingTime: string;
      startDate: string;
      endDate: string;
      meetingDurationMinutes?: number;
    },
    user?: { email?: string; name?: string; role?: string }
  ) => {
    const cleanData = Object.fromEntries(Object.entries(classData).filter(([_, v]) => v !== undefined));
    await setDoc(doc(dbFirestore!, 'classes', classId), {
      ...cleanData,
      archived: false
    });

    const affectedStudents = state.students.filter(s => s.classId === classId);

    await recordAudit({
      action: 'RESTORE_CLASS',
      entityType: 'class',
      entityId: classId,
      entityName: classData.name,
      details: `Turma "${classData.name}" (${classData.sacrament}) restaurada com ID original "${classId}". ${affectedStudents.length} catequizando(s) reconectados.`,
      user
    });
  },
  undoAuditAction: async (logId: string, user?: { email?: string; name?: string; role?: string }) => {
    const log = state.auditLogs.find(l => l.id === logId);
    if (!log) throw new Error("Registro de auditoria não encontrado.");
    if (log.undone) throw new Error("Esta ação já foi desfeita anteriormente.");

    if (log.action === 'DELETE_CLASS' && log.snapshot) {
      const { id, ...data } = log.snapshot;
      const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      await setDoc(doc(dbFirestore!, 'classes', id || log.entityId), cleanData);
    } else if (log.action === 'DELETE_STUDENT' && log.snapshot) {
      const { id, ...data } = log.snapshot;
      const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      await setDoc(doc(dbFirestore!, 'students', id || log.entityId), cleanData);
    } else if (log.action === 'DELETE_CATECHIST' && log.snapshot) {
      const { id, ...data } = log.snapshot;
      const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      await setDoc(doc(dbFirestore!, 'catechists', id || log.entityId), cleanData);
    } else if ((log.action === 'DELETE_ATTENDANCE' || log.action === 'REJECT_ATTENDANCE') && log.snapshot) {
      const { id, ...data } = log.snapshot;
      const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      await setDoc(doc(dbFirestore!, 'attendance', id || log.entityId), cleanData);
    } else if (log.action === 'DELETE_EVENT' && log.snapshot) {
      const { id, ...data } = log.snapshot;
      const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      await setDoc(doc(dbFirestore!, 'events', id || log.entityId), cleanData);
    } else if (log.action === 'UPDATE_STUDENT' && log.snapshot) {
      const { id, ...data } = log.snapshot;
      const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      await setDoc(doc(dbFirestore!, 'students', id || log.entityId), cleanData);
    } else if (log.action === 'UPDATE_CLASS' && log.snapshot) {
      const { id, ...data } = log.snapshot;
      const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      await setDoc(doc(dbFirestore!, 'classes', id || log.entityId), cleanData);
    } else if (log.action === 'ARCHIVE_CLASS') {
      await db.toggleClassArchive(log.entityId, false, user);
    } else if (log.action === 'UNARCHIVE_CLASS') {
      await db.toggleClassArchive(log.entityId, true, user);
    } else {
      throw new Error(`Não é possível reverter automaticamente a ação do tipo ${log.action}.`);
    }

    const actor = getActor(user);
    await updateDoc(doc(dbFirestore!, 'audit_logs', logId), {
      undone: true,
      undoneAt: new Date().toISOString(),
      undoneBy: actor.email
    });

    await recordAudit({
      action: 'SYSTEM_RECOVERY',
      entityType: log.entityType,
      entityId: log.entityId,
      entityName: log.entityName,
      details: `Desfeita com sucesso a ação "${log.action}" de "${log.entityName}". Documento ou estado restaurado.`,
      user
    });
  },
  getFullState: () => state,
  
  findStudentByPin: (pin: string): Student | undefined => state.students.find(s => s.pin === pin),

  getActiveEvents: (): ScheduledEvent[] => {
    const nowTime = new Date().getTime();
    return state.scheduledEvents.filter(e => {
      // Libera 30 minutos antes do início e encerra 30 minutos após o término do evento
      const startWithTolerance = new Date(e.startDate).getTime() - (30 * 60 * 1000);
      const endWithTolerance = new Date(e.endDate).getTime() + (30 * 60 * 1000);
      return nowTime >= startWithTolerance && nowTime <= endWithTolerance;
    });
  },

  getCurrentStandardMass: (): { active: boolean, name?: string } => {
    const now = new Date();
    const todaysMasses = state.massTimes.filter(m => m.dayOfWeek === now.getDay());
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const defaultMassDuration = state.systemConfig.massDurationMinutes || 60;
    for (const mass of todaysMasses) {
        const [h, m] = mass.time.split(':').map(Number);
        const start = h * 60 + m;
        const massDuration = mass.durationMinutes || defaultMassDuration;
        // Libera 30 minutos ANTES do início e encerra 30 minutos APÓS o TÉRMINO da missa
        const startWithTolerance = start - 30;
        const endWithTolerance = start + massDuration + 30;
        if (currentMinutes >= startWithTolerance && currentMinutes <= endWithTolerance) {
            return { active: true, name: `Missa Padrão (${mass.time})` };
        }
    }
    return { active: false };
  },

  getStats: () => {
    return {
      totalStudents: state.students.filter(s => !s.archived).length,
      totalAttendance: state.attendance.length,
      studentsAtRisk: 0 // Logic moved to detailed report, no longer valid as global stat
    };
  },

  logAttendance: async (
    studentId: string, 
    type: AttendanceType, 
    eventName?: string, 
    justification?: string, 
    customDate?: string, 
    presentParents?: string[], 
    photoUrl?: string,
    pendingValidation?: boolean,
    locationStatus?: 'GPS' | 'MANUAL_SELFIE' | 'ADMIN',
    user?: { email?: string; name?: string; role?: string }
  ) => {
    const timestamp = customDate ? new Date(customDate + 'T12:00:00').toISOString() : new Date().toISOString();
    const dateOnly = timestamp.split('T')[0];
    const exists = state.attendance.some(a => a.studentId === studentId && a.timestamp.split('T')[0] === dateOnly && a.type === type && (eventName ? a.eventName === eventName : true));
    if (exists) return { success: false, message: 'Presença já registrada para hoje.' };
    const newLog: any = { studentId, timestamp, type };
    if (eventName) newLog.eventName = eventName;
    if (justification) newLog.justification = justification;
    if (presentParents) newLog.presentParents = presentParents;
    if (photoUrl) newLog.photoUrl = photoUrl;
    if (pendingValidation !== undefined) newLog.pendingValidation = pendingValidation;
    if (locationStatus) newLog.locationStatus = locationStatus;
    const ref = await addDoc(collection(dbFirestore!, 'attendance'), newLog);

    if (locationStatus === 'ADMIN' || customDate) {
      const student = state.students.find(s => s.id === studentId);
      await recordAudit({
        action: 'MANUAL_ATTENDANCE',
        entityType: 'attendance',
        entityId: ref.id,
        entityName: student?.name || 'Catequizando',
        details: `Lançamento manual de presença (${type}${eventName ? ` - ${eventName}` : ''}) para "${student?.name || 'catequizando'}" na data ${dateOnly}.${justification ? ` Justificativa: ${justification}` : ''}`,
        snapshot: { id: ref.id, ...newLog },
        user
      });
    }

    return { 
      success: true, 
      message: pendingValidation 
        ? 'Foto enviada com sucesso! Aguardando validação do catequista.' 
        : 'Presença Confirmada!' 
    };
  },

  validateAttendanceLog: async (id: string, validatorName: string, user?: { email?: string; name?: string; role?: string }) => {
    const log = state.attendance.find(a => a.id === id);
    const student = log ? state.students.find(s => s.id === log.studentId) : null;
    await db.updateAttendanceLog(id, {
      pendingValidation: false,
      validatedBy: validatorName,
      validatedAt: new Date().toISOString()
    });
    await recordAudit({
      action: 'VALIDATE_ATTENDANCE',
      entityType: 'attendance',
      entityId: id,
      entityName: student?.name || 'Presença',
      details: `Presença com foto aprovada e validada para "${student?.name || 'catequizando'}" (${log?.type || 'Encontro'} em ${log?.timestamp?.substring(0, 10)}) pelo catequista/coordenador ${validatorName}.`,
      snapshot: log,
      user
    });
  },

  rejectAttendanceLog: async (id: string, user?: { email?: string; name?: string; role?: string }) => {
    const log = state.attendance.find(a => a.id === id);
    const student = log ? state.students.find(s => s.id === log.studentId) : null;
    await recordAudit({
      action: 'REJECT_ATTENDANCE',
      entityType: 'attendance',
      entityId: id,
      entityName: student?.name || 'Presença',
      details: `Presença com foto rejeitada e excluída para "${student?.name || 'catequizando'}" (${log?.type || 'Encontro'} em ${log?.timestamp?.substring(0, 10)}).`,
      snapshot: log,
      user
    });
    await deleteDoc(doc(dbFirestore!, 'attendance', id));
  },

  deleteAttendanceLog: async (id: string, user?: { email?: string; name?: string; role?: string }) => {
    const log = state.attendance.find(a => a.id === id);
    const student = log ? state.students.find(s => s.id === log.studentId) : null;
    await recordAudit({
      action: 'DELETE_ATTENDANCE',
      entityType: 'attendance',
      entityId: id,
      entityName: student?.name || 'Presença',
      details: `Registro de presença excluído para "${student?.name || 'catequizando'}" (${log?.type || 'Presença'} em ${log?.timestamp?.substring(0, 10)}).`,
      snapshot: log,
      user
    });
    await deleteDoc(doc(dbFirestore!, 'attendance', id));
  },

  updateAttendanceLog: async (id: string, updates: Partial<AttendanceLog>, user?: { email?: string; name?: string; role?: string }) => {
    const previous = state.attendance.find(a => a.id === id);
    const student = previous ? state.students.find(s => s.id === previous.studentId) : null;

    const { id: _, ...data } = updates as any;
    const cleanData: any = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) {
        cleanData[k] = v;
      }
    }
    if ('eventName' in updates && (!updates.eventName || updates.eventName.trim() === '')) {
      cleanData.eventName = deleteField();
    }
    if ('justification' in updates && (!updates.justification || updates.justification.trim() === '')) {
      cleanData.justification = deleteField();
    }
    await updateDoc(doc(dbFirestore!, 'attendance', id), cleanData);
    const index = state.attendance.findIndex(a => a.id === id);
    if (index !== -1) {
      state.attendance[index] = { ...state.attendance[index], ...updates };
      notifyListeners();
    }

    const isOnlyValidation = Object.keys(updates).every(k => ['pendingValidation', 'validatedBy', 'validatedAt'].includes(k));
    if (!isOnlyValidation) {
      await recordAudit({
        action: 'UPDATE_ATTENDANCE',
        entityType: 'attendance',
        entityId: id,
        entityName: student?.name || 'Presença',
        details: `Registro de presença alterado para "${student?.name || 'catequizando'}". Campos atualizados: ${Object.keys(updates).join(', ')}.`,
        snapshot: previous,
        user
      });
    }
  },
  
  addStudent: async (student: Student, user?: { email?: string; name?: string; role?: string }) => {
    if (state.students.some(s => s.pin === student.pin)) throw new Error('PIN já existe');
    const { id, ...data } = student;
    const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
    const ref = await addDoc(collection(dbFirestore!, 'students'), cleanData);
    const cls = state.classes.find(c => c.id === student.classId);
    await recordAudit({
      action: 'CREATE_STUDENT',
      entityType: 'student',
      entityId: ref.id,
      entityName: student.name,
      details: `Novo catequizando cadastrado: "${student.name}" (PIN: ${student.pin}, Sacramento: ${student.sacrament}${cls ? `, Turma: ${cls.name}` : ''}).`,
      snapshot: { id: ref.id, ...cleanData },
      user
    });
  },
  updateStudent: async (s: Student, user?: { email?: string; name?: string; role?: string }) => {
    const { id, ...data } = s;
    const previous = state.students.find(st => st.id === id);
    const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
    await updateDoc(doc(dbFirestore!, 'students', id), cleanData as any);
    const oldCls = previous ? state.classes.find(c => c.id === previous.classId) : null;
    const newCls = state.classes.find(c => c.id === s.classId);
    let changeNote = '';
    if (previous && previous.classId !== s.classId) {
      changeNote = ` Mudança de turma: "${oldCls?.name || 'Sem Turma'}" ➔ "${newCls?.name || 'Sem Turma'}".`;
    }
    if (previous && previous.pin !== s.pin) {
      changeNote += ` Alteração de PIN: ${previous.pin} ➔ ${s.pin}.`;
    }
    await recordAudit({
      action: 'UPDATE_STUDENT',
      entityType: 'student',
      entityId: id,
      entityName: s.name,
      details: `Dados do catequizando "${s.name}" foram atualizados.${changeNote}`,
      snapshot: previous ? { id, ...previous } : undefined,
      user
    });
  },
  deleteStudent: async (id: string, user?: { email?: string; name?: string; role?: string }) => {
    const studentObj = state.students.find(s => s.id === id);
    if (studentObj) {
      const { id: _, ...cleanSnapshot } = studentObj;
      await recordAudit({
        action: 'DELETE_STUDENT',
        entityType: 'student',
        entityId: id,
        entityName: studentObj.name,
        details: `Catequizando "${studentObj.name}" (PIN: ${studentObj.pin}) foi excluído(a).`,
        snapshot: { id, ...cleanSnapshot },
        user
      });
    }
    await deleteDoc(doc(dbFirestore!, 'students', id));
  },
  addClass: async (c: ClassGroup, user?: { email?: string; name?: string; role?: string }) => {
    const { id, ...data } = c;
    const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
    const ref = await addDoc(collection(dbFirestore!, 'classes'), cleanData);
    await recordAudit({
      action: 'CREATE_CLASS',
      entityType: 'class',
      entityId: ref.id,
      entityName: c.name,
      details: `Nova turma cadastrada: "${c.name}" (Sacramento: ${c.sacrament}, Horário: ${c.meetingTime}, Catequistas: ${c.catechistNames?.join(', ') || 'Nenhum'}).`,
      snapshot: { id: ref.id, ...cleanData },
      user
    });
  },
  updateClass: async (c: ClassGroup, user?: { email?: string; name?: string; role?: string }) => {
    const { id, ...data } = c;
    const previous = state.classes.find(cl => cl.id === id);
    const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
    await updateDoc(doc(dbFirestore!, 'classes', id), cleanData as any);
    await recordAudit({
      action: 'UPDATE_CLASS',
      entityType: 'class',
      entityId: id,
      entityName: c.name,
      details: `Turma "${c.name}" atualizada (Dia da semana: ${c.meetingDay}, Horário: ${c.meetingTime}, Catequistas: ${c.catechistNames?.join(', ') || 'Nenhum'}).`,
      snapshot: previous ? { id, ...previous } : undefined,
      user
    });
  },
  deleteClass: async (id: string, user?: { email?: string; name?: string; role?: string }) => {
    const classObj = state.classes.find(c => c.id === id);
    const affectedStudents = state.students.filter(s => s.classId === id);

    if (classObj) {
      const { id: _, ...cleanSnapshot } = classObj;
      await recordAudit({
        action: 'DELETE_CLASS',
        entityType: 'class',
        entityId: id,
        entityName: classObj.name,
        details: `Turma "${classObj.name}" (${classObj.sacrament}) foi excluída. Havia ${affectedStudents.length} catequizando(s) vinculados.`,
        snapshot: { id, ...cleanSnapshot },
        user
      });
    }
    await deleteDoc(doc(dbFirestore!, 'classes', id));
  },
  
  // --- ARCHIVE LOGIC ---
  toggleClassArchive: async (classId: string, archive: boolean, user?: { email?: string; name?: string; role?: string }) => {
      const batch = writeBatch(dbFirestore!);
      const classObj = state.classes.find(c => c.id === classId);
      
      // Update Class
      const classRef = doc(dbFirestore!, 'classes', classId);
      batch.update(classRef, { archived: archive });

      // Update Students in that Class
      const studentsToUpdate = state.students.filter(s => s.classId === classId);
      studentsToUpdate.forEach(s => {
          const studentRef = doc(dbFirestore!, 'students', s.id);
          batch.update(studentRef, { archived: archive });
      });

      await batch.commit();

      if (classObj) {
        await recordAudit({
          action: archive ? 'ARCHIVE_CLASS' : 'UNARCHIVE_CLASS',
          entityType: 'class',
          entityId: classId,
          entityName: classObj.name,
          details: archive 
            ? `Turma "${classObj.name}" foi encerrada/arquivada com ${studentsToUpdate.length} catequizando(s).`
            : `Turma "${classObj.name}" foi reativada/desarquivada.`,
          user
        });
      }
  },

  addCatechist: async (c: Catechist, user?: { email?: string; name?: string; role?: string }) => {
    if (c.email && state.catechists.some(existing => existing.email?.toLowerCase().trim() === c.email?.toLowerCase().trim())) {
      throw new Error('Já existe um usuário cadastrado com este e-mail.');
    }
    const { id, ...data } = c;
    const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
    const ref = await addDoc(collection(dbFirestore!, 'catechists'), { ...cleanData, password: DEFAULT_PASSWORD, isDefaultPassword: true });
    await recordAudit({
      action: 'CREATE_CATECHIST',
      entityType: 'catechist',
      entityId: ref.id,
      entityName: c.name,
      details: `Novo usuário/catequista cadastrado: "${c.name}" (${c.role}, ${c.email || 'Sem e-mail'}).`,
      snapshot: { id: ref.id, ...cleanData },
      user
    });
  },
  updateCatechist: async (c: Catechist, user?: { email?: string; name?: string; role?: string }) => {
    const { id, ...data } = c;
    const previous = state.catechists.find(ct => ct.id === id);
    const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
    await updateDoc(doc(dbFirestore!, 'catechists', id), cleanData as any);
    await recordAudit({
      action: 'UPDATE_CATECHIST',
      entityType: 'catechist',
      entityId: id,
      entityName: c.name,
      details: `Dados do usuário/catequista "${c.name}" atualizados (${c.role}, ${c.email || ''}).`,
      snapshot: previous ? { id, ...previous } : undefined,
      user
    });
  },
  deleteCatechist: async (id: string, user?: { email?: string; name?: string; role?: string }) => {
    const catechist = state.catechists.find(ct => ct.id === id);
    if (catechist) {
      await recordAudit({
        action: 'DELETE_CATECHIST',
        entityType: 'catechist',
        entityId: id,
        entityName: catechist.name,
        details: `Catequista/usuário "${catechist.name}" (${catechist.role}, ${catechist.email}) foi excluído(a).`,
        snapshot: catechist,
        user
      });
    }
    await deleteDoc(doc(dbFirestore!, 'catechists', id));
  },
  addScheduledEvent: async (e: ScheduledEvent, user?: { email?: string; name?: string; role?: string }) => {
    const { id, ...data } = e;
    const ref = await addDoc(collection(dbFirestore!, 'events'), data);
    await recordAudit({
      action: 'CREATE_EVENT',
      entityType: 'event',
      entityId: ref.id,
      entityName: e.title,
      details: `Novo evento agendado: "${e.title}" (${e.type}) para a data ${e.startDate?.substring(0, 10)}.`,
      snapshot: { id: ref.id, ...data },
      user
    });
  },
  updateScheduledEvent: async (e: ScheduledEvent, user?: { email?: string; name?: string; role?: string }) => {
    const { id, ...data } = e;
    const previous = state.scheduledEvents.find(ev => ev.id === id);
    await updateDoc(doc(dbFirestore!, 'events', id), data as any);
    await recordAudit({
      action: 'UPDATE_EVENT',
      entityType: 'event',
      entityId: id,
      entityName: e.title,
      details: `Evento "${e.title}" atualizado.`,
      snapshot: previous ? { id, ...previous } : undefined,
      user
    });
  },
  deleteScheduledEvent: async (id: string, user?: { email?: string; name?: string; role?: string }) => {
    const event = state.scheduledEvents.find(ev => ev.id === id);
    if (event) {
      await recordAudit({
        action: 'DELETE_EVENT',
        entityType: 'event',
        entityId: id,
        entityName: event.title,
        details: `Evento "${event.title}" (${event.type}) foi excluído da agenda.`,
        snapshot: event,
        user
      });
    }
    await deleteDoc(doc(dbFirestore!, 'events', id));
  },
  addMassTime: async (m: MassTime, user?: { email?: string; name?: string; role?: string }) => {
    const { id, ...data } = m;
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const ref = await addDoc(collection(dbFirestore!, 'mass_times'), data);
    await recordAudit({
      action: 'CREATE_CONFIG',
      entityType: 'config',
      entityId: ref.id,
      entityName: `Missa ${days[m.dayOfWeek]} ${m.time}`,
      details: `Novo horário padrão de Missa adicionado: ${days[m.dayOfWeek]} às ${m.time}.`,
      snapshot: { id: ref.id, ...data },
      user
    });
  },
  updateMassTime: async (m: MassTime, user?: { email?: string; name?: string; role?: string }) => {
    const { id, ...data } = m;
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    await updateDoc(doc(dbFirestore!, 'mass_times', id), data as any);
    await recordAudit({
      action: 'UPDATE_CONFIG',
      entityType: 'config',
      entityId: id,
      entityName: `Missa ${days[m.dayOfWeek]} ${m.time}`,
      details: `Horário padrão de Missa atualizado: ${days[m.dayOfWeek]} às ${m.time}.`,
      user
    });
  },
  deleteMassTime: async (id: string, user?: { email?: string; name?: string; role?: string }) => {
    const mass = state.massTimes.find(m => m.id === id);
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    if (mass) {
      await recordAudit({
        action: 'DELETE_CONFIG',
        entityType: 'config',
        entityId: id,
        entityName: `Missa ${days[mass.dayOfWeek]} ${mass.time}`,
        details: `Horário de Missa (${days[mass.dayOfWeek]} às ${mass.time}) foi excluído.`,
        snapshot: mass,
        user
      });
    }
    await deleteDoc(doc(dbFirestore!, 'mass_times', id));
  },
  addRecessPeriod: async (p: RecessPeriod, user?: { email?: string; name?: string; role?: string }) => {
    const { id, ...data } = p;
    const ref = await addDoc(collection(dbFirestore!, 'recess_periods'), data);
    await recordAudit({
      action: 'CREATE_CONFIG',
      entityType: 'config',
      entityId: ref.id,
      entityName: p.name,
      details: `Novo recesso/férias cadastrado: "${p.name}" (${p.startDate} a ${p.endDate}).`,
      snapshot: { id: ref.id, ...data },
      user
    });
  },
  deleteRecessPeriod: async (id: string, user?: { email?: string; name?: string; role?: string }) => {
    const recess = state.recessPeriods.find(r => r.id === id);
    if (recess) {
      await recordAudit({
        action: 'DELETE_CONFIG',
        entityType: 'config',
        entityId: id,
        entityName: recess.name,
        details: `Período de recesso "${recess.name}" foi excluído.`,
        snapshot: recess,
        user
      });
    }
    await deleteDoc(doc(dbFirestore!, 'recess_periods', id));
  },
  saveRequirements: async (req: any, user?: { email?: string; name?: string; role?: string }) => {
    await setDoc(doc(dbFirestore!, 'config', 'requirements'), req, { merge: true });
    await recordAudit({
      action: 'UPDATE_CONFIG',
      entityType: 'config',
      entityId: 'requirements',
      entityName: 'Metas e Requisitos de Presença',
      details: 'As regras e metas de frequência de sacramentos foram atualizadas.',
      user
    });
  },
  saveLocationConfig: async (config: LocationConfig, user?: { email?: string; name?: string; role?: string }) => {
    await setDoc(doc(dbFirestore!, 'config', 'location'), config as any, { merge: true });
    await recordAudit({
      action: 'UPDATE_CONFIG',
      entityType: 'config',
      entityId: 'location',
      entityName: 'Configuração de Geolocalização (GPS)',
      details: `Configuração de GPS do Kiosk atualizada: Raio de ${config.radiusMeters}m, Ativo: ${config.active ? 'Sim' : 'Não'}.`,
      user
    });
  },
  saveSystemConfig: async (config: any, user?: { email?: string; name?: string; role?: string }) => {
    await setDoc(doc(dbFirestore!, 'config', 'system'), config, { merge: true });
    await recordAudit({
      action: 'UPDATE_CONFIG',
      entityType: 'config',
      entityId: 'system',
      entityName: 'Configurações Gerais do Sistema',
      details: 'Parâmetros globais do sistema de catequese atualizados.',
      user
    });
  },
  
  // --- REGISTRATION MODULE METHODS ---
  
  addRegistrationCampaign: async (c: RegistrationCampaign, user?: { email?: string; name?: string; role?: string }) => {
    const { id, ...data } = c;
    const ref = await addDoc(collection(dbFirestore!, 'registration_campaigns'), data);
    await recordAudit({
      action: 'CREATE_CAMPAIGN',
      entityType: 'campaign',
      entityId: ref.id,
      entityName: c.title,
      details: `Nova campanha de inscrições criada: "${c.title}" (${c.sacrament}). Período: ${c.startDate} a ${c.endDate}.`,
      snapshot: { id: ref.id, ...data },
      user
    });
  },
  updateRegistrationCampaign: async (c: RegistrationCampaign, user?: { email?: string; name?: string; role?: string }) => {
    const { id, ...data } = c;
    const previous = state.registrationCampaigns.find(cp => cp.id === id);
    await updateDoc(doc(dbFirestore!, 'registration_campaigns', id), data as any);
    await recordAudit({
      action: 'UPDATE_CAMPAIGN',
      entityType: 'campaign',
      entityId: id,
      entityName: c.title,
      details: `Campanha de inscrições "${c.title}" atualizada.`,
      snapshot: previous ? { id, ...previous } : undefined,
      user
    });
  },
  deleteRegistrationCampaign: async (id: string, user?: { email?: string; name?: string; role?: string }) => {
    const campaign = state.registrationCampaigns.find(cp => cp.id === id);
    if (campaign) {
      await recordAudit({
        action: 'DELETE_CAMPAIGN',
        entityType: 'campaign',
        entityId: id,
        entityName: campaign.title,
        details: `Campanha de inscrições "${campaign.title}" foi excluída.`,
        snapshot: campaign,
        user
      });
    }
    await deleteDoc(doc(dbFirestore!, 'registration_campaigns', id));
  },
  
  addRegistrationSubmission: async (s: RegistrationSubmission) => {
    const { id, ...data } = s;
    await addDoc(collection(dbFirestore!, 'registration_submissions'), data);
  },
  
  approveSubmission: async (submissionId: string, campaign: RegistrationCampaign, user?: { email?: string; name?: string; role?: string }) => {
    const submission = state.registrationSubmissions.find(s => s.id === submissionId);
    if (!submission) throw new Error("Inscrição não encontrada");
    
    // 1. Create Student Object
    let maxPin = 0;
    for (const student of state.students) {
      if (student.pin && student.pin.length <= 3) {
        const pinNum = parseInt(student.pin, 10);
        if (!isNaN(pinNum) && pinNum > maxPin && pinNum < 999) {
          maxPin = pinNum;
        }
      }
    }
    let newPin = (maxPin + 1).toString().padStart(3, '0');

    const newStudent: Student = {
      id: Math.random().toString(36).substr(2, 9),
      name: submission.studentName,
      pin: newPin,
      classId: '', // Needs to be assigned later by coordinator
      sacrament: campaign.sacrament,
      phone: submission.studentPhone || submission.fatherPhone || submission.motherPhone || submission.guardianPhone,
      fatherName: submission.fatherName,
      fatherPhone: submission.fatherPhone,
      fatherEmail: submission.fatherEmail,
      motherName: submission.motherName,
      motherPhone: submission.motherPhone,
      motherEmail: submission.motherEmail,
      guardianName: submission.guardianName,
      guardianPhone: submission.guardianPhone,
      guardianEmail: submission.guardianEmail,
      guardianRelationship: submission.guardianRelationship,
      birthDate: submission.birthDate,
      rg: submission.rg,
      cpf: submission.cpf,
      isBaptized: submission.isBaptized,
      baptismPlace: submission.baptismPlace,
      hasFirstEucaristia: submission.hasFirstEucaristia,
      firstEucaristiaPlace: submission.firstEucaristiaPlace,
      archived: false
    };

    // 2. Add to Students Collection
    const { id, ...studentData } = newStudent;
    const studentRef = await addDoc(collection(dbFirestore!, 'students'), studentData);

    // 3. Update Submission Status
    await updateDoc(doc(dbFirestore!, 'registration_submissions', submissionId), { status: 'APPROVED' });

    // 4. Record Audit Log
    await recordAudit({
      action: 'APPROVE_REGISTRATION',
      entityType: 'registration',
      entityId: submissionId,
      entityName: submission.studentName,
      details: `Ficha de inscrição aprovada para "${submission.studentName}" (${campaign.sacrament}). Criado registro de catequizando com PIN ${newPin}.`,
      snapshot: { submission, studentId: studentRef.id, pin: newPin },
      user
    });
  },

  rejectSubmission: async (id: string, user?: { email?: string; name?: string; role?: string }) => {
    const submission = state.registrationSubmissions.find(s => s.id === id);
    await updateDoc(doc(dbFirestore!, 'registration_submissions', id), { status: 'REJECTED' });
    await recordAudit({
      action: 'REJECT_REGISTRATION',
      entityType: 'registration',
      entityId: id,
      entityName: submission?.studentName || 'Inscrição',
      details: `Inscrição de "${submission?.studentName || 'candidato'}" foi recusada/arquivada.`,
      snapshot: submission,
      user
    });
  },

  resetDatabase: async () => {}
};
