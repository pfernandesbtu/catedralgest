
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { getSacramentColor } from '../utils/colors';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Users, AlertTriangle, Calendar, FileText, CalendarClock, Clock, X, FileSpreadsheet, Gift, Phone, Camera } from 'lucide-react';
import { AttendanceType, ClassGroup, Student, ScheduledEvent, UserRole, Catechist, SacramentType, RecessPeriod } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatName } from '../utils/formatters';

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({ totalStudents: 0, totalAttendance: 0, studentsAtRisk: 0 });
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<ScheduledEvent[]>([]);
  const [atRiskDetails, setAtRiskDetails] = useState<any[]>([]);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [expandedRiskStudentId, setExpandedRiskStudentId] = useState<string | null>(null);
  const [birthdays, setBirthdays] = useState<{ id: string, name: string, phone?: string, dateObj: Date, isToday: boolean, formattedDate: string, type: string, roleDesc: string }[]>([]);
  const [pendingPhotosCount, setPendingPhotosCount] = useState(0);

  
  // Auth State
  const currentUserStr = localStorage.getItem('currentUser');
  const currentUser: Catechist | null = currentUserStr ? JSON.parse(currentUserStr) : null;
  
  const isCoordinator = currentUser?.role === UserRole.COORDINATOR;
  const hasFullAccess = isCoordinator;

  // Helper to check recess
  const isRecess = (dateStr: string, sacrament: SacramentType, recessPeriods: RecessPeriod[]): boolean => {
      return recessPeriods.some(p => {
          if (p.sacrament !== 'TODOS' && p.sacrament !== sacrament) return false;
          return dateStr >= p.startDate && dateStr <= p.endDate;
      });
  };

  const refreshDashboard = () => {
    // 1. Get Base Data
    let allStudents = db.getStudents();
    let allClasses = db.getClasses();
    let allLogs = db.getAttendance();
    const allEvents = db.getScheduledEvents();
    const allRecess = db.getRecessPeriods();
    const requirements = db.getRequirements();
    const globalStats = db.getStats();

    // Filter archived out by default for dashboard view
    allClasses = allClasses.filter(c => !c.archived);
    allStudents = allStudents.filter(s => !s.archived);

    // 2. Filter if Catechist
    if (!hasFullAccess && currentUser) {
        const myClassIds = allClasses
            .filter(c => c.catechistIds.includes(currentUser.id))
            .map(c => c.id);
        allClasses = allClasses.filter(c => myClassIds.includes(c.id));
        allStudents = allStudents.filter(s => myClassIds.includes(s.classId));
        const myStudentIds = allStudents.map(s => s.id);
        allLogs = allLogs.filter(l => myStudentIds.includes(l.studentId));

        setStats({
            totalStudents: allStudents.length,
            totalAttendance: allLogs.length,
            studentsAtRisk: 0 // Will calculate below
        });
    } else {
        setStats({
            ...globalStats,
            totalStudents: allStudents.length
        });
    }

    setClasses(allClasses);
    setStudents(allStudents);
    setPendingPhotosCount(allLogs.filter(l => l.pendingValidation).length);

    // 3. Calculate Per-Class Performance Data & Risk
    const now = new Date();
    let riskCount = 0;
    let riskList: any[] = [];
    
    // Identify PAST events for calculation denominator
    const pastRetiroEvents = allEvents.filter(e => e.type === AttendanceType.RETIRO && new Date(e.endDate) < now);
    const pastMissaoEvents = allEvents.filter(e => e.type === AttendanceType.MISSAO && new Date(e.endDate) < now);

    const data = allClasses.map(cls => {
        const classStudents = allStudents.filter(s => s.classId === cls.id);
        if (classStudents.length === 0) return null;

        const classStudentIds = classStudents.map(s => s.id);
        const classLogs = allLogs.filter(l => classStudentIds.includes(l.studentId));
        const currentYear = new Date(cls.startDate).getFullYear();
        const yearLogs = classLogs.filter(l => new Date(l.timestamp).getFullYear() === currentYear);

        const attendedEncontroDates = new Set<string>();
        yearLogs.forEach(l => {
            if (l.type === AttendanceType.ENCONTRO) {
                const dateStr = l.timestamp.includes('T') ? l.timestamp.split('T')[0] : l.timestamp;
                attendedEncontroDates.add(dateStr);
            }
        });

        const start = new Date(cls.startDate + 'T12:00:00');
        const end = new Date(cls.endDate + 'T12:00:00');
        const calcLimit = now < end ? now : end;

        let expectedEncontros = 0;
        let expectedMissas = 0;
        let totalEncontrosAno = 0;
        let totalMissasAno = 0;
        let expectedEncontroDates: string[] = [];
        let expectedMissaDates: string[] = [];

        let cursor = new Date(start);
        while (cursor <= end) {
            const dateStr = cursor.toISOString().split('T')[0];
            const dayOfWeek = cursor.getDay();
            const isRecessDay = isRecess(dateStr, cls.sacrament, allRecess);
            
            const isStandardEncontroDay = (dayOfWeek === cls.meetingDay && !isRecessDay);
            const isExtraEncontroDay = attendedEncontroDates.has(dateStr) && !isStandardEncontroDay;

            if (isStandardEncontroDay || isExtraEncontroDay) {
                totalEncontrosAno++;
                if (cursor <= calcLimit && now >= start) {
                    expectedEncontros++;
                    expectedEncontroDates.push(dateStr);
                }
            }
            if (dayOfWeek === 0) {
                totalMissasAno++;
                if (cursor <= calcLimit && now >= start) {
                    expectedMissas++;
                    expectedMissaDates.push(dateStr);
                }
            }
            cursor.setDate(cursor.getDate() + 1);
        }

        const validExpectedEncontros = expectedEncontros;
        const validExpectedMissas = expectedMissas;
        const validExpectedRetiros = pastRetiroEvents.length;
        const validExpectedMissoes = pastMissaoEvents.length;

        const countEncontros = yearLogs.filter(l => l.type === AttendanceType.ENCONTRO).length;
        const countMissas = yearLogs.filter(l => l.type === AttendanceType.MISSA).length;

        let totalStudentRetiroHits = 0;
        let totalStudentMissaoHits = 0;

        // Calculate Risk for each student
        const req = requirements[cls.sacrament] || { minEncontro: 0, minMissa: 0 };
        classStudents.forEach(student => {
             const studentLogs = yearLogs.filter(l => l.studentId === student.id);
             
             const studentEncontroLogs = studentLogs.filter(l => l.type === AttendanceType.ENCONTRO);
             const studentMissaLogs = studentLogs.filter(l => l.type === AttendanceType.MISSA);
             
             const studentEncontros = studentEncontroLogs.length;
             const studentMissas = studentMissaLogs.length;
             
             const effectiveExpectedEncontros = Math.max(validExpectedEncontros, studentEncontros);
             const effectiveExpectedMissas = Math.max(validExpectedMissas, studentMissas);

             const pctEncontro = effectiveExpectedEncontros > 0 ? (studentEncontros / effectiveExpectedEncontros) * 100 : 0;
             const pctMissa = effectiveExpectedMissas > 0 ? (studentMissas / effectiveExpectedMissas) * 100 : 0;

             const maxFaltasEncontro = Math.floor(totalEncontrosAno * (1 - (req.minEncontro / 100)));
             const maxFaltasMissa = Math.floor(totalMissasAno * (1 - (req.minMissa / 100)));
             
             const faltasEncontroAtual = Math.max(0, effectiveExpectedEncontros - studentEncontros);
             const faltasMissaAtual = Math.max(0, effectiveExpectedMissas - studentMissas);

             if (faltasEncontroAtual > maxFaltasEncontro || faltasMissaAtual > maxFaltasMissa) {
                 riskCount++;
                 
                 const studentEncontroDates = studentEncontroLogs.map(l => l.timestamp.split('T')[0]);
                 const missedEncontros = expectedEncontroDates.filter(d => !studentEncontroDates.includes(d));
                 
                 const missedMissas = expectedMissaDates.filter(sundayStr => {
                     const sundayDate = new Date(sundayStr + 'T12:00:00');
                     const saturdayDate = new Date(sundayDate);
                     saturdayDate.setDate(saturdayDate.getDate() - 1);
                     const saturdayStr = saturdayDate.toISOString().split('T')[0];
                     
                     return !studentMissaLogs.some(log => {
                         const logDateStr = log.timestamp.split('T')[0];
                         return logDateStr === sundayStr || logDateStr === saturdayStr;
                     });
                 });

                 riskList.push({
                     student,
                     cls,
                     pctEncontro: Math.round(pctEncontro),
                     pctMissa: Math.round(pctMissa),
                     missedEncontros,
                     missedMissas
                 });
             }

             const retirosAttended = pastRetiroEvents.filter(event => {
                 const s = new Date(event.startDate);
                 const e = new Date(event.endDate);
                 return studentLogs.some(log => log.type === AttendanceType.RETIRO && new Date(log.timestamp) >= s && new Date(log.timestamp) <= e);
             }).length;
             totalStudentRetiroHits += retirosAttended;

             const missoesAttended = pastMissaoEvents.filter(event => {
                const s = new Date(event.startDate);
                const e = new Date(event.endDate);
                return studentLogs.some(log => log.type === AttendanceType.MISSAO && new Date(log.timestamp) >= s && new Date(log.timestamp) <= e);
            }).length;
            totalStudentMissaoHits += missoesAttended;
        });

        const safePct = (actual: number, possible: number, hasOccurred: boolean) => {
             if (!hasOccurred) return 0;
             return Math.round((actual / possible) * 100);
        };

        return {
            name: cls.name.replace(' - ', '\n'),
            Encontros: safePct(countEncontros, validExpectedEncontros * classStudents.length, expectedEncontros > 0),
            Missas: safePct(countMissas, validExpectedMissas * classStudents.length, expectedMissas > 0),
            Retiros: safePct(totalStudentRetiroHits, validExpectedRetiros * classStudents.length, pastRetiroEvents.length > 0),
            Missoes: safePct(totalStudentMissaoHits, validExpectedMissoes * classStudents.length, pastMissaoEvents.length > 0),
            fullObj: cls
        };
    }).filter(item => item !== null);

    setStats(prev => ({...prev, studentsAtRisk: riskCount}));
    setAtRiskDetails(riskList);
    setChartData(data as any[]);

    const activeOrFutureEvents = allEvents.filter(e => new Date(e.endDate) > now);
    activeOrFutureEvents.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    setUpcomingEvents(activeOrFutureEvents.slice(0, 5));

    // Calculate Birthdays
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();
    
    const bdayStudents = db.getStudents().filter(s => !s.archived && s.birthDate);
    const allTeam = db.getCatechists().filter(t => t.birthDate);

    let allowedStudents = bdayStudents;
    let allowedTeam = allTeam;

    if (!hasFullAccess && currentUser?.sacramentSpecialty && currentUser.sacramentSpecialty !== 'Ambos' && currentUser.sacramentSpecialty !== 'Todos') {
        allowedStudents = bdayStudents.filter(s => s.sacrament === currentUser.sacramentSpecialty);
        allowedTeam = allTeam.filter(t => t.role === UserRole.PADRE || t.sacramentSpecialty === currentUser.sacramentSpecialty || t.sacramentSpecialty === 'Todos' || t.sacramentSpecialty === 'Ambos');
    }

    const processedBirthdays: { id: string, name: string, phone?: string, dateObj: Date, month: number, day: number, isToday: boolean, formattedDate: string, type: string, roleDesc: string }[] = [];

    const globalClasses = db.getClasses();

    allowedStudents.forEach(s => {
        const [y, m, d] = s.birthDate!.split('-').map(Number);
        const studentClass = globalClasses.find(c => c.id === s.classId);
        const className = studentClass ? `(${studentClass.name})` : '';
        processedBirthdays.push({
            id: s.id,
            name: s.name,
            phone: s.phone,
            dateObj: new Date(y, m - 1, d),
            month: m - 1,
            day: d,
            isToday: (m - 1) === currentMonth && d === currentDay,
            formattedDate: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
            type: 'student',
            roleDesc: `Catequizando - ${s.sacrament} ${className}`
        });
    });

    allowedTeam.forEach(t => {
        const [y, m, d] = t.birthDate!.split('-').map(Number);
        
        const teamClasses = globalClasses.filter(c => c.catechistIds?.includes(t.id));
        const classNamesStr = teamClasses.length > 0 ? `(${teamClasses.map(c => c.name).join(', ')})` : '';

        let roleDesc = 'Equipe';
        if (t.role === UserRole.PADRE) roleDesc = 'Padre';
        else if (t.role === UserRole.MONITOR) roleDesc = 'Monitor - ' + (t.sacramentSpecialty || 'Geral');
        else if (t.role === UserRole.CATECHIST || t.role === UserRole.COORDINATOR) roleDesc = 'Catequista - ' + (t.sacramentSpecialty || 'Geral');

        if (classNamesStr && t.role !== UserRole.PADRE) {
            roleDesc += ` ${classNamesStr}`;
        }

        processedBirthdays.push({
            id: t.id,
            name: t.name,
            phone: t.phone,
            dateObj: new Date(y, m - 1, d),
            month: m - 1,
            day: d,
            isToday: (m - 1) === currentMonth && d === currentDay,
            formattedDate: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
            type: 'team',
            roleDesc
        });
    });

    const finalBirthdays = processedBirthdays
        .filter(b => b.month === currentMonth && b.day >= currentDay)
        .sort((a, b) => a.day - b.day);

    setBirthdays(finalBirthdays);
  };


  useEffect(() => {
    refreshDashboard();
    const unsubscribe = db.onChange(refreshDashboard);
    return unsubscribe;
  }, []);

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + 
           date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getEventStatus = (start: string, end: string) => {
    const now = new Date();
    const s = new Date(start);
    const e = new Date(end);
    if (now >= s && now <= e) return { label: 'Ativo Agora', color: 'text-green-800 bg-green-100 border-green-300 font-bold' };
    return { label: 'Agendado', color: 'text-blue-800 bg-blue-100 border-blue-300 font-bold' };
  };

  const handleExportRiskPDF = () => {
    const doc = new jsPDF();
    doc.text("Catequizandos Abaixo da Média", 14, 20);
    const tableColumn = ["Turma", "Nome", "Encontros Faltantes", "Missas Faltantes"];
    const tableRows = atRiskDetails.map(item => {
        const missasStr = item.missedMissas.length > 0 ? item.missedMissas.map((d: string) => d.split('-').reverse().join('/')).join(', ') : 'Nenhuma';
        const encontrosStr = item.missedEncontros.length > 0 ? item.missedEncontros.map((d: string) => d.split('-').reverse().join('/')).join(', ') : 'Nenhum';
        return [item.cls.name, formatName(item.student.name), encontrosStr, missasStr];
    });
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 30, headStyles: { fillColor: [220, 38, 38] } });
    doc.save(`Abaixo_da_Media_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportRiskCSV = () => {
    const headers = ['Turma', 'Nome', 'Encontros Faltantes', 'Missas Faltantes'];
    const rows = atRiskDetails.map(item => {
        const missasStr = item.missedMissas.length > 0 ? item.missedMissas.map((d: string) => d.split('-').reverse().join('/')).join(', ') : 'Nenhuma';
        const encontrosStr = item.missedEncontros.length > 0 ? item.missedEncontros.map((d: string) => d.split('-').reverse().join('/')).join(', ') : 'Nenhum';
        return [item.cls.name, formatName(item.student.name), encontrosStr, missasStr];
    });
    let csvContent = "\uFEFF" + headers.join(";") + "\n";
    rows.forEach(row => { csvContent += row.map(i => `"${i}"`).join(";") + "\n"; });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Abaixo_da_Media_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
            <h2 className="text-2xl font-black text-slate-900">Visão Geral</h2>
            <p className="text-slate-600 text-sm font-medium">
                {hasFullAccess ? "Visão global da coordenação" : "Resumo da sua turma"}
            </p>
        </div>
      </div>

      {/* Pending Photos Alert Banner */}
      {pendingPhotosCount > 0 && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-sm flex-shrink-0">
              <Camera size={22} />
            </div>
            <div>
              <p className="font-black text-amber-950 text-sm flex items-center gap-2">
                <span>{pendingPhotosCount} {pendingPhotosCount === 1 ? 'presença por foto aguardando validação' : 'presenças por foto aguardando validação'}</span>
                <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
              </p>
              <p className="text-xs text-amber-800 font-medium mt-0.5">
                Catequizandos com GPS desativado enviaram fotos na igreja. Acesse a aba <strong>Turmas</strong> para revisar e aprovar.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-md border border-slate-300 flex items-center">
          <div className="p-4 bg-blue-100 rounded-xl text-blue-700 mr-4 border border-blue-200">
            <Users size={28} />
          </div>
          <div>
            <p className="text-slate-600 font-bold text-sm uppercase tracking-wide">
                {hasFullAccess ? "Total Catequizandos" : "Seus Catequizandos"}
            </p>
            <p className="text-4xl font-black text-slate-900">{stats.totalStudents}</p>
          </div>
        </div>

        <div 
            className="bg-white p-6 rounded-xl shadow-md border border-slate-300 flex items-center cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => setShowRiskModal(true)}
        >
          <div className="p-4 bg-red-100 rounded-xl text-red-700 mr-4 border border-red-200">
            <AlertTriangle size={28} />
          </div>
          <div>
            <p className="text-slate-600 font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                Abaixo da Média <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-bold">VER LISTA</span>
            </p>
            <p className="text-4xl font-black text-slate-900">{stats.studentsAtRisk}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-slate-300">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center border-b border-slate-100 pb-2">
            <Calendar className="mr-2 w-5 h-5 text-slate-600" />
            Média de Presença por Turma (%)
          </h3>
          <div className="h-80">
            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 600}} interval={0} />
                    <YAxis tickLine={false} axisLine={false} tick={{fill: '#475569', fontSize: 12}} unit="%" />
                    <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#0f172a', fontWeight: 'bold' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="Encontros" fill="#2563eb" radius={[4, 4, 0, 0]} name="Encontros" />
                    <Bar dataKey="Missas" fill="#dc2626" radius={[4, 4, 0, 0]} name="Missas" />
                    <Bar dataKey="Retiros" fill="#16a34a" radius={[4, 4, 0, 0]} name="Retiros" />
                    <Bar dataKey="Missoes" fill="#ea580c" radius={[4, 4, 0, 0]} name="Missões" />
                </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400 font-medium">Sem dados suficientes para o gráfico.</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-md border border-slate-300 overflow-hidden">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center border-b border-slate-100 pb-2">
              <Gift className="mr-2 w-5 h-5 text-slate-600" />
              Aniversariantes do Mês
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {birthdays.length > 0 ? (
                birthdays.map((b, idx) => (
                  <div key={idx} className={`flex items-center justify-between p-4 rounded-lg border ${b.isToday ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-400' : 'bg-slate-50 border-slate-200'}`}>
                    <div>
                      <div className="flex items-center gap-2">
                         <p className="font-bold text-slate-900 text-sm">{formatName(b.name)}</p>
                         {b.isToday && <span className="bg-amber-400 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Hoje</span>}
                      </div>
                      <p className="text-xs text-slate-600 font-medium mt-1">{b.formattedDate} &bull; {b.roleDesc}</p>
                    </div>
                    {b.phone && (
                        <a 
                            href={`https://wa.me/55${b.phone.replace(/\D/g, '')}?text=Olá ${formatName(b.name).split(' ')[0]}! Gostaria de te desejar um feliz e Santo Aniversário! Que Deus te abençoe!`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors border border-green-200 flex-shrink-0"
                            title="Parabenizar no WhatsApp"
                        >
                            <Phone size={16} />
                        </a>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-500 font-medium text-sm">
                  Nenhum aniversariante neste mês.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md border border-slate-300">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center border-b border-slate-100 pb-2">
              <CalendarClock className="mr-2 w-5 h-5 text-slate-600" />
              Próximos Eventos Gerais
            </h3>
            <div className="space-y-3">
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map(event => {
                  const status = getEventStatus(event.startDate, event.endDate);
                  return (
                    <div key={event.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{event.name}</p>
                        <div className="flex items-center text-xs text-slate-600 font-medium mt-1">
                          <Clock size={14} className="mr-1 text-slate-400" />
                          {formatEventDate(event.startDate)}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs border ${status.color}`}>{status.label}</span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-500 font-medium text-sm">Nenhum evento agendado.</div>
              )}
            </div>
          </div>

        </div>
      </div>

      {showRiskModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <div>
                  <h2 className="text-xl font-black text-slate-900 flex items-center">
                    <AlertTriangle className="mr-2 text-red-600" />
                    Catequizandos Abaixo da Média
                  </h2>
                  <p className="text-sm text-slate-500 font-medium mt-1">Lista de catequizandos em risco de reprovação por faltas.</p>
              </div>
              <div className="flex items-center gap-3">
                  <button onClick={handleExportRiskCSV} className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold transition-colors text-sm shadow-sm">
                      <FileSpreadsheet size={16} className="mr-2" /> Excel
                  </button>
                  <button onClick={handleExportRiskPDF} className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold transition-colors text-sm shadow-sm">
                      <FileText size={16} className="mr-2" /> PDF
                  </button>
                  <button onClick={() => setShowRiskModal(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors ml-2">
                    <X size={20} />
                  </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
              {atRiskDetails.length > 0 ? (
                  <div className="space-y-4">
                      {atRiskDetails.map((item, idx) => {
                          const isExpanded = expandedRiskStudentId === item.student.id;
                          return (
                          <div 
                              key={idx} 
                              className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-4 cursor-pointer hover:border-slate-300 transition-colors"
                              onClick={() => setExpandedRiskStudentId(isExpanded ? null : item.student.id)}
                          >
                              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                                  <div className="flex-1">
                                      <h3 className="font-bold text-slate-900">{formatName(item.student.name)}</h3>
                                      <p className="text-sm text-slate-500 font-medium">{item.cls.name}</p>
                                  </div>
                                  <div className="flex flex-row gap-4 w-full md:w-auto">
                                      <div className="bg-orange-50 border border-orange-100 px-4 py-2 rounded-lg flex-1 md:w-auto text-center">
                                          <p className="text-[10px] font-black text-orange-800 uppercase mb-0.5">Missas</p>
                                          <p className="text-sm text-orange-900 font-bold">{item.missedMissas.length > 0 ? `${item.missedMissas.length} faltas` : 'Nenhuma'}</p>
                                      </div>
                                      <div className="bg-red-50 border border-red-100 px-4 py-2 rounded-lg flex-1 md:w-auto text-center">
                                          <p className="text-[10px] font-black text-red-800 uppercase mb-0.5">Encontros</p>
                                          <p className="text-sm text-red-900 font-bold">{item.missedEncontros.length > 0 ? `${item.missedEncontros.length} faltas` : 'Nenhuma'}</p>
                                      </div>
                                  </div>
                              </div>
                              {isExpanded && (
                                  <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
                                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                          <h4 className="text-xs font-black text-orange-800 mb-2 uppercase">Datas das Missas Faltantes</h4>
                                          {item.missedMissas.length > 0 ? (
                                              <ul className="list-disc list-inside text-sm text-slate-600 font-medium grid grid-cols-2 gap-1">
                                                  {item.missedMissas.map((d: string, i: number) => <li key={i}>{d.split('-').reverse().join('/')}</li>)}
                                              </ul>
                                          ) : (
                                              <p className="text-sm text-slate-500 font-medium">Nenhuma falta.</p>
                                          )}
                                      </div>
                                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                          <h4 className="text-xs font-black text-red-800 mb-2 uppercase">Datas dos Encontros Faltantes</h4>
                                          {item.missedEncontros.length > 0 ? (
                                              <ul className="list-disc list-inside text-sm text-slate-600 font-medium grid grid-cols-2 gap-1">
                                                  {item.missedEncontros.map((d: string, i: number) => <li key={i}>{d.split('-').reverse().join('/')}</li>)}
                                              </ul>
                                          ) : (
                                              <p className="text-sm text-slate-500 font-medium">Nenhuma falta.</p>
                                          )}
                                      </div>
                                  </div>
                              )}
                          </div>
                      )})}
                  </div>
              ) : (
                  <div className="text-center py-12 text-slate-500 font-medium">
                      Nenhum catequizando abaixo da média no momento.
                  </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end">
                <button onClick={() => setShowRiskModal(false)} className="px-6 py-2.5 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition-colors">
                    Fechar
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
