
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Save, RefreshCw, Trash2, Download, Database, Clock, Plus, Target, CheckCircle2, CalendarOff, MapPin, Settings as SettingsIcon, Timer } from 'lucide-react';
import { MassTime, SacramentType, AttendanceRules, RecessPeriod, LocationConfig, SystemConfig } from '../types';
import { SACRAMENT_COLORS, getSacramentColor } from '../utils/colors';
import { ConfirmModal, ConfirmDialogState } from './ConfirmModal';

const Settings: React.FC = () => {
  const [massTimes, setMassTimes] = useState<MassTime[]>([]);
  const [requirements, setRequirements] = useState<Record<SacramentType, AttendanceRules>>({
    
    ['Crisma']: { minEncontro: 0, minMissa: 0 }
  });
  const [recessPeriods, setRecessPeriods] = useState<RecessPeriod[]>([]);
  const [locationConfig, setLocationConfig] = useState<LocationConfig>({ latitude: 0, longitude: 0, radiusMeters: 200, active: true });
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({ registrationEnabled: true, sacraments: [] });
  const [newSacrament, setNewSacrament] = useState('');

  // Duration Settings
  const [massDuration, setMassDuration] = useState<number>(60);
  const [meetingDuration, setMeetingDuration] = useState<number>(60);
  const [newMassDuration, setNewMassDuration] = useState<number>(60);
  const [showSaveDurationsSuccess, setShowSaveDurationsSuccess] = useState(false);
  
  // New Mass Form
  const [newDay, setNewDay] = useState<number>(0);
  const [newTime, setNewTime] = useState<string>('08:00');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ isOpen: false, message: '', onConfirm: () => {} });

  const requestConfirm = (message: string, onConfirm: () => void, isDestructive = true, confirmButtonText = 'Confirmar') => {
      setConfirmDialog({
          isOpen: true,
          message,
          onConfirm: () => {
              onConfirm();
          },
          isDestructive,
          confirmButtonText
      });
  };

  
  // New Recess Form
  const [recessName, setRecessName] = useState('');
  const [recessSacrament, setRecessSacrament] = useState<SacramentType | 'TODOS'>('TODOS');
  const [recessStart, setRecessStart] = useState('');
  const [recessEnd, setRecessEnd] = useState('');

  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  useEffect(() => {
    refreshData();
    const unsubscribe = db.onChange(refreshData);
    return unsubscribe;
  }, []);

  const refreshData = () => {
    setMassTimes(db.getMassTimes());
    setRequirements(db.getRequirements());
    setRecessPeriods(db.getRecessPeriods());
    setLocationConfig(db.getLocationConfig());
    const sys = db.getSystemConfig();
    setSystemConfig(sys);
    setMassDuration(sys.massDurationMinutes ?? 60);
    setMeetingDuration(sys.meetingDurationMinutes ?? 60);
    setNewMassDuration(sys.massDurationMinutes ?? 60);
  };

  const calcEndTime = (startTime: string, durationMin: number) => {
    const [h, m] = startTime.split(':').map(Number);
    const totalMin = h * 60 + m + durationMin;
    const endH = Math.floor((totalMin % 1440) / 60);
    const endM = totalMin % 60;
    const pad = (n: number) => n < 10 ? '0' + n : n;
    return `${pad(endH)}:${pad(endM)}`;
  };

  const calcCheckInWindow = (startTime: string, durationMin: number) => {
    const [h, m] = startTime.split(':').map(Number);
    const startMin = h * 60 + m - 30;
    const endMin = h * 60 + m + durationMin + 30;
    const pad = (n: number) => n < 10 ? '0' + n : n;
    const openH = Math.floor(((startMin + 1440) % 1440) / 60);
    const openM = (startMin + 1440) % 60;
    const closeH = Math.floor(((endMin + 1440) % 1440) / 60);
    const closeM = (endMin + 1440) % 60;
    return `${pad(openH)}:${pad(openM)} até ${pad(closeH)}:${pad(closeM)}`;
  };

  const handleSaveDurations = () => {
    requestConfirm('Deseja salvar a duração configurada para Missas e Encontros?', () => {
      const updatedConfig = {
        ...systemConfig,
        massDurationMinutes: massDuration,
        meetingDurationMinutes: meetingDuration
      };
      setSystemConfig(updatedConfig);
      db.saveSystemConfig(updatedConfig);
      setShowSaveDurationsSuccess(true);
      setTimeout(() => setShowSaveDurationsSuccess(false), 3000);
    }, false, 'Salvar');
  };

  const handleReset = () => {
    requestConfirm('ATENÇÃO: Isso apagará TODOS os dados (catequizandos, turmas, presenças) e restaurará os dados de exemplo. Essa ação não pode ser desfeita. Tem certeza?', () => {
        db.resetDatabase();
        window.location.reload();
    }, true, 'Sim, apagar tudo');
  };


  const handleExport = () => {
    requestConfirm('Deseja baixar o arquivo de backup com todos os dados do sistema?', () => {
        const data = db.getFullState();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_catedralgest_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, false, 'Baixar');
  };


  const handleAddMass = () => {
    const newMass: MassTime = {
      id: Math.random().toString(36).substr(2, 9),
      dayOfWeek: newDay,
      time: newTime,
      durationMinutes: newMassDuration || massDuration || 60
    };
    db.addMassTime(newMass);
    refreshData();
  };

  const handleDeleteMass = (id: string) => {
    requestConfirm('Deseja realmente remover este horário de missa?', () => {
        db.deleteMassTime(id);
        refreshData();
    }, true, 'Remover');
  };


  const handleAddRecess = (e: React.FormEvent) => {
      e.preventDefault();
      if(!recessName || !recessStart || !recessEnd) return;
      if (recessStart > recessEnd) {
          alert("Data final deve ser após data inicial");
          return;
      }
      const newRecess: RecessPeriod = {
          id: Math.random().toString(36).substr(2, 9),
          name: recessName,
          sacrament: recessSacrament,
          startDate: recessStart,
          endDate: recessEnd
      };
      db.addRecessPeriod(newRecess);
      setRecessName('');
      setRecessStart('');
      setRecessEnd('');
      refreshData();
  };

  const handleDeleteRecess = (id: string) => {
      requestConfirm('Deseja realmente remover este recesso?', () => {
          db.deleteRecessPeriod(id);
          refreshData();
      }, true, 'Remover');
  };


  const handleSaveRequirements = () => {
    requestConfirm('Deseja salvar os Critérios de Aprovação?', () => {
        db.saveRequirements(requirements);
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 3000);
    }, false, 'Salvar');
  };


  const handleSaveLocation = () => {
      requestConfirm('Deseja salvar as configurações de Localização?', () => {
          db.saveLocationConfig(locationConfig);
          setShowSaveSuccess(true);
          setTimeout(() => setShowSaveSuccess(false), 3000);
      }, false, 'Salvar');
  };


  const handleSaveSystem = () => {
      requestConfirm('Deseja salvar as Configurações do Sistema?', () => {
          db.saveSystemConfig(systemConfig);
          setShowSaveSuccess(true);
          setTimeout(() => setShowSaveSuccess(false), 3000);
      }, false, 'Salvar');
  };


  const handleAddSacrament = () => {
      if (!newSacrament.trim()) return;
      requestConfirm(`Deseja adicionar o sacramento "${newSacrament.trim()}"?`, () => {
          const current = systemConfig.sacraments;
          if (!current.includes(newSacrament.trim())) {
              const updated = [...current, newSacrament.trim()];
              const newSystemConfig = { ...systemConfig, sacraments: updated };
              setSystemConfig(newSystemConfig);
              db.saveSystemConfig(newSystemConfig);
          }
          setNewSacrament('');
      }, false, 'Adicionar');
  };


  const handleRemoveSacrament = (sac: string) => {
      requestConfirm(`Deseja realmente remover o sacramento "${sac}"? Isso pode afetar turmas e catequizandos cadastrados.`, () => {
          const current = systemConfig.sacraments;
          const updated = current.filter(s => s !== sac);
          const newSystemConfig = { ...systemConfig, sacraments: updated };
          setSystemConfig(newSystemConfig);
          db.saveSystemConfig(newSystemConfig);
      }, true, 'Remover');
  };


  const updateRequirement = (sacrament: SacramentType, field: keyof AttendanceRules, value: string) => {
    const numValue = Math.min(100, Math.max(0, Number(value)));
    setRequirements(prev => ({
      ...prev,
      [sacrament]: {
        ...(prev[sacrament] || { minEncontro: 0, minMissa: 0 }),
        [field]: numValue
      }
    }));
  };

  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-slate-900">Configurações do Sistema</h2>
        <p className="text-slate-600 font-medium">Gerenciamento de dados e preferências</p>
      </div>

      <div className="space-y-6">

        {/* Location Configuration */}
        <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700 border border-indigo-200">
                        <MapPin size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Geolocalização da Igreja</h3>
                        <p className="text-sm text-slate-600 font-medium">Para check-in presencial via celular dos catequizandos.</p>
                    </div>
                </div>
                {showSaveSuccess && (
                    <span className="flex items-center text-green-700 font-bold text-sm animate-pulse">
                        <CheckCircle2 size={16} className="mr-1" /> Salvo!
                    </span>
                )}
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Latitude</label>
                    <input 
                        type="number" step="0.000001"
                        value={locationConfig.latitude}
                        onChange={(e) => setLocationConfig({...locationConfig, latitude: Number(e.target.value)})}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Longitude</label>
                    <input 
                        type="number" step="0.000001"
                        value={locationConfig.longitude}
                        onChange={(e) => setLocationConfig({...locationConfig, longitude: Number(e.target.value)})}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Raio Permitido (metros)</label>
                    <input 
                        type="number" 
                        value={locationConfig.radiusMeters}
                        onChange={(e) => setLocationConfig({...locationConfig, radiusMeters: Number(e.target.value)})}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="col-span-1 md:col-span-3 flex justify-between items-start">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center">
                            <input 
                                type="checkbox" 
                                id="gpsActive"
                                checked={locationConfig.active}
                                onChange={(e) => setLocationConfig({...locationConfig, active: e.target.checked})}
                                className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                            <label htmlFor="gpsActive" className="ml-2 text-sm font-bold text-slate-700">Ativar Restrição de GPS (Geral)</label>
                        </div>
                        <div className="flex items-center">
                            <input 
                                type="checkbox" 
                                id="gpsEvents"
                                checked={locationConfig.requireForEvents !== false}
                                onChange={(e) => setLocationConfig({...locationConfig, requireForEvents: e.target.checked})}
                                className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                disabled={!locationConfig.active}
                            />
                            <label htmlFor="gpsEvents" className={`ml-2 text-sm font-bold ${locationConfig.active ? 'text-slate-700' : 'text-slate-400'}`}>
                                Exigir GPS para Eventos (Retiros, Missões, Reuniões)
                            </label>
                        </div>
                    </div>
                    <button 
                        onClick={handleSaveLocation}
                        className="flex items-center px-6 py-2 bg-indigo-700 text-white rounded-lg hover:bg-indigo-800 font-bold transition-colors shadow-sm self-start mt-2"
                    >
                        <Save size={18} className="mr-2" />
                        Salvar Localização
                    </button>
                </div>
            </div>
        </div>

        {/* System Config */}
        <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden mt-6">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-teal-100 p-2 rounded-lg text-teal-700 border border-teal-200">
                        <SettingsIcon size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Configurações do Sistema</h3>
                        <p className="text-sm text-slate-600 font-medium">Ativar ou desativar módulos do sistema.</p>
                    </div>
                </div>
            </div>
            <div className="p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <input 
                            type="checkbox" 
                            id="registrationEnabled"
                            checked={systemConfig.registrationEnabled}
                            onChange={(e) => setSystemConfig({...systemConfig, registrationEnabled: e.target.checked})}
                            className="w-5 h-5 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                        />
                        <label htmlFor="registrationEnabled" className="ml-3 text-base font-bold text-slate-700">Ativar Módulo de Inscrição Aberta</label>
                    </div>
                    <button 
                        onClick={handleSaveSystem}
                        className="flex items-center px-6 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 font-bold transition-colors shadow-sm"
                    >
                        <Save size={18} className="mr-2" />
                        Salvar Sistema
                    </button>
                </div>
            </div>
        </div>

        {/* Sacraments Management */}
        <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
           <div className="p-6 border-b border-slate-200 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-2 rounded-lg text-orange-700 border border-orange-200">
                    <CheckCircle2 size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900">Gerenciamento de Sacramentos</h3>
                    <p className="text-sm text-slate-600 font-medium">Sacramentos ofertados pela paróquia.</p>
                </div>
             </div>
          </div>
          <div className="p-6">
              <div className="flex gap-4 mb-6">
                  <input 
                      type="text"
                      className="flex-1 bg-white border border-slate-400 rounded-lg px-4 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-orange-600 focus:border-orange-600"
                      placeholder="Novo Sacramento (ex: Catequese Infantil)"
                      value={newSacrament}
                      onChange={e => setNewSacrament(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddSacrament(); }}
                  />
                  <button 
                      onClick={handleAddSacrament}
                      className="px-6 py-2 bg-orange-700 text-white rounded-lg hover:bg-orange-800 font-bold flex items-center shadow-sm"
                  >
                      <Plus size={18} className="mr-2" /> Adicionar
                  </button>
              </div>
              
              <div className="space-y-2">
                  {systemConfig.sacraments.map((sac, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 rounded-lg bg-slate-50 hover:bg-white transition-colors shadow-sm gap-4">
                          <div className="flex items-center gap-3">
                              <span className={`w-4 h-4 rounded-full ${getSacramentColor(sac, systemConfig.sacramentColors, idx).bg} ring-2 ring-offset-2 ring-transparent`}></span>
                              <span className="font-bold text-slate-900 text-lg">{sac}</span>
                          </div>
                          <div className="flex items-center gap-4">
                              <select 
                                  value={systemConfig.sacramentColors?.[sac] || SACRAMENT_COLORS[idx % SACRAMENT_COLORS.length].id}
                                  onChange={(e) => {
                                      const newConfig = {
                                          ...systemConfig,
                                          sacramentColors: {
                                              ...(systemConfig.sacramentColors || {}),
                                              [sac]: e.target.value
                                          }
                                      };
                                      setSystemConfig(newConfig);
                                      db.saveSystemConfig(newConfig);
                                  }}
                                  className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-orange-600 outline-none bg-white font-medium"
                              >
                                  {SACRAMENT_COLORS.map(c => (
                                      <option key={c.id} value={c.id}>{c.label}</option>
                                  ))}
                              </select>
                              <button 
                                  onClick={() => handleRemoveSacrament(sac)}
                                  className="text-slate-400 hover:text-red-600 p-2 bg-white rounded-full border border-slate-200 hover:border-red-200 shadow-sm"
                                  title="Remover"
                              >
                                  <Trash2 size={18} />
                              </button>
                          </div>
                      </div>

                  ))}
                  {systemConfig.sacraments.length === 0 && (
                      <p className="text-slate-500 font-medium text-center py-4">Nenhum sacramento cadastrado.</p>
                  )}
              </div>
          </div>
        </div>

        {/* Requirements Configuration */}
        <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
           <div className="p-6 border-b border-slate-200 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-lg text-green-700 border border-green-200">
                    <Target size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900">Critérios de Aprovação</h3>
                    <p className="text-sm text-slate-600 font-medium">Defina a porcentagem mínima de presença para cada sacramento.</p>
                </div>
             </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {systemConfig.sacraments.map((sac, idx) => {
                const colors = ['blue', 'purple', 'green', 'amber', 'rose', 'indigo'];
                const color = colors[idx % colors.length];
                const rules = requirements[sac] || { minEncontro: 0, minMissa: 0 };
                
                return (
                    <div key={sac} className={`bg-slate-50 rounded-xl p-5 border border-slate-200`}>
                        <h4 className={`font-black text-slate-800 mb-4 text-lg`}>{sac}</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Mínimo em Encontros (%)</label>
                                <div className="flex items-center">
                                    <input 
                                        type="number" 
                                        min="0" max="100"
                                        value={rules.minEncontro}
                                        onChange={(e) => updateRequirement(sac, 'minEncontro', e.target.value)}
                                        className="w-24 bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <span className="ml-2 text-slate-500 font-medium">% de presença</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Mínimo em Missas (%)</label>
                                <div className="flex items-center">
                                    <input 
                                        type="number" 
                                        min="0" max="100"
                                        value={rules.minMissa}
                                        onChange={(e) => updateRequirement(sac, 'minMissa', e.target.value)}
                                        className="w-24 bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <span className="ml-2 text-slate-500 font-medium">% de presença</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
            
            <div className="col-span-1 md:col-span-2 flex justify-end">
                <button 
                  onClick={handleSaveRequirements}
                  className="flex items-center px-6 py-3 bg-blue-700 text-white rounded-xl hover:bg-blue-800 font-bold transition-colors shadow-lg shadow-blue-700/20"
                >
                    <Save size={18} className="mr-2" />
                    Salvar Critérios
                </button>
            </div>
          </div>
        </div>

        {/* Recess/Holiday Configuration */}
        <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
             <div className="p-6 border-b border-slate-200 flex items-center gap-3">
             <div className="bg-orange-100 p-2 rounded-lg text-orange-700 border border-orange-200">
                <CalendarOff size={20} />
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-900">Períodos de Recesso</h3>
                <p className="text-sm text-slate-600 font-medium">Dias que não contam falta (Férias, Feriados)</p>
             </div>
          </div>
          <div className="p-6">
              <form onSubmit={handleAddRecess} className="flex flex-wrap items-end gap-4 mb-6 bg-slate-100 p-4 rounded-lg border border-slate-200">
                  <div className="flex-1 min-w-[150px]">
                      <label className="block text-sm font-bold text-slate-800 mb-1">Nome do Evento</label>
                      <input 
                        required
                        placeholder="Ex: Férias de Julho"
                        className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                        value={recessName}
                        onChange={e => setRecessName(e.target.value)}
                      />
                  </div>
                   <div className="min-w-[120px]">
                      <label className="block text-sm font-bold text-slate-800 mb-1">Sacramento</label>
                      <select
                        className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                        value={recessSacrament}
                        onChange={e => setRecessSacrament(e.target.value as any)}
                      >
                          <option value="TODOS">Todos</option>
                          {systemConfig.sacraments.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                  </div>
                  <div className="min-w-[140px]">
                      <label className="block text-sm font-bold text-slate-800 mb-1">Data Início</label>
                      <input 
                        required
                        type="date"
                        className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                        value={recessStart}
                        onChange={e => setRecessStart(e.target.value)}
                      />
                  </div>
                  <div className="min-w-[140px]">
                      <label className="block text-sm font-bold text-slate-800 mb-1">Data Fim</label>
                      <input 
                        required
                        type="date"
                        className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                        value={recessEnd}
                        onChange={e => setRecessEnd(e.target.value)}
                      />
                  </div>
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-bold flex items-center h-[46px] shadow-sm"
                  >
                    <Plus size={18} className="mr-2" /> Adicionar
                  </button>
              </form>

              <div className="space-y-2">
                  {recessPeriods.length === 0 && (
                       <p className="text-slate-500 font-medium text-center py-4">Nenhum período de recesso cadastrado.</p>
                  )}
                  {recessPeriods.map(recess => (
                      <div key={recess.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors shadow-sm">
                           <div>
                               <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-slate-900">{recess.name}</span>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded border bg-slate-100 text-slate-600 border-slate-200">
                                        {recess.sacrament}
                                    </span>
                               </div>
                               <div className="text-xs text-slate-500 font-medium flex items-center">
                                    <Clock size={12} className="mr-1"/>
                                    {new Date(recess.startDate + 'T12:00:00').toLocaleDateString('pt-BR')} até {new Date(recess.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                               </div>
                           </div>
                           <button 
                                onClick={() => handleDeleteRecess(recess.id)}
                                className="text-slate-400 hover:text-red-600 p-2"
                           >
                                <Trash2 size={18} />
                           </button>
                      </div>
                  ))}
              </div>
          </div>
        </div>

        {/* Activity Durations Configuration Section */}
        <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 p-2 rounded-lg text-amber-700 border border-amber-200">
                <Timer size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Duração das Atividades & Tolerância de Check-in</h3>
                <p className="text-sm text-slate-600 font-medium">Configure a duração padrão de Missas e Encontros de Catequese para o cálculo da janela de check-in.</p>
              </div>
            </div>
            {showSaveDurationsSuccess && (
              <span className="inline-flex items-center text-green-700 font-bold text-sm bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 animate-pulse">
                <CheckCircle2 size={16} className="mr-1.5" /> Durações salvas!
              </span>
            )}
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mass Duration */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-bold text-slate-800">Duração Padrão da Missa</label>
                  <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-200">
                    {massDuration} min ({Math.floor(massDuration / 60)}h{massDuration % 60 ? ` ${massDuration % 60}m` : ''})
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mb-3">Tempo médio da celebração da missa.</p>
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="number"
                    min="15"
                    max="240"
                    step="5"
                    value={massDuration}
                    onChange={e => setMassDuration(Math.max(1, Number(e.target.value)))}
                    className="w-28 bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold text-base focus:ring-2 focus:ring-purple-600 outline-none"
                  />
                  <span className="text-sm font-bold text-slate-600">minutos</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[45, 60, 75, 90, 120].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setMassDuration(mins)}
                      className={`text-xs px-2.5 py-1 rounded-md font-bold transition-colors border ${
                        massDuration === mins
                          ? 'bg-purple-700 text-white border-purple-700'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Meeting Duration */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-bold text-slate-800">Duração dos Encontros</label>
                  <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full border border-blue-200">
                    {meetingDuration} min ({Math.floor(meetingDuration / 60)}h{meetingDuration % 60 ? ` ${meetingDuration % 60}m` : ''})
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mb-3">Tempo de duração das aulas da catequese.</p>
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="number"
                    min="15"
                    max="240"
                    step="5"
                    value={meetingDuration}
                    onChange={e => setMeetingDuration(Math.max(1, Number(e.target.value)))}
                    className="w-28 bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold text-base focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                  <span className="text-sm font-bold text-slate-600">minutos</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[45, 60, 90, 120].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setMeetingDuration(mins)}
                      className={`text-xs px-2.5 py-1 rounded-md font-bold transition-colors border ${
                        meetingDuration === mins
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-900 font-medium flex items-start gap-3">
              <Clock size={18} className="text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Como funciona o prazo de tolerância:</strong>
                <p className="mt-1">
                  O Totem libera o botão de presença <strong>30 minutos antes do início</strong> e permanece liberado durante toda a duração da atividade mais <strong>30 minutos após o término</strong> calculado (Início + Duração + 30 min).
                </p>
                <p className="mt-1 text-slate-600">
                  <em>Exemplo: Missa das 19:00 com 60min de duração encerra às 20:00. O check-in fica disponível das 18:30 até às 20:30.</em>
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveDurations}
                className="flex items-center px-6 py-2.5 bg-amber-700 text-white rounded-lg hover:bg-amber-800 font-bold transition-colors shadow-sm"
              >
                <Save size={18} className="mr-2" />
                Salvar Configuração de Duração
              </button>
            </div>
          </div>
        </div>

        {/* Mass Configuration Section */}
        <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
           <div className="p-6 border-b border-slate-200 flex items-center gap-3">
             <div className="bg-purple-100 p-2 rounded-lg text-purple-700 border border-purple-200">
                <Clock size={20} />
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-900">Horários de Missa (Padrão)</h3>
                <p className="text-sm text-slate-600 font-medium">Defina os horários semanais fixos e a duração de cada celebração.</p>
             </div>
          </div>

          <div className="p-6">
            {/* Add New */}
            <div className="flex flex-wrap items-end gap-4 mb-6 bg-slate-100 p-4 rounded-lg border border-slate-200">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-sm font-bold text-slate-800 mb-1">Dia da Semana</label>
                <select 
                  className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  value={newDay}
                  onChange={e => setNewDay(Number(e.target.value))}
                >
                  {days.map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[110px]">
                <label className="block text-sm font-bold text-slate-800 mb-1">Início</label>
                <input 
                  type="time" 
                  className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[130px]">
                <label className="block text-sm font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <Timer size={14} className="text-purple-700" /> Duração (min)
                </label>
                <input 
                  type="number"
                  min="15"
                  step="5"
                  className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-purple-600 focus:border-purple-600"
                  value={newMassDuration}
                  onChange={e => setNewMassDuration(Math.max(1, Number(e.target.value)))}
                />
              </div>
              <button 
                onClick={handleAddMass}
                className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-bold flex items-center h-[46px] shadow-sm"
              >
                <Plus size={18} className="mr-2" /> Adicionar
              </button>
            </div>

            {/* List */}
            <div className="space-y-2">
              {massTimes.sort((a,b) => {
                 if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
                 return a.time.localeCompare(b.time);
              }).map(mass => {
                const currentDuration = mass.durationMinutes || massDuration || 60;
                return (
                  <div key={mass.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors shadow-sm gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-bold text-slate-900 w-24">{days[mass.dayOfWeek]}</span>
                      <span className="font-mono bg-purple-50 border border-purple-200 px-2.5 py-1 rounded text-purple-900 font-bold">
                        {mass.time}
                      </span>
                      <span className="text-xs bg-slate-100 border border-slate-200 text-slate-700 font-bold px-2 py-1 rounded flex items-center gap-1">
                        <Timer size={12} className="text-purple-600" /> {currentDuration} min (~{calcEndTime(mass.time, currentDuration)})
                      </span>
                      <span className="text-xs text-slate-500 font-medium hidden md:inline">
                        (Check-in: {calcCheckInWindow(mass.time, currentDuration)})
                      </span>
                    </div>
                    <button 
                      onClick={() => handleDeleteMass(mass.id)}
                      className="text-slate-400 hover:text-red-600 p-2 self-end sm:self-center hover:bg-red-50 rounded-lg transition-colors"
                      title="Remover horário de missa"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
              {massTimes.length === 0 && (
                <p className="text-slate-500 font-medium text-center py-4">Nenhum horário configurado.</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Data Management Section */}
        <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center gap-3">
             <div className="bg-blue-100 p-2 rounded-lg text-blue-700 border border-blue-200">
                <Database size={20} />
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-900">Gerenciamento de Dados</h3>
                <p className="text-sm text-slate-600 font-medium">Backup e restauração do sistema</p>
             </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                    <h4 className="font-bold text-slate-800">Exportar Backup</h4>
                    <p className="text-sm text-slate-600">Baixe um arquivo JSON com todos os Catequizandos, turmas e presenças.</p>
                </div>
                <button 
                  onClick={handleExport}
                  className="flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-bold transition-colors shadow-sm"
                >
                    <Download size={18} className="mr-2" />
                    Baixar Dados
                </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                <div>
                    <h4 className="font-bold text-red-900">Zona de Perigo: Resetar Sistema</h4>
                    <p className="text-sm text-red-700 font-medium">Apaga todos os dados cadastrados e restaura o estado inicial.</p>
                </div>
                <button 
                  onClick={handleReset}
                  className="flex items-center px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 font-bold transition-colors shadow-sm"
                >
                    <Trash2 size={18} className="mr-2" />
                    Resetar Tudo
                </button>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-300 p-6 text-center">
             <p className="text-sm text-slate-500 font-medium">CatedralGest v1.1.0 • Armazenamento Local</p>
        </div>

      </div>
      <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} />
    </div>
  );
};

export default Settings;
