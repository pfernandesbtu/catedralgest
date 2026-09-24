
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { AttendanceType, ScheduledEvent, LocationConfig } from '../types';
import { CheckCircle, AlertCircle, Delete, ArrowLeft, Calendar, User, MapPin, LocateFixed, RefreshCw, Camera, Smartphone, ShieldAlert, Check, Sparkles } from 'lucide-react';
import { formatName } from '../utils/formatters';

interface KioskProps {
  onExit: () => void;
}

const Kiosk: React.FC<KioskProps> = ({ onExit }) => {
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'LOCATION_CHECK' | 'TYPE_SELECT' | 'PIN_ENTRY' | 'PARENT_SEARCH_STUDENT' | 'PARENT_SELECT' | 'STUDENT_CONFIRM'>('TYPE_SELECT');
  const [selectedType, setSelectedType] = useState<AttendanceType>(AttendanceType.ENCONTRO);
  const [selectedEventName, setSelectedEventName] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [studentName, setStudentName] = useState<string>('');
  
  const [activeEvents, setActiveEvents] = useState<ScheduledEvent[]>([]);
  const [activeStandardMass, setActiveStandardMass] = useState<{ active: boolean, name?: string }>({ active: false });
  const [loading, setLoading] = useState(false);
  
  const [selectedStudentToConfirm, setSelectedStudentToConfirm] = useState<any | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const capturedPhotoRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Parent Meeting States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedStudentForParents, setSelectedStudentForParents] = useState<any | null>(null);
  const [selectedParents, setSelectedParents] = useState<string[]>([]);
  const [showGodparentForm, setShowGodparentForm] = useState(false);
  const [godparentName, setGodparentName] = useState('');
  const [godparentCpf, setGodparentCpf] = useState('');
  
  // Geolocation States
  const [locationStatus, setLocationStatus] = useState<'checking' | 'allowed' | 'denied' | 'error' | 'unavailable'>('checking');
  const [distanceInfo, setDistanceInfo] = useState<{ dist: number, max: number } | null>(null);
  const [config, setConfig] = useState<LocationConfig | null>(null);
  const [geoErrorCode, setGeoErrorCode] = useState<number | null>(null);
  const [isManualSelfieMode, setIsManualSelfieMode] = useState(false);
  const [osTab, setOsTab] = useState<'android' | 'ios'>(() => {
    if (typeof navigator !== 'undefined') {
      if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        return 'ios';
      }
    }
    return 'android';
  });

  // Haversine formula to calculate distance in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
  };

  const checkLocationForType = (type: AttendanceType) => {
      setLocationStatus('checking');
      setGeoErrorCode(null);
      setStep('LOCATION_CHECK');
      const locConfig = db.getLocationConfig();
      setConfig(locConfig);

      const isEvent = type !== AttendanceType.ENCONTRO && type !== AttendanceType.MISSA;

      if (!locConfig.active || (isEvent && locConfig.requireForEvents === false)) {
          setLocationStatus('allowed');
          setIsManualSelfieMode(false);
          if (type === AttendanceType.PAIS_PADRINHOS) {
              setSearchQuery('');
              setSearchResults([]);
              setStep('PARENT_SEARCH_STUDENT');
          } else {
              setStep('PIN_ENTRY');
          }
          return;
      }

      if (!navigator.geolocation) {
          setLocationStatus('unavailable');
          return;
      }

      navigator.geolocation.getCurrentPosition(
          (position) => {
              const userLat = position.coords.latitude;
              const userLng = position.coords.longitude;
              const dist = calculateDistance(userLat, userLng, locConfig.latitude, locConfig.longitude);
              
              setDistanceInfo({ dist: Math.round(dist), max: locConfig.radiusMeters });

              if (dist <= locConfig.radiusMeters) {
                  setLocationStatus('allowed');
                  setIsManualSelfieMode(false);
                  if (type === AttendanceType.PAIS_PADRINHOS) {
                      setSearchQuery('');
                      setSearchResults([]);
                      setStep('PARENT_SEARCH_STUDENT');
                  } else {
                      setStep('PIN_ENTRY');
                  }
              } else {
                  setLocationStatus('denied');
              }
          },
          (err) => {
              console.warn("Geolocation status:", { code: err.code, message: err.message });
              setGeoErrorCode(err.code || 1);
              setLocationStatus('error');
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
  };

  const handleStartManualSelfieMode = () => {
      setIsManualSelfieMode(true);
      setLocationStatus('allowed');
      if (selectedType === AttendanceType.PAIS_PADRINHOS) {
          setSearchQuery('');
          setSearchResults([]);
          setStep('PARENT_SEARCH_STUDENT');
      } else {
          setStep('PIN_ENTRY');
      }
  };

  useEffect(() => {
    db.init();

    const updateActive = () => {
        const events = db.getActiveEvents();
        const mass = db.getCurrentStandardMass();
        setActiveEvents(events);
        setActiveStandardMass(mass);
        setConfig(db.getLocationConfig());
    };

    updateActive();

    const unsubscribe = db.onChange(updateActive);
    const interval = setInterval(updateActive, 10000);

    return () => {
        unsubscribe();
        clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (message) {
      timer = setTimeout(() => {
        setMessage(null);
        setStudentName('');
        setPin('');
        setSelectedEventName(undefined);
        setStep('TYPE_SELECT');
      }, 4000);
    }
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
     let timer: ReturnType<typeof setTimeout>;
     if (countdown !== null && countdown > 0) {
        timer = setTimeout(() => setCountdown(countdown - 1), 1000);
     } else if (countdown === 0) {
        // Capture photo
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                capturedPhotoRef.current = canvas.toDataURL('image/jpeg', 0.5); // Compress quality
            }
        }
        setFlash(true);
        setTimeout(() => {
           setFlash(false);
           setShowPhotoModal(false);
           setCountdown(null);
           executeFinalConfirm();
        }, 300);
     }
     return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (showPhotoModal) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(mediaStream => setStream(mediaStream))
        .catch(err => {
          console.error("Error accessing camera: ", err);
          if (countdown === null) {
              setCountdown(3);
          }
        });
    } else {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
    
    return () => {
       if (stream) {
         stream.getTracks().forEach(track => track.stop());
       }
    };
  }, [showPhotoModal]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      if (countdown === null && !flash) {
         setCountdown(3);
      }
    }
  }, [stream, showPhotoModal]);

  const handleNumClick = (num: string) => {
    if (pin.length < 3) {
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleConfirm = async () => {
    if (pin.length !== 3) return;

    // Double check location before submitting to prevent bypassing
    if (config?.active) {
         // We do a "silent" check here. If GPS fails or user moved, fail safely.
         // For UX speed, we rely on the initial check, but in a real secure app we'd re-verify.
    }

    const student = db.findStudentByPin(pin);
    
    if (student) {
      if (selectedType === AttendanceType.ENCONTRO) {
        const allClasses = db.getClasses();
        const studentClass = allClasses.find(c => c.id === student.classId);

        if (!studentClass) {
             setMessage({ text: 'Você não está vinculado a nenhuma turma.', type: 'error' });
             return;
        }
        const now = new Date();
        const [h, m] = studentClass.meetingTime.split(':').map(Number);
        const classStartMinutes = h * 60 + m;
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        
        const TOLERANCE_BEFORE = 30;
        const systemConfig = db.getSystemConfig();
        const CLASS_DURATION = studentClass.meetingDurationMinutes || systemConfig.meetingDurationMinutes || 60;
        const TOLERANCE_AFTER = 30; // 30 minutos após o término

        if (nowMinutes < (classStartMinutes - TOLERANCE_BEFORE)) {
             setMessage({ text: `Check-in antecipado não permitido. Libera às ${studentClass.meetingTime} (30min antes).`, type: 'error' });
             return;
        }

        if (nowMinutes > (classStartMinutes + CLASS_DURATION + TOLERANCE_AFTER)) {
             setMessage({ text: `O horário do encontro já encerrou (limite de 30min após o término).`, type: 'error' });
             return;
        }
      }
      
      setSelectedStudentToConfirm(student);
      setStep('STUDENT_CONFIRM');
    } else {
      setMessage({ text: 'PIN não encontrado.', type: 'error' });
    }
  };

  const handleStartPhotoCapture = () => {
      setShowPhotoModal(true);
  };

  const executeFinalConfirm = async (overridePhoto?: string) => {
      if (!selectedStudentToConfirm) return;
      setLoading(true);
      const photoBase64 = overridePhoto || capturedPhotoRef.current || undefined;
      const result = await db.logAttendance(
        selectedStudentToConfirm.id, 
        selectedType, 
        selectedEventName, 
        isManualSelfieMode ? 'Check-in por foto na igreja (GPS desativado)' : undefined, 
        undefined, 
        undefined, 
        photoBase64,
        isManualSelfieMode,
        isManualSelfieMode ? 'MANUAL_SELFIE' : 'GPS'
      );
      setLoading(false);
      
      if (result.success) {
        setStudentName(formatName(selectedStudentToConfirm.name));
        setMessage({ text: result.message, type: 'success' });
      } else {
        setMessage({ text: result.message, type: 'error' });
      }
      setSelectedStudentToConfirm(null);
      capturedPhotoRef.current = null;
      setIsManualSelfieMode(false);
      setShowPhotoModal(false);
      setCountdown(null);
  };

  const handleFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          const base64 = event.target?.result as string;
          capturedPhotoRef.current = base64;
          executeFinalConfirm(base64);
      };
      reader.readAsDataURL(file);
  };

  const handleSelectEvent = (type: AttendanceType, name?: string) => {
      setSelectedType(type);
      setSelectedEventName(name);
      checkLocationForType(type);
  };

  const handleSearchStudent = (query: string) => {
      setSearchQuery(query);
      if (query.length < 3) {
          setSearchResults([]);
          return;
      }
      const students = db.getStudents();
      const results = students.filter(s => s.name.toLowerCase().includes(query.toLowerCase()) && !s.archived);
      setSearchResults(results);
  };

  const handleSelectStudentForParents = (student: any) => {
      setSelectedStudentForParents(student);
      setSelectedParents([]);
      setShowGodparentForm(false);
      setGodparentName('');
      setGodparentCpf('');
      setStep('PARENT_SELECT');
  };

  const toggleParentSelection = (parentName: string) => {
      if (!parentName) return;
      setSelectedParents(prev => 
          prev.includes(parentName) 
              ? prev.filter(p => p !== parentName)
              : [...prev, parentName]
      );
  };

  const handleConfirmParents = async () => {
      if (!selectedStudentForParents) return;

      const parentsToLog = [...selectedParents];
      if (showGodparentForm && godparentName.trim() !== '') {
          let gpStr = `Padrinho/Madrinha: ${godparentName.trim()}`;
          if (godparentCpf.trim() !== '') gpStr += ` (CPF: ${godparentCpf.trim()})`;
          parentsToLog.push(gpStr);
      }

      if (parentsToLog.length === 0) return;

      setLoading(true);
      const result = await db.logAttendance(
        selectedStudentForParents.id, 
        selectedType, 
        selectedEventName, 
        isManualSelfieMode ? 'Check-in por foto na igreja (GPS desativado)' : undefined, 
        undefined, 
        parentsToLog,
        undefined,
        isManualSelfieMode,
        isManualSelfieMode ? 'MANUAL_SELFIE' : 'GPS'
      );
      setLoading(false);
      
      if (result.success) {
        setStudentName(selectedStudentForParents.name);
        setMessage({ text: result.message, type: 'success' });
      } else {
        setMessage({ text: result.message, type: 'error' });
      }
      setIsManualSelfieMode(false);
  };

  // --- RENDER SCREENS ---

  if (step === 'LOCATION_CHECK') {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 text-white text-center overflow-y-auto py-8">
            <div className="max-w-md w-full bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-700">
                <div className="mb-4 flex justify-center">
                    <div className="relative">
                        <div className={`absolute inset-0 rounded-full blur-xl ${
                             locationStatus === 'checking' ? 'bg-blue-500/50' :
                             locationStatus === 'allowed' ? 'bg-green-500/50' :
                             'bg-amber-500/40'
                        }`}></div>
                        <div className="relative bg-slate-900 p-4 rounded-full border border-slate-700 shadow-inner">
                             <MapPin size={42} className={
                                 locationStatus === 'checking' ? 'text-blue-400 animate-pulse' :
                                 locationStatus === 'allowed' ? 'text-green-400' :
                                 locationStatus === 'denied' ? 'text-red-400' :
                                 'text-amber-400'
                             } />
                        </div>
                    </div>
                </div>

                <h2 className="text-xl sm:text-2xl font-black mb-1">
                  {locationStatus === 'checking' && "Verificando Localização"}
                  {locationStatus === 'denied' && "Fora do Raio da Catedral"}
                  {locationStatus === 'error' && (geoErrorCode === 1 ? "Localização Desativada / Bloqueada" : "Sinal de GPS Não Encontrado")}
                  {locationStatus === 'unavailable' && "Navegador Sem Suporte a GPS"}
                </h2>
                
                {locationStatus === 'checking' && (
                    <div className="py-6 space-y-3">
                        <p className="text-slate-400 text-sm animate-pulse">Conectando ao GPS para confirmar sua presença na Catedral...</p>
                        <div className="w-12 h-1 bg-blue-500/40 rounded-full mx-auto overflow-hidden">
                            <div className="w-full h-full bg-blue-400 animate-[move_1.5s_ease-in-out_infinite]"></div>
                        </div>
                    </div>
                )}

                {locationStatus === 'denied' && (
                    <div className="space-y-4">
                        <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                            O check-in só é permitido nas dependências da Catedral.
                        </p>
                        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-xs text-red-200">
                            Distância detectada: <strong>{distanceInfo?.dist}m</strong> (Máximo permitido: {distanceInfo?.max}m)
                        </div>
                        <button onClick={() => checkLocationForType(selectedType)} className="w-full py-3 bg-blue-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-500 shadow-lg active:scale-95 transition-all">
                            <RefreshCw size={18} /> Tentar Novamente
                        </button>
                        
                        {/* Contingency Plan B */}
                        <div className="pt-4 border-t border-slate-700/80">
                            <div className="bg-gradient-to-br from-amber-950/60 to-amber-900/40 border border-amber-500/40 rounded-2xl p-4 text-left space-y-2 shadow-md">
                                <div className="flex items-center gap-2 text-amber-300 font-black text-xs uppercase tracking-wider">
                                    <Camera size={16} className="text-amber-400" />
                                    <span>Está na Igreja mas o GPS oscilou?</span>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    Paredes espessas podem interferir no GPS. Você pode enviar uma <strong>selfie dentro da igreja</strong> para o catequista validar manualmente.
                                </p>
                                <button
                                    onClick={handleStartManualSelfieMode}
                                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all"
                                >
                                    <Camera size={15} /> Check-in com Foto na Igreja
                                </button>
                            </div>
                        </div>

                        <button onClick={() => setStep('TYPE_SELECT')} className="w-full py-2.5 bg-slate-700/70 rounded-xl font-bold text-xs text-slate-300 hover:bg-slate-700">
                            Voltar
                        </button>
                    </div>
                )}

                {(locationStatus === 'error' || locationStatus === 'unavailable') && (
                    <div className="space-y-4 text-left">
                        <p className="text-xs text-slate-300 text-center leading-relaxed">
                            A permissão de localização está desativada no seu aparelho. Siga o passo a passo fácil abaixo:
                        </p>

                        {/* OS Selection Tabs */}
                        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-700">
                            <button
                                type="button"
                                onClick={() => setOsTab('android')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                                    osTab === 'android' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Smartphone size={14} /> Android (Chrome)
                            </button>
                            <button
                                type="button"
                                onClick={() => setOsTab('ios')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                                    osTab === 'ios' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <span className="font-serif text-sm leading-none"></span> iPhone (Safari)
                            </button>
                        </div>

                        {/* Step-by-step for Android */}
                        {osTab === 'android' && (
                            <div className="bg-slate-900/70 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                                <div className="flex items-start gap-3">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">1</span>
                                    <p className="text-xs text-slate-200 leading-snug">
                                        No topo da tela, toque no ícone de <strong>controles / cadeado 🔒</strong> ao lado do endereço do site.
                                    </p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">2</span>
                                    <p className="text-xs text-slate-200 leading-snug">
                                        Toque em <strong>"Permissões"</strong> (ou "Configurações do site").
                                    </p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">3</span>
                                    <p className="text-xs text-slate-200 leading-snug">
                                        Ative a chave de <strong>"Localização"</strong> (mude para "Permitido").
                                    </p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">4</span>
                                    <p className="text-xs text-slate-200 leading-snug">
                                        Toque no botão azul <strong>"Já Ativei, Tentar Novamente"</strong> abaixo.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Step-by-step for iPhone */}
                        {osTab === 'ios' && (
                            <div className="bg-slate-900/70 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                                <div className="flex items-start gap-3">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">1</span>
                                    <p className="text-xs text-slate-200 leading-snug">
                                        Na barra de endereço do Safari, toque no ícone <strong>"aA"</strong> (ou ajustes de página).
                                    </p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">2</span>
                                    <p className="text-xs text-slate-200 leading-snug">
                                        Toque em <strong>"Ajustes do Site"</strong>.
                                    </p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">3</span>
                                    <p className="text-xs text-slate-200 leading-snug">
                                        Em <strong>"Localização"</strong>, selecione <strong>"Permitir"</strong> (ou "Perguntar").
                                    </p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">4</span>
                                    <p className="text-xs text-slate-200 leading-snug">
                                        Toque no botão azul <strong>"Já Ativei, Tentar Novamente"</strong> abaixo.
                                    </p>
                                </div>
                                <p className="text-[11px] text-slate-400 border-t border-slate-800 pt-2 leading-relaxed">
                                    💡 Se o GPS do aparelho estiver desligado: Ajustes do iPhone &gt; Privacidade &gt; Serviços de Localização &gt; Ativar.
                                </p>
                            </div>
                        )}

                        <button 
                            onClick={() => checkLocationForType(selectedType)} 
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold flex items-center justify-center gap-2 text-white shadow-lg active:scale-95 transition-all text-sm"
                        >
                            <RefreshCw size={17} /> Já Ativei, Tentar Novamente
                        </button>

                        {/* PART 4: Contingency - Manual Validation by Catechist via Church Selfie */}
                        <div className="pt-4 border-t border-slate-700/80">
                            <div className="bg-gradient-to-br from-amber-950/60 to-amber-900/40 border border-amber-500/40 rounded-2xl p-4 space-y-2.5 shadow-md">
                                <div className="flex items-center gap-2 text-amber-300 font-black text-xs uppercase tracking-wider">
                                    <Camera size={16} className="text-amber-400" />
                                    <span>Não conseguiu ativar o GPS? (Plano B)</span>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    Tire uma <strong>selfie dentro da igreja</strong> comprovando sua presença. O seu catequista irá visualizar a foto e validar sua frequência!
                                </p>
                                <button
                                    onClick={handleStartManualSelfieMode}
                                    className="w-full py-3 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all"
                                >
                                    <Camera size={16} /> Fazer Check-in com Foto na Igreja
                                </button>
                            </div>
                        </div>

                        <button onClick={() => setStep('TYPE_SELECT')} className="w-full py-2.5 bg-slate-700/70 rounded-xl font-bold text-xs text-slate-300 hover:bg-slate-700 text-center">
                            Voltar
                        </button>
                    </div>
                )}

                <button onClick={onExit} className="mt-5 text-xs text-slate-500 hover:text-white underline">Sair do Modo Terminal</button>
            </div>
        </div>
      );
  }

  if (step === 'TYPE_SELECT') {
    return (
      <div className="h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[0%] right-[0%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[80px]"></div>
        </div>

        <div className="w-full max-w-md space-y-8 relative z-10 flex flex-col items-center">
          <div className="text-center flex flex-col items-center">
            <div className="bg-blue-600/20 p-4 rounded-full mb-6 backdrop-blur-sm border border-blue-500/20">
                 <img src="/logo.png" alt="Logo" className="h-16 w-16 object-contain" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Check-in Presencial</h1>
            <p className="text-slate-400 mb-4">Selecione o tipo de atividade</p>

          </div>
          
          <div className="grid grid-cols-1 gap-4 w-full overflow-y-auto max-h-[50vh] no-scrollbar pr-1">
            <button 
              onClick={() => handleSelectEvent(AttendanceType.ENCONTRO)}
              className="p-6 bg-blue-600 rounded-xl text-left shadow-lg active:scale-95 transition-transform group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-semibold block">Encontro</span>
                  <span className="text-sm opacity-80 block mt-1">Registrar presença na turma</span>
                </div>
                <User className="opacity-50 group-hover:opacity-100 transition-opacity" size={32} />
              </div>
            </button>
            
            {activeStandardMass.active && (
              <button 
                onClick={() => handleSelectEvent(AttendanceType.MISSA, activeStandardMass.name)}
                className="p-6 bg-purple-600 rounded-xl text-left shadow-lg active:scale-95 transition-transform group"
              >
                <div className="flex items-center justify-between">
                  <div>
                     <span className="text-2xl font-semibold block">Santa Missa</span>
                     <span className="text-sm opacity-80">{activeStandardMass.name}</span>
                  </div>
                  <span className="text-3xl opacity-50 group-hover:opacity-100 transition-opacity">⛪</span>
                </div>
              </button>
            )}

            {activeEvents.map(event => (
               <button 
                key={event.id}
                onClick={() => handleSelectEvent(event.type, event.name)}
                className={`p-6 rounded-xl text-left shadow-lg active:scale-95 transition-transform group relative overflow-hidden ${
                    event.type === AttendanceType.RETIRO ? 'bg-green-600' : 'bg-orange-600'
                }`}
              >
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <span className="text-sm font-medium uppercase tracking-wider opacity-80 block mb-1">Evento Especial</span>
                        <span className="text-2xl font-bold">{event.name}</span>
                    </div>
                    <Calendar className="opacity-50 group-hover:opacity-100 transition-opacity" size={32} />
                </div>
                <div className="absolute top-0 right-0 p-2">
                     <span className="flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                    </span>
                </div>
              </button>
            ))}

             {!activeStandardMass.active && activeEvents.length === 0 && (
                 <div className="text-center bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                     <p className="text-slate-300 font-medium">Nenhuma Missa ou Evento Especial ativo no momento.</p>
                     <p className="text-xs text-slate-500 mt-2">Clique em "Encontro" para registrar presença na seu encontro.</p>
                 </div>
             )}
          </div>

          <div className="flex flex-col items-center gap-4 mt-4 w-full">
            <button 
                onClick={() => {
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                            () => {},
                            (err) => console.error(err),
                            { enableHighAccuracy: true }
                        );
                    }
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-full flex items-center shadow-lg border border-slate-700 transition-colors"
            >
                📍 Permitir Acesso à Localização
            </button>
            <button 
                onClick={() => {
                    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
                        .then(stream => {
                            stream.getTracks().forEach(t => t.stop());
                        })
                        .catch(err => console.error(err));
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-full flex items-center shadow-lg border border-slate-700 transition-colors"
            >
                📸 Permitir Acesso à Câmera
            </button>
            <button onClick={onExit} className="text-sm text-slate-500 underline w-full text-center hover:text-white transition-colors">
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Header - Fixed height */}
      <div className="bg-white p-3 shadow-sm flex items-center justify-between flex-shrink-0">
        <button 
          onClick={() => { setStep('TYPE_SELECT'); setPin(''); setSelectedEventName(undefined); }}
          className="text-slate-600 flex items-center font-medium hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="mr-2" /> Voltar
        </button>
        
        <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg flex items-center justify-center">
                 <img src="/logo.png" alt="Logo" className="h-6 w-6 object-contain" />
            </div>
            <div className="text-right hidden sm:block">
                <span className="block font-bold text-slate-800 text-base uppercase tracking-wide leading-none">{selectedType}</span>
                {selectedEventName && <span className="block text-[10px] text-blue-600 font-semibold">{selectedEventName}</span>}
            </div>
        </div>
        
        <div className="w-16"></div>
      </div>

      {/* Main Content - Takes remaining space and centers content vertically */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-sm mx-auto w-full overflow-hidden">
        
        {message ? (
          <div className={`w-full p-8 rounded-2xl flex flex-col items-center justify-center text-center animate-pulse ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle size={64} className="mb-4 text-green-600" />
            ) : (
              <AlertCircle size={64} className="mb-4 text-red-600" />
            )}
            <h2 className="text-2xl font-bold mb-1">{studentName || (message.type === 'success' ? 'Sucesso' : 'Erro')}</h2>
            <p className="text-lg">{message.text}</p>
          </div>
        ) : step === 'PARENT_SEARCH_STUDENT' ? (
            <div className="w-full flex flex-col h-full mt-8">
               <h2 className="text-xl font-bold text-slate-800 mb-4 text-center">Digite o nome do catequizando</h2>
               <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => handleSearchStudent(e.target.value)}
                  placeholder="Nome completo..."
                  className="w-full p-4 text-lg border-2 border-slate-300 rounded-xl outline-none focus:border-blue-500 transition-colors mb-4"
                  autoFocus
               />
               <div className="flex-1 overflow-y-auto w-full bg-white rounded-xl shadow-sm border border-slate-200">
                  {searchResults.map(student => (
                      <button 
                         key={student.id} 
                         onClick={() => handleSelectStudentForParents(student)}
                         className="w-full text-left p-4 border-b border-slate-100 hover:bg-blue-50 active:bg-blue-100 transition-colors"
                      >
                         <p className="font-bold text-slate-800">{formatName(student.name)}</p>
                      </button>
                  ))}
                  {searchQuery.length > 2 && searchResults.length === 0 && (
                      <div className="p-6 text-center text-slate-500">Nenhum catequizando encontrado.</div>
                  )}
               </div>
            </div>
        ) : step === 'PARENT_SELECT' ? (
            <div className="w-full flex flex-col h-full mt-4">
               <h2 className="text-xl font-bold text-slate-800 mb-2 text-center">Quem está presente?</h2>
               <p className="text-center text-slate-500 mb-6 text-sm">Catequizando: {selectedStudentForParents?.name}</p>
               
               <div className="space-y-3 flex-1 overflow-y-auto">
                   {[
                       { label: 'Pai', name: selectedStudentForParents?.fatherName },
                       { label: 'Mãe', name: selectedStudentForParents?.motherName },
                       { label: 'Responsável', name: selectedStudentForParents?.guardianName }
                   ].filter(p => p.name && p.name.trim() !== '').map(parent => (
                       <button
                          key={parent.label}
                          onClick={() => toggleParentSelection(parent.name)}
                          className={`w-full p-4 rounded-xl border-2 text-left flex items-center transition-all ${
                              selectedParents.includes(parent.name) 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                       >
                           <div className={`w-6 h-6 rounded-md border-2 mr-4 flex items-center justify-center ${
                               selectedParents.includes(parent.name) ? 'bg-blue-600 border-blue-600' : 'border-slate-400'
                           }`}>
                               {selectedParents.includes(parent.name) && <CheckCircle size={16} className="text-white" />}
                           </div>
                           <div>
                               <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">{parent.label}</p>
                               <p className="font-bold text-slate-800">{parent.name}</p>
                           </div>
                       </button>
                   ))}
                   
                   {![selectedStudentForParents?.fatherName, selectedStudentForParents?.motherName, selectedStudentForParents?.guardianName].some(n => n && n.trim() !== '') && (
                       <div className="p-6 bg-orange-50 border border-orange-200 rounded-xl text-center">
                           <AlertCircle className="mx-auto text-orange-500 mb-2" />
                           <p className="text-orange-800 font-medium text-sm">Nenhum responsável cadastrado para este catequizando.</p>
                       </div>
                   )}

                   <div className="mt-4 pt-4 border-t border-slate-200">
                       <button
                          onClick={() => setShowGodparentForm(!showGodparentForm)}
                          className={`w-full p-4 rounded-xl border-2 text-left flex items-center transition-all ${
                              showGodparentForm 
                                ? 'border-indigo-500 bg-indigo-50' 
                                : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                       >
                           <div className={`w-6 h-6 rounded-md border-2 mr-4 flex items-center justify-center ${
                               showGodparentForm ? 'bg-indigo-600 border-indigo-600' : 'border-slate-400'
                           }`}>
                               {showGodparentForm && <CheckCircle size={16} className="text-white" />}
                           </div>
                           <div>
                               <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Padrinho / Madrinha</p>
                               <p className="font-bold text-slate-800">Registrar presença de padrinho</p>
                           </div>
                       </button>

                       {showGodparentForm && (
                           <div className="mt-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
                               <div>
                                   <label className="block text-xs font-bold text-indigo-800 uppercase mb-1">Nome Completo</label>
                                   <input 
                                       type="text" 
                                       className="w-full p-3 border border-indigo-300 rounded-lg outline-none focus:border-indigo-500 bg-white"
                                       placeholder="Nome do padrinho/madrinha"
                                       value={godparentName}
                                       onChange={e => setGodparentName(e.target.value)}
                                   />
                               </div>
                               <div>
                                   <label className="block text-xs font-bold text-indigo-800 uppercase mb-1">CPF</label>
                                   <input 
                                       type="text" 
                                       className="w-full p-3 border border-indigo-300 rounded-lg outline-none focus:border-indigo-500 bg-white"
                                       placeholder="000.000.000-00"
                                       value={godparentCpf}
                                       onChange={e => setGodparentCpf(e.target.value)}
                                   />
                               </div>
                           </div>
                       )}
                   </div>
               </div>

               <button
                  onClick={handleConfirmParents}
                  disabled={(selectedParents.length === 0 && (!showGodparentForm || godparentName.trim() === '' || godparentCpf.trim() === '')) || loading}
                  className={`w-full py-4 mt-6 rounded-xl text-lg font-black text-white shadow-lg transition-all flex-shrink-0 ${
                    (selectedParents.length > 0 || (showGodparentForm && godparentName.trim() !== '' && godparentCpf.trim() !== ''))
                      ? 'bg-blue-600 hover:bg-blue-700 active:scale-95' 
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
               >
                   {loading ? "ENVIANDO..." : "CONFIRMAR PRESENÇA"}
               </button>
            </div>
        ) : step === 'STUDENT_CONFIRM' ? (
          <div className="w-full flex flex-col h-full justify-center text-center">
             <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mb-6 relative">
                 <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Confirme seus dados</h2>
                 <div className="w-20 h-20 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-md">
                     <User size={32} />
                 </div>
                 <p className="text-2xl font-black text-slate-800 mb-2 leading-tight">
                    {formatName(selectedStudentToConfirm?.name || '')}
                 </p>
                 <p className="text-sm font-bold text-slate-500 bg-slate-50 py-1.5 px-3 rounded-full inline-block border border-slate-100">
                    Turma: {db.getClasses().find(c => c.id === selectedStudentToConfirm?.classId)?.name || 'Sem turma'}
                 </p>
             </div>

             {isManualSelfieMode && (
                 <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-6 text-left flex items-start gap-3 shadow-sm">
                     <div className="p-2 bg-amber-500 text-white rounded-xl flex-shrink-0 mt-0.5">
                         <Camera size={20} />
                     </div>
                     <div>
                         <p className="text-xs font-black text-amber-950 uppercase tracking-wider">Validação por Foto na Igreja</p>
                         <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                             Tire uma <strong>selfie mostrando o interior da igreja</strong> ao fundo. Seu catequista irá conferir a foto para aprovar sua presença no diário.
                         </p>
                     </div>
                 </div>
             )}
             
             {/* Photo Modal Overlay */}
             {showPhotoModal && (
                 <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center overflow-hidden z-[100] p-4">
                     {flash && <div className="absolute inset-0 bg-white z-[110] animate-pulse"></div>}
                     <div className="w-full max-w-sm aspect-[3/4] relative bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800 flex flex-col items-center justify-center">
                         <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover"></video>
                         {/* Mock camera view */}
                         <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-red-500 animate-pulse z-10"></div>
                         
                         {isManualSelfieMode && (
                             <div className="absolute top-4 left-4 z-10 bg-amber-500/90 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1 shadow">
                                 <Camera size={12} /> Selfie na Igreja
                             </div>
                         )}

                         <div className="h-full flex items-center justify-center relative z-20">
                             {countdown !== null && countdown > 0 && (
                                 <span className="text-white text-9xl font-black drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
                                     {countdown}
                                 </span>
                             )}
                         </div>
                         <div className="absolute bottom-8 left-0 right-0 text-white drop-shadow-md text-sm font-bold uppercase tracking-widest text-center z-20 px-4">
                             {isManualSelfieMode ? "Posicione-se com o fundo da igreja..." : "Aguarde a captura..."}
                         </div>
                     </div>

                     {/* Direct file input alternative if browser camera preview fails */}
                     <div className="mt-4 text-center">
                         <button 
                             onClick={() => fileInputRef.current?.click()}
                             className="text-xs text-slate-300 hover:text-white underline font-semibold inline-flex items-center gap-1"
                         >
                             <Camera size={14} /> Usar câmera nativa do celular (alternativa)
                         </button>
                     </div>
                 </div>
             )}
             
             {!showPhotoModal && (
                 <>
                     <input 
                         type="file" 
                         ref={fileInputRef} 
                         accept="image/*" 
                         capture="user" 
                         onChange={handleFileCapture} 
                         className="hidden" 
                     />
                     <button
                        onClick={handleStartPhotoCapture}
                        disabled={loading}
                        className={`w-full py-4 rounded-xl text-base sm:text-lg font-black text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                            isManualSelfieMode 
                              ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30' 
                              : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
                        }`}
                     >
                        <Camera size={20} />
                        {isManualSelfieMode ? "TIRAR SELFIE NA IGREJA E CONFIRMAR" : "CONFIRMAR COM FOTO"}
                     </button>

                     <button 
                         type="button"
                         onClick={() => fileInputRef.current?.click()}
                         className="mt-3 text-xs text-slate-500 hover:text-blue-600 font-semibold inline-flex items-center justify-center gap-1 py-1"
                     >
                         <Camera size={13} /> Tirar foto pelo app de câmera do aparelho
                     </button>

                     <button
                        onClick={() => {
                            setStep('PIN_ENTRY');
                            setSelectedStudentToConfirm(null);
                        }}
                        className="mt-4 text-sm text-slate-500 font-bold hover:text-slate-700 uppercase tracking-wider"
                     >
                        Cancelar
                     </button>
                 </>
             )}
          </div>
        ) : (
          <div className="w-full flex flex-col h-full justify-center">
            {/* PIN Display - Reduced bottom margin */}
            <div className="mb-4 w-full flex-shrink-0">
              <div className="text-center mb-3">
                <h2 className="text-slate-500 text-base mb-1 font-bold">Digite seu PIN</h2>
                <div className="h-14 bg-white border-2 border-slate-200 rounded-xl flex items-center justify-center text-3xl font-bold tracking-[1em] pl-[1em] text-slate-800 shadow-inner">
                  {pin.padEnd(3, '•')}
                </div>
              </div>
            </div>

            {/* Keypad - Uses h-16 instead of h-20 for buttons */}
            <div className="grid grid-cols-3 gap-3 w-full mb-4 flex-shrink-0">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handleNumClick(num.toString())}
                  className="h-16 bg-white rounded-xl shadow-sm border border-slate-200 text-2xl font-bold text-slate-700 active:bg-slate-100 active:scale-95 transition-all"
                >
                  {num}
                </button>
              ))}
              <div className="flex items-center justify-center">
                 <button 
                  onClick={handleBackspace}
                  className="h-16 w-full flex items-center justify-center text-slate-400 active:text-slate-600 hover:text-red-500 transition-colors"
                >
                  <Delete size={28} />
                </button>
              </div>
              <button
                onClick={() => handleNumClick('0')}
                className="h-16 bg-white rounded-xl shadow-sm border border-slate-200 text-2xl font-bold text-slate-700 active:bg-slate-100 active:scale-95 transition-all"
              >
                0
              </button>
              <div className="flex items-center justify-center">
                {/* Spacer */}
              </div>
            </div>

            {/* Confirm Button - Guaranteed to fit */}
            <button
              onClick={handleConfirm}
              disabled={pin.length !== 3 || loading}
              className={`w-full py-4 rounded-xl text-lg font-black text-white shadow-lg transition-all flex-shrink-0 ${
                pin.length === 3 
                  ? 'bg-blue-600 hover:bg-blue-700 active:scale-95' 
                  : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              {loading ? "CARREGANDO..." : "AVANÇAR"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Kiosk;
