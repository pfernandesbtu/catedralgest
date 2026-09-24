import React, { useState, useEffect } from 'react';
import { AttendanceLog, AttendanceType, ScheduledEvent } from '../types';
import { db } from '../services/db';
import { X, Calendar, BookOpen, Church, Sparkles, Check, AlertCircle, Clock, User } from 'lucide-react';
import { formatName } from '../utils/formatters';

export interface EditAttendanceTarget {
  logId: string;
  studentId: string;
  studentName: string;
  className?: string;
  timestamp: string;
  currentType: AttendanceType;
  currentEventName?: string;
  currentJustification?: string;
}

interface Props {
  target: EditAttendanceTarget | null;
  onClose: () => void;
  onSaved?: () => void;
}

export const EditAttendanceModal: React.FC<Props> = ({ target, onClose, onSaved }) => {
  const [selectedType, setSelectedType] = useState<AttendanceType>(AttendanceType.ENCONTRO);
  const [selectedEventName, setSelectedEventName] = useState<string>('');
  const [justification, setJustification] = useState<string>('');
  const [scheduledEvents, setScheduledEvents] = useState<ScheduledEvent[]>([]);
  const [isCustomEvent, setIsCustomEvent] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setSelectedType(target.currentType);
      setSelectedEventName(target.currentEventName || '');
      setJustification(target.currentJustification || '');
      setError(null);
      setSaving(false);

      const events = db.getScheduledEvents();
      setScheduledEvents(events);

      // Check if current is one of the scheduled events
      const isPredefinedEvent = events.some(e => e.name === target.currentEventName && e.type === target.currentType);
      const isStandard = target.currentType === AttendanceType.ENCONTRO || target.currentType === AttendanceType.MISSA;
      setIsCustomEvent(!isStandard && !isPredefinedEvent && (!!target.currentEventName || target.currentType !== AttendanceType.ENCONTRO));
    }
  }, [target]);

  if (!target) return null;

  const handleSelectPredefined = (type: AttendanceType, eventName: string) => {
    setSelectedType(type);
    setSelectedEventName(eventName);
    setIsCustomEvent(false);
  };

  const handleSelectStandard = (type: AttendanceType) => {
    setSelectedType(type);
    setSelectedEventName('');
    setIsCustomEvent(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await db.updateAttendanceLog(target.logId, {
        type: selectedType,
        eventName: selectedEventName.trim() || undefined,
        justification: justification.trim() || undefined
      });
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error('Erro ao atualizar presença:', err);
      setError(err?.message || 'Falha ao salvar alterações.');
      setSaving(false);
    }
  };

  const dateFormatted = new Date(target.timestamp).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 my-8">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Calendar size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Editar Registro de Presença</h3>
              <p className="text-xs text-slate-500 font-medium">Altere a categoria de frequência do catequizando</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 p-2 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm font-semibold">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Student Info Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                <User size={18} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 leading-tight">
                  {formatName(target.studentName)}
                </h4>
                {target.className && (
                  <span className="text-xs text-slate-500 font-medium">{target.className}</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Data / Hora</span>
              <span className="text-xs font-mono font-bold text-slate-700">{dateFormatted}</span>
            </div>
          </div>

          {/* Type Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Tipo de Presença / Evento
            </label>

            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Option: Encontro */}
              <button
                type="button"
                onClick={() => handleSelectStandard(AttendanceType.ENCONTRO)}
                className={`p-3.5 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                  selectedType === AttendanceType.ENCONTRO && !selectedEventName && !isCustomEvent
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${
                    selectedType === AttendanceType.ENCONTRO && !selectedEventName && !isCustomEvent
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <span className="block text-sm font-bold">Encontro</span>
                    <span className="block text-[11px] text-slate-500">Aula da Turma</span>
                  </div>
                </div>
                {selectedType === AttendanceType.ENCONTRO && !selectedEventName && !isCustomEvent && (
                  <Check size={18} className="text-blue-600 font-black" />
                )}
              </button>

              {/* Option: Missa */}
              <button
                type="button"
                onClick={() => handleSelectStandard(AttendanceType.MISSA)}
                className={`p-3.5 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                  selectedType === AttendanceType.MISSA && !selectedEventName && !isCustomEvent
                    ? 'border-purple-600 bg-purple-50/70 text-purple-900 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${
                    selectedType === AttendanceType.MISSA && !selectedEventName && !isCustomEvent
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Church size={18} />
                  </div>
                  <div>
                    <span className="block text-sm font-bold">Missa</span>
                    <span className="block text-[11px] text-slate-500">Missa Paroquial</span>
                  </div>
                </div>
                {selectedType === AttendanceType.MISSA && !selectedEventName && !isCustomEvent && (
                  <Check size={18} className="text-purple-600 font-black" />
                )}
              </button>
            </div>

            {/* Scheduled Events Section (if any exist) */}
            {scheduledEvents.length > 0 && (
              <div className="mt-3">
                <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" /> Eventos Cadastrados no Sistema:
                </span>
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {scheduledEvents.map(evt => {
                    const isSelected = selectedType === evt.type && selectedEventName === evt.name && !isCustomEvent;
                    return (
                      <button
                        key={evt.id}
                        type="button"
                        onClick={() => handleSelectPredefined(evt.type, evt.name)}
                        className={`w-full p-2.5 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50/80 text-amber-900 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            evt.type === AttendanceType.RETIRO ? 'bg-green-100 text-green-800' :
                            evt.type === AttendanceType.MISSAO ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {evt.type}
                          </span>
                          <span className="text-xs font-bold text-slate-800">{evt.name}</span>
                        </div>
                        {isSelected && <Check size={16} className="text-amber-600 font-bold" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom Event Toggle */}
            <div className="mt-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCustomEvent(!isCustomEvent)}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
              >
                {isCustomEvent ? '— Usar opções padrão' : '+ Outro tipo / evento personalizado'}
              </button>

              {isCustomEvent && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Categoria / Tipo
                    </label>
                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value as AttendanceType)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                    >
                      {Object.values(AttendanceType).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Nome do Evento (Opcional)
                    </label>
                    <input
                      type="text"
                      value={selectedEventName}
                      onChange={(e) => setSelectedEventName(e.target.value)}
                      placeholder="Ex: Retiro Espiritual, Missão Comunitária..."
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Justification Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Observação / Justificativa (Opcional)
            </label>
            <input
              type="text"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Ex: Aluno realizou reposição em outra turma / motivo do ajuste..."
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 bg-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-sm disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 active:scale-95"
          >
            {saving ? (
              <>
                <Clock size={16} className="animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Salvar Alterações</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
