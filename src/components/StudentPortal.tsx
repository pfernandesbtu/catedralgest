
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { getSacramentColor } from '../utils/colors';
import { Student, AttendanceLog, AttendanceType, ClassGroup, SacramentType, Catechist, AttendanceRules } from '../types';
import { ArrowLeft, CheckCircle2, AlertCircle, User, GraduationCap, Award, LogOut, Calendar, Clock, ChevronLeft, ChevronRight, Info, X } from 'lucide-react';
import { formatName } from '../utils/formatters';

interface StudentPortalProps {
  onExit: () => void;
}

const StudentPortal: React.FC<StudentPortalProps> = ({ onExit }) => {
  const [pin, setPin] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [studentClass, setStudentClass] = useState<ClassGroup | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [requirements, setRequirements] = useState<AttendanceRules | null>(null);
  const [massTimes, setMassTimes] = useState<any[]>([]);
  const [scheduledEvents, setScheduledEvents] = useState<any[]>([]);
  const [catechists, setCatechists] = useState<Catechist[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [showHistoryModal, setShowHistoryModal] = useState<'Encontro' | 'Missa' | null>(null);
  const [viewPhotoUrl, setViewPhotoUrl] = useState<string | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{date: Date, hasClass: boolean, classTime: string, masses: any[], events: any[]} | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const allStudents = db.getStudents();
      const parts = birthDate.split('/');
      const formattedQueryDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : birthDate;
      const found = allStudents.find(s => s.pin === pin && s.birthDate === formattedQueryDate);

      if (found) {
        if (found.archived) {
            setError('Este cadastro está arquivado.');
            setLoading(false);
            return;
        }
        const allClasses = db.getClasses();
        const foundClass = allClasses.find(c => c.id === found.classId);
        const allLogs = db.getAttendance().filter(l => l.studentId === found.id);
        const allReqs = db.getRequirements();

        setStudent(found);
        setStudentClass(foundClass || null);
        setLogs(allLogs);
        setRequirements(allReqs[found.sacrament] || { minEncontro: 0, minMissa: 0 });
        setMassTimes(db.getMassTimes());
        setScheduledEvents(db.getScheduledEvents());
        setCatechists(db.getCatechists());
        setIsAuthenticated(true);
      } else {
        setError('PIN ou Data de Nascimento incorretos. Verifique os dados ou contate a secretaria.');
      }
      setLoading(false);
    }, 800);
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

  const isRecess = (dateStr: string, sacrament: string) => {
      const recessPeriods = db.getRecessPeriods();
      return recessPeriods.some(p => {
          if (p.sacrament !== 'TODOS' && p.sacrament !== sacrament) return false;
          return dateStr >= p.startDate && dateStr <= p.endDate;
      });
  };

  const calculateStats = () => {
    if (!student || !studentClass || !requirements) return null;

    const start = new Date(studentClass.startDate + 'T12:00:00');
    const end = new Date(studentClass.endDate + 'T12:00:00');
    const today = new Date();
    const calcLimit = today < end ? today : end;

    // Identificar encontros adicionais / conjuntos da turma
    const attendedEncontroDates = new Set<string>();
    logs.forEach(l => {
      if (l.type === AttendanceType.ENCONTRO) {
        attendedEncontroDates.add(getLogDateStr(l.timestamp));
      }
    });
    try {
      const classStudents = db.getStudents().filter(s => s.classId === studentClass.id);
      const classStudentIds = new Set(classStudents.map(s => s.id));
      db.getAttendance().forEach(l => {
        if (l.type === AttendanceType.ENCONTRO && classStudentIds.has(l.studentId)) {
          attendedEncontroDates.add(getLogDateStr(l.timestamp));
        }
      });
    } catch {
      // fallback
    }

    let expectedEncontros = 0;
    let expectedMissas = 0;
    let totalEncontrosAno = 0;
    let totalMissasAno = 0;

    let cursor = new Date(start);
    while (cursor <= end) {
      const dateStr = cursor.toISOString().split('T')[0];
      const dayOfWeek = cursor.getDay();
      const isRecessDay = isRecess(dateStr, student.sacrament);

      const isStandardEncontroDay = (dayOfWeek === studentClass.meetingDay && !isRecessDay);
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

    const year = new Date(studentClass.startDate).getFullYear();
    const countE = logs.filter(l => l.type === AttendanceType.ENCONTRO && new Date(l.timestamp).getFullYear() === year).length;
    const countM = logs.filter(l => l.type === AttendanceType.MISSA && new Date(l.timestamp).getFullYear() === year).length;

    const effectiveExpectedEncontros = Math.max(expectedEncontros, countE);
    const effectiveExpectedMissas = Math.max(expectedMissas, countM);

    const pctE = effectiveExpectedEncontros > 0 ? Math.round((countE / effectiveExpectedEncontros) * 100) : 0;
    const pctM = effectiveExpectedMissas > 0 ? Math.round((countM / effectiveExpectedMissas) * 100) : 0;

    const maxFaltasEncontro = Math.floor(totalEncontrosAno * (1 - (requirements.minEncontro / 100)));
    const maxFaltasMissa = Math.floor(totalMissasAno * (1 - (requirements.minMissa / 100)));
    
    const faltasEncontroAtual = Math.max(0, effectiveExpectedEncontros - countE);
    const faltasMissaAtual = Math.max(0, effectiveExpectedMissas - countM);

    return { 
      pctE, pctM, 
      countE, expectedEncontros: effectiveExpectedEncontros, 
      countM, expectedMissas: effectiveExpectedMissas, 
      riskE: faltasEncontroAtual > maxFaltasEncontro,
      riskM: faltasMissaAtual > maxFaltasMissa 
    };
  };

  const getDetailedHistory = () => {
      if (!student || !studentClass) return [];
      const history: { date: string, type: string, status: 'PRESENTE' | 'PENDENTE' | 'FALTA' | 'RECESSO', isExpected: boolean, photoUrl?: string }[] = [];
      const start = new Date(studentClass.startDate + 'T12:00:00');
      const end = new Date(studentClass.endDate + 'T12:00:00');
      const today = new Date();
      const limit = today < end ? today : end;

      // Identificar encontros adicionais / conjuntos da turma
      const attendedEncontroDates = new Set<string>();
      logs.forEach(l => {
        if (l.type === AttendanceType.ENCONTRO) {
          attendedEncontroDates.add(getLogDateStr(l.timestamp));
        }
      });
      try {
        const classStudents = db.getStudents().filter(s => s.classId === studentClass.id);
        const classStudentIds = new Set(classStudents.map(s => s.id));
        db.getAttendance().forEach(l => {
          if (l.type === AttendanceType.ENCONTRO && classStudentIds.has(l.studentId)) {
            attendedEncontroDates.add(getLogDateStr(l.timestamp));
          }
        });
      } catch {
        // fallback
      }

      const findMissaLog = (targetDateStr: string) => {
          return logs.find(l => 
              l.type === AttendanceType.MISSA && 
              (l.timestamp.startsWith(targetDateStr) || getLogDateStr(l.timestamp) === targetDateStr)
          );
      };

      const findEncontroLog = (targetDateStr: string) => {
          return logs.find(l => 
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
          const isRecessDay = isRecess(dateStr, student.sacrament);

          const isStandardEncontroDay = (dayOfWeek === studentClass.meetingDay && !isRecessDay);
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
                      photoUrl: encontroLog?.photoUrl
                  });
              }
          }

          // --- Weekend Mass Logic (Sábado + Domingo = Final de Semana) ---
          if (dayOfWeek === 6) {
              const satMissaLog = findMissaLog(dateStr);
              if (satMissaLog) {
                  history.push({
                      date: dateStr,
                      type: 'Missa',
                      status: getLogStatus(satMissaLog),
                      isExpected: true,
                      photoUrl: satMissaLog?.photoUrl
                  });
              }
          } else if (dayOfWeek === 0) {
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
                      photoUrl: sunMissaLog?.photoUrl
                  });
              } else if (!attendedSaturday) {
                  history.push({
                      date: dateStr,
                      type: 'Missa',
                      status: 'FALTA',
                      isExpected: true
                  });
              }
          } else {
              const weekdayMissaLog = findMissaLog(dateStr);
              if (weekdayMissaLog) {
                  history.push({
                      date: dateStr,
                      type: 'Missa',
                      status: getLogStatus(weekdayMissaLog),
                      isExpected: false,
                      photoUrl: weekdayMissaLog?.photoUrl
                  });
              }
          }

          cursor.setDate(cursor.getDate() + 1);
      }

      logs.forEach(log => {
          const logDateStr = getLogDateStr(log.timestamp);
          const alreadyListed = history.find(h => 
              h.date === logDateStr && (h.type === log.type || h.type.startsWith(log.type))
          );
          if (!alreadyListed) {
               history.push({
                   date: logDateStr,
                   type: log.type,
                   status: getLogStatus(log),
                   isExpected: false,
                   photoUrl: log.photoUrl
               });
          }
      });

      return history.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-600 rounded-full blur-3xl"></div>
        </div>

        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl relative z-10 text-slate-900 animate-in fade-in zoom-in duration-300">
          <div className="text-center mb-8">
            <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
                <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
            </div>
            <h1 className="text-2xl font-black text-slate-800">Portal do Catequizando</h1>
            <p className="text-slate-500 text-sm mt-1">Consulte sua frequência</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-6 text-xs font-bold flex items-center border border-red-100 animate-in slide-in-from-top-2">
                <AlertCircle size={18} className="mr-2 flex-shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Seu PIN (3 dígitos)</label>
              <input 
                required
                type="password"
                maxLength={3}
                placeholder="•••"
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-4 outline-none focus:border-blue-600 focus:bg-white transition-all text-center text-3xl font-black tracking-widest placeholder:text-slate-200"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Data de Nascimento</label>
              <input 
                required
                type="text" placeholder="DD/MM/AAAA"
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-4 outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-900 font-bold"
                value={birthDate}
                onChange={(e) => {
                  let val = e.target.value.replace(/\D/g, '');
                  if (val.length > 8) val = val.substring(0, 8);
                  if (val.length >= 5) {
                      val = val.replace(/(\d{2})(\d{2})(\d{1,4})/, '$1/$2/$3');
                  } else if (val.length >= 3) {
                      val = val.replace(/(\d{2})(\d{1,2})/, '$1/$2');
                  }
                  setBirthDate(val);
                }}
              />
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-700/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Consultando...' : 'Acessar Frequência'}
            </button>
          </form>

          <button onClick={onExit} className="mt-8 text-sm text-slate-400 font-bold w-full text-center hover:text-slate-700 transition-colors flex items-center justify-center gap-1">
            <ArrowLeft size={16} /> Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  const stats = calculateStats();
  const sacraments = db.getSystemConfig().sacraments || [];
  const sacramentColor = getSacramentColor(student?.sacrament || '', db.getSystemConfig().sacramentColors, sacraments.indexOf(student?.sacrament || ''));
  const themeColor = sacramentColor.portalTheme;
  const themeBadge = sacramentColor.portalBadge;
  const meetingColor = sacramentColor.portalText;


  const prevMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));

  const getCalendarDays = () => {
    const currentMonth = calendarDate.getMonth();
    const currentYear = calendarDate.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); 

    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
        days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(currentYear, currentMonth, i));
    }
    return days;
  };

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];
  const today = new Date();

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-1.5 rounded-lg flex items-center justify-center">
                 <img src="/logo.png" alt="Logo" className="h-6 w-6 object-contain" />
            </div>
            <span className="text-slate-900 font-black text-lg uppercase tracking-tight">CatedralGest</span>
        </div>
        <button onClick={() => setIsAuthenticated(false)} className="flex items-center text-red-600 font-bold hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors text-sm">
          Sair <LogOut size={16} className="ml-2" />
        </button>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 space-y-6 pb-12">
        {/* Perfil Header Card */}
        <div className={`bg-gradient-to-br ${themeColor} rounded-3xl p-6 shadow-xl text-white relative overflow-hidden`}>
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
             <User size={160} />
          </div>
          <div className="relative z-10 flex items-center gap-4">
             <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/20 flex items-center justify-center">
                <img src="/logo.png" alt="Perfil" className="h-10 w-10 object-contain brightness-0 invert" />
             </div>
             <div>
                <h2 className="text-2xl font-black truncate uppercase tracking-tight">{formatName(student?.name)}</h2>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${themeBadge} uppercase`}>{student?.sacrament}</span>
                    <span className="text-xs font-bold text-white opacity-80">Matrícula: {student?.pin}</span>
                </div>
             </div>
          </div>
        </div>

        {/* Turma / Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Turma Atual</p>
                <div className="flex items-center text-slate-800 font-black truncate">
                    <GraduationCap size={16} className={`mr-2 ${meetingColor}`} />
                    {studentClass?.name || 'Não vinculada'}
                </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Seus Catequistas</p>
                <div className="flex flex-col gap-2">
                    {studentClass?.catechistIds?.length ? studentClass.catechistIds.map(catId => {
                        // We need access to all catechists here. Let's make sure it's available.
                        // Wait, we need the catechists state! I'll add it if it's missing.
                        const cat = catechists.find(c => c.id === catId);
                        if (!cat) return null;
                        return (
                            <a key={cat.id} href={`https://wa.me/55${cat.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center text-slate-700 font-bold hover:text-green-600 transition-colors group">
                                <Award size={14} className={`mr-2 ${meetingColor} flex-shrink-0`} />
                                <span className="text-xs truncate">{cat.name}</span>
                            </a>
                        );
                    }) : (
                        <div className="flex items-center text-slate-500 font-medium text-xs">
                            <Award size={14} className="mr-2 opacity-50" />
                            A definir
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Attendance Bars Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-8">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <CheckCircle2 size={16} className={meetingColor} /> Frequência e Metas
            </h3>

            {/* Encontros */}
            <div onClick={() => setShowHistoryModal('Encontro')} className="space-y-3 cursor-pointer hover:bg-slate-50 p-3 -m-3 rounded-2xl transition-colors group">
                <div className="flex justify-between items-end">
                    <div>
                        <span className="block text-xs font-bold text-slate-500 uppercase">Encontros Semanais</span>
                        <span className={`text-4xl font-black ${stats?.riskE ? 'text-red-600' : 'text-blue-700'}`}>
                            {stats?.pctE}%
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Comparecimento</span>
                        <span className="text-sm font-black text-slate-700">{stats?.countE} de {stats?.expectedEncontros}</span>
                    </div>
                </div>
                <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden border border-slate-200/50">
                    <div className={`h-full transition-all duration-1000 ease-out ${stats?.riskE ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${stats?.pctE}%` }}></div>
                </div>
                <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Meta: {requirements?.minEncontro}%</span>
                    {stats?.riskE && (
                        <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">Abaixo da Meta</span>
                    )}
                </div>
                <div className="text-center pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">Clique para ver o histórico</span>
                </div>
            </div>

            {/* Missas */}
            <div onClick={() => setShowHistoryModal('Missa')} className="space-y-3 cursor-pointer hover:bg-slate-50 p-3 -m-3 rounded-2xl transition-colors group">
                <div className="flex justify-between items-end">
                    <div>
                        <span className="block text-xs font-bold text-slate-500 uppercase">Santa Missa</span>
                        <span className={`text-4xl font-black ${stats?.riskM ? 'text-red-600' : 'text-red-700'}`}>
                            {stats?.pctM}%
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Comparecimento</span>
                        <span className="text-sm font-black text-slate-700">{stats?.countM} de {stats?.expectedMissas}</span>
                    </div>
                </div>
                <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden border border-slate-200/50">
                    <div className={`h-full transition-all duration-1000 ease-out ${stats?.riskM ? 'bg-red-500' : 'bg-red-600'}`} style={{ width: `${stats?.pctM}%` }}></div>
                </div>
                <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Meta: {requirements?.minMissa}%</span>
                    {stats?.riskM && (
                        <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">Abaixo da Meta</span>
                    )}
                </div>
                <div className="text-center pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">Clique para ver o histórico</span>
                </div>
            </div>
        </div>

        {/* Calendar Section */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col gap-3 mb-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Calendar size={16} className={meetingColor} /> Compromissos
                    </h3>
                    <div className="flex items-center gap-2">
                        <button onClick={prevMonth} className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-bold text-slate-700 w-28 text-center uppercase">
                            {monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}
                        </span>
                        <button onClick={nextMonth} className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
                <div className="bg-blue-50 text-blue-800 p-3 rounded-xl border border-blue-100 flex items-start gap-2">
                    <Info size={16} className="mt-0.5 flex-shrink-0" />
                    <p className="text-xs font-medium leading-relaxed">
                        <strong>Missas:</strong> Recomendado o mínimo de 1 participação durante o final de semana.
                    </p>
                </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1">
                {weekDays.map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-black text-slate-400 uppercase py-1">{d}</div>
                ))}
                
                {getCalendarDays().map((date, idx) => {
                    if (!date) return <div key={`empty-${idx}`} className="p-1 rounded-xl bg-transparent"></div>;
                    
                    const dayOfWeek = date.getDay();
                    const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
                    
                    let hasClass = false;
                    let classTime = '';
                    if (studentClass && studentClass.meetingDay === dayOfWeek) {
                        const classStart = new Date(studentClass.startDate + 'T00:00:00');
                        const classEnd = new Date(studentClass.endDate + 'T23:59:59');
                        if (date >= classStart && date <= classEnd) {
                            hasClass = true;
                            classTime = studentClass.meetingTime;
                        }
                    }
                    
                    const dayMasses = massTimes.filter(m => m.dayOfWeek === dayOfWeek).sort((a,b) => a.time.localeCompare(b.time));
                    const hasMass = dayMasses.length > 0;
                    
                    const dayEvents = scheduledEvents.filter(e => {
                        const eDate = new Date(e.startDate);
                        return eDate.getDate() === date.getDate() && 
                               eDate.getMonth() === date.getMonth() && 
                               eDate.getFullYear() === date.getFullYear();
                    }).sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

                    const isSelected = selectedDayEvents?.date.getDate() === date.getDate() && selectedDayEvents?.date.getMonth() === date.getMonth();

                    const handleDayClick = () => {
                        if (hasClass || hasMass || dayEvents.length > 0) {
                            setSelectedDayEvents({
                                date,
                                hasClass,
                                classTime,
                                masses: dayMasses,
                                events: dayEvents
                            });
                        } else {
                            setSelectedDayEvents(null);
                        }
                    };

                    const hasAnyEvent = hasClass || hasMass || dayEvents.length > 0;

                    return (
                        <div 
                            key={idx} 
                            onClick={handleDayClick}
                            className={`p-1 flex flex-col min-h-16 rounded-lg border transition-colors ${
                                isSelected ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-200' :
                                isToday ? 'border-blue-400 bg-blue-50/30' : 
                                'border-slate-100 bg-slate-50'
                            } ${hasAnyEvent ? 'cursor-pointer hover:border-slate-300 hover:bg-slate-100' : ''}`}
                        >
                            <span className={`text-[10px] font-bold text-center mb-1 ${isToday ? 'text-blue-700' : 'text-slate-600'}`}>{date.getDate()}</span>
                            <div className="flex flex-col gap-0.5 px-0.5">
                                {hasClass && <span className={`${sacramentColor.bg} ${sacramentColor.text} text-[8px] font-bold px-1 rounded-[4px] truncate`} title="Encontro da Turma">Encontro</span>}
                                {hasMass && <span className="bg-red-100 text-red-800 text-[8px] font-bold px-1 rounded-[4px] truncate" title="Opção de Missa">Missa</span>}
                                {dayEvents.map((e, i) => (
                                    <span key={i} className="bg-green-100 text-green-800 text-[8px] font-bold px-1 rounded-[4px] truncate" title={e.name}>{e.name}</span>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="mt-4 flex flex-wrap gap-3 px-2">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span><span className="text-[10px] font-bold text-slate-500">Encontro</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span><span className="text-[10px] font-bold text-slate-500">Missa</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500"></span><span className="text-[10px] font-bold text-slate-500">Eventos</span></div>
            </div>

            {selectedDayEvents && (
                <div className="mt-6 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                            <Calendar size={16} className="text-indigo-600" /> 
                            Detalhes: {selectedDayEvents.date.toLocaleDateString('pt-BR')}
                        </h4>
                        <button onClick={() => setSelectedDayEvents(null)} className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full p-1 transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                    
                    <div className="space-y-3">
                        {selectedDayEvents.hasClass && (
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-200/50 p-2 rounded-lg text-blue-700">
                                        <GraduationCap size={18} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-blue-900 text-sm">Encontro da Turma</p>
                                        <p className="text-xs text-blue-700 font-medium">{studentClass?.name}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 text-blue-800 font-bold bg-white px-2 py-1 rounded-md shadow-sm text-sm">
                                    <Clock size={14} />
                                    {selectedDayEvents.classTime}
                                </div>
                            </div>
                        )}

                        {selectedDayEvents.masses.length > 0 && (
                            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="bg-red-200/50 p-2 rounded-lg text-red-700">
                                        <User size={18} />
                                    </div>
                                    <p className="font-bold text-red-900 text-sm">Missas Disponíveis</p>
                                </div>
                                <div className="flex flex-wrap gap-2 ml-11">
                                    {selectedDayEvents.masses.map((m, idx) => (
                                        <span key={idx} className="flex items-center gap-1 text-red-800 font-bold bg-white px-2 py-1 rounded-md shadow-sm border border-red-100/50 text-sm">
                                            <Clock size={14} /> {m.time}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedDayEvents.events.map((e, idx) => {
                            const eStart = new Date(e.startDate);
                            const eEnd = new Date(e.endDate);
                            const formatTime = (d: Date) => d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
                            
                            return (
                                <div key={idx} className="bg-green-50 border border-green-100 rounded-xl p-3 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-green-200/50 p-2 rounded-lg text-green-700">
                                            <Calendar size={18} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-green-900 text-sm">{e.name}</p>
                                            <p className="text-xs text-green-700 font-medium uppercase tracking-wider">{e.type}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-green-800 font-bold bg-white px-2 py-1 rounded-md shadow-sm text-sm">
                                        <Clock size={14} />
                                        {formatTime(eStart)} {eStart.getTime() !== eEnd.getTime() && `- ${formatTime(eEnd)}`}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>

        {/* Month Events List */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Calendar size={16} className="text-green-600" /> Agenda do Crisma
            </h3>
            <div className="space-y-2">
                {scheduledEvents.length > 0 ? (
                    scheduledEvents.sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()).map((e, idx) => {
                        const eStart = new Date(e.startDate);
                        
                        const handleEventClick = () => {
                            // Find matching day logic to open the details modal for this specific day
                            const dayOfWeek = eStart.getDay();
                            
                            let hasClass = false;
                            let classTime = '';
                            if (studentClass && studentClass.meetingDay === dayOfWeek) {
                                const classStart = new Date(studentClass.startDate + 'T00:00:00');
                                const classEnd = new Date(studentClass.endDate + 'T23:59:59');
                                if (eStart >= classStart && eStart <= classEnd) {
                                    hasClass = true;
                                    classTime = studentClass.meetingTime;
                                }
                            }
                            
                            const dayMasses = massTimes.filter(m => m.dayOfWeek === dayOfWeek).sort((a,b) => a.time.localeCompare(b.time));
                            
                            const dayEvents = scheduledEvents.filter(ev => {
                                const evDate = new Date(ev.startDate);
                                return evDate.getDate() === eStart.getDate() && 
                                       evDate.getMonth() === eStart.getMonth() && 
                                       evDate.getFullYear() === eStart.getFullYear();
                            }).sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
                            
                            setSelectedDayEvents({
                                date: eStart,
                                hasClass,
                                classTime,
                                masses: dayMasses,
                                events: dayEvents
                            });
                        };

                        return (
                            <div key={idx} className="bg-slate-50 border border-slate-100 hover:border-green-300 hover:bg-green-50 rounded-xl p-3 flex justify-between items-center transition-colors group">
                                <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={handleEventClick}>
                                    <div className="bg-green-100 p-2 rounded-lg text-green-700">
                                        <Calendar size={16} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{e.name}</p>
                                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{e.type}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className="text-xs font-bold text-slate-700 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100 block">
                                        {eStart.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}
                                    </span>
                                    <a href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.name)}&dates=${eStart.toISOString().replace(/-|:|\.\d\d\d/g, "")}/${eStart.toISOString().replace(/-|:|\.\d\d\d/g, "")}&details=${encodeURIComponent(e.type)}`} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()} className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 uppercase tracking-widest block transition-all">
                                        + Calendário
                                    </a>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-6 text-slate-400 font-medium text-sm">
                        Nenhum evento agendado.
                    </div>
                )}
            </div>
        </div>

        {/* Final Message / Encouragement */}
        <div className={`p-6 rounded-3xl border shadow-sm ${
            stats?.riskE || stats?.riskM
            ? 'bg-amber-50 border-amber-200 text-amber-900' 
            : 'bg-green-50 border-green-200 text-green-900'
        }`}>
            <div className="flex gap-4">
                <div className="p-2 bg-white rounded-xl shadow-sm border border-current opacity-50 flex-shrink-0">
                    {stats?.riskE || stats?.riskM ? <AlertCircle size={24} /> : <Award size={24} />}
                </div>
                <div>
                    <p className="font-black text-sm uppercase tracking-tight">
                        {stats?.riskE || stats?.riskM ? 'Atenção ao Caminho' : 'Tudo em dia!'}
                    </p>
                    <p className="text-xs font-bold opacity-80 mt-1 leading-relaxed">
                        {stats?.riskE || stats?.riskM 
                          ? 'Sua participação está abaixo do recomendado pela coordenação. Lembre-se que a presença é fundamental para sua formação cristã. Procure seu catequista para conversar.' 
                          : 'Parabéns pela sua dedicação! Continue participando ativamente dos encontros e da Santa Missa. Que Deus abençoe sua jornada.'}
                    </p>
                </div>
            </div>
        </div>

        <div className="text-center pt-8">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Catedral Metropolitana Basílica Menor de Sant’Ana</p>
            <p className="text-[9px] text-slate-300 font-bold mt-1">Dados atualizados automaticamente pelo sistema CatedralGest</p>
        </div>
      </main>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/80 flex flex-col justify-end sm:justify-center items-center z-[100] p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95">
                <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="text-lg font-black text-slate-900">
                            Histórico de {showHistoryModal}
                        </h3>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Todos os registros até hoje</p>
                    </div>
                    <button onClick={() => setShowHistoryModal(null)} className="text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="overflow-y-auto p-4 space-y-2 bg-slate-50 flex-1">
                    {getDetailedHistory()
                        .filter(h => h.type === showHistoryModal)
                        .map((h, i) => {
                            const hDate = new Date(h.date + 'T12:00:00');
                            const isPast = hDate.getTime() <= new Date().getTime();
                            if (!isPast && !h.isExpected) return null;
                            if (h.date > new Date().toISOString().split('T')[0]) return null;

                            return (
                                <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 flex justify-between items-center shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg font-bold text-xs ${
                                            h.status === 'PRESENTE' 
                                                ? 'bg-green-100 text-green-700' 
                                                : h.status === 'PENDENTE'
                                                ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                                                : 'bg-red-100 text-red-700'
                                        }`}>
                                            {h.status === 'PRESENTE' ? 'PRESENTE' : h.status === 'PENDENTE' ? 'FOTO ENVIADA (AGUARDANDO VALIDAÇÃO)' : 'FALTA'}
                                        </div>
                                        <div>
                                            <span className="block font-bold text-slate-800 text-sm">{hDate.toLocaleDateString('pt-BR')}</span>
                                            {h.photoUrl && (
                                                <button onClick={(e) => { e.stopPropagation(); setViewPhotoUrl(h.photoUrl); }} className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center mt-1 hover:underline">
                                                    📸 Ver Foto
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    {getDetailedHistory().filter(h => h.type === showHistoryModal && h.date <= new Date().toISOString().split('T')[0]).length === 0 && (
                        <div className="text-center py-6 text-slate-500 text-sm font-medium">Nenhum registro encontrado.</div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Photo Modal */}
      {viewPhotoUrl && (
        <div className="fixed inset-0 bg-slate-900/90 flex items-center justify-center z-[110] p-4 backdrop-blur-md animate-in fade-in zoom-in-95">
            <div className="bg-white rounded-3xl overflow-hidden max-w-sm w-full shadow-2xl relative">
                <button onClick={() => setViewPhotoUrl(null)} className="absolute top-4 right-4 bg-black/50 text-white hover:bg-black p-2 rounded-full backdrop-blur-sm transition-colors z-10">
                    <X size={20} />
                </button>
                <img src={viewPhotoUrl} alt="Foto do Check-in" className="w-full h-auto block" />
            </div>
        </div>
      )}

    </div>
  );
};

export default StudentPortal;
