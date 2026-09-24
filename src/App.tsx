
import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Kiosk from './components/Kiosk';
import AdminDashboard from './components/AdminDashboard';
import StudentManagement from './components/StudentManagement';
import ClassManagement from './components/ClassManagement';
import AttendanceReports from './components/AttendanceReports';
import EventManager from './components/EventManager';
import Settings from './components/Settings';
import CatechistManagement from './components/CatechistManagement';
import StudentPortal from './components/StudentPortal';
import PublicRegistration from './components/PublicRegistration';
import RegistrationAdmin from './components/RegistrationAdmin';
import Login from './components/Login';
import SystemLogs from './components/SystemLogs';
import { Shield, Tablet, UserSearch, MapPin, ClipboardPen, Check } from 'lucide-react';
import { db } from './services/db';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [hasActiveCampaigns, setHasActiveCampaigns] = useState(false);

  useEffect(() => {
    const checkCampaigns = () => {
      const campaigns = db.getRegistrationCampaigns();
      setHasActiveCampaigns(campaigns.some(c => c.active));
    };
    
    // Initial Check
    checkCampaigns();
    
    // Subscribe to changes
    return db.onChange(checkCampaigns);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[100px]"></div>
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-purple-600/20 rounded-full blur-[80px]"></div>
      </div>

      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-5xl w-full flex flex-col md:flex-row relative z-10">
        
        {/* Left Side: Brand Identity */}
        <div className="bg-slate-950 p-8 md:p-12 text-white flex flex-col justify-between md:w-5/12 relative overflow-hidden">
          {/* Background Watermark Logo */}
          <div className="absolute -top-10 -right-10 p-8 md:p-12 opacity-5 pointer-events-none transform rotate-12">
             <img src="/logo.png" alt="Watermark" className="w-[400px] h-auto object-contain grayscale" />
          </div>

          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-sm font-medium text-blue-200 mb-6 backdrop-blur-sm border border-white/5">
              <img src="/logo.png" alt="Icon" className="h-4 w-4 object-contain" />
              <span>Via Caeli <span className="text-amber-500 font-bold">E</span>-Gest</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
              Catedral<span className="text-blue-500">Gest</span>
            </h1>
            <h2 className="text-xl text-slate-400 font-light tracking-wide mb-6">
              Catequese Integrada
            </h2>
            <p className="text-slate-300 leading-relaxed opacity-90">
              Plataforma unificada para gestão da Iniciação à Vida Cristã. Controle de presença, sacramentos e documentação pastoral.
            </p>
          </div>
          
          <div className="mt-12 text-xs text-slate-500">
            &copy; 2026 Catedral Metropolitana Basílica Menor de Sant’Ana. Todos os direitos reservados.
          </div>
        </div>

        {/* Right Side: Access Options */}
        <div className="p-8 md:p-12 md:w-7/12 bg-slate-50 flex flex-col justify-center">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Bem-vindo</h2>
            <p className="text-slate-500">Selecione seu módulo de acesso para continuar.</p>
          </div>

          <div className="space-y-3">
            {/* PORTAL DO CATEQUIZANDO */}
            <button 
              onClick={() => navigate('/portal')}
              className="group w-full flex items-center p-4 bg-white border border-slate-200 rounded-2xl hover:border-green-500 hover:shadow-lg hover:shadow-green-500/10 transition-all duration-300 text-left relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="bg-green-100 p-3 rounded-xl text-green-600 mr-4 group-hover:bg-green-600 group-hover:text-white transition-colors relative z-10">
                <UserSearch size={24} />
              </div>
              <div className="relative z-10">
                <span className="block font-bold text-slate-800 text-base group-hover:text-green-700">ÁREA DO CRISMANDO</span>
              </div>
            </button>

            {/* INSCRIÇÕES ONLINE - Conditional Rendering */}
            {hasActiveCampaigns && (
              <button 
                onClick={() => navigate('/inscricao')}
                className="group w-full flex items-center p-4 bg-white border border-slate-200 rounded-2xl hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300 text-left relative overflow-hidden animate-in fade-in slide-in-from-right-4"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="bg-orange-100 p-3 rounded-xl text-orange-600 mr-4 group-hover:bg-orange-600 group-hover:text-white transition-colors relative z-10">
                  <ClipboardPen size={24} />
                </div>
                <div className="relative z-10">
                  <span className="block font-bold text-slate-800 text-base group-hover:text-orange-700">INSCRIÇÕES</span>
                </div>
              </button>
            )}

            <button 
              onClick={() => navigate('/login')}
              className="group w-full flex items-center p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 text-left relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="bg-blue-100 p-3 rounded-xl text-blue-600 mr-4 group-hover:bg-blue-600 group-hover:text-white transition-colors relative z-10">
                <Shield size={24} />
              </div>
              <div className="relative z-10">
                <span className="block font-bold text-slate-800 text-base group-hover:text-blue-700">ÁREA RESTRITA</span>
              </div>
            </button>

            <button 
              onClick={() => navigate('/kiosk')}
              className="group w-full flex items-center p-4 bg-white border border-slate-200 rounded-2xl hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300 text-left relative overflow-hidden"
            >
               <div className="absolute inset-0 bg-gradient-to-r from-purple-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="bg-purple-100 p-3 rounded-xl text-purple-600 mr-4 group-hover:bg-purple-600 group-hover:text-white transition-colors relative z-10">
                <Check size={24} />
              </div>
              <div className="relative z-10">
                <span className="block font-bold text-slate-800 text-base group-hover:text-purple-700">REGISTRO DE PRESENÇA</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Component to protect Admin Routes
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = localStorage.getItem('currentUser');
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Component to protect Support-only Routes (suporte@viacaeli.net)
const RequireSupport: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const userStr = localStorage.getItem('currentUser');
  const user = userStr ? JSON.parse(userStr) : null;

  if (user?.email?.toLowerCase().trim() !== 'suporte@viacaeli.net') {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn("ErrorBoundary captured error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto">
              <Shield size={32} />
            </div>
            <h2 className="text-2xl font-black text-white">Ops, algo deu errado</h2>
            <p className="text-sm text-slate-300">
              Ocorreu uma instabilidade neste módulo. Clique no botão abaixo para retornar com segurança.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.hash = '#/';
                }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl text-white transition-all shadow-lg cursor-pointer"
              >
                Voltar ao Início
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-xl text-xs transition-all cursor-pointer"
              >
                Recarregar Página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App: React.FC = () => {
  useEffect(() => {
    db.init();
  }, []);

  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          
          <Route path="/login" element={<Login />} />

          {/* Nova Rota Pública para Inscrição */}
          <Route path="/inscricao" element={<PublicRegistration />} />

          {/* Nova Rota para o Portal do Catequizando/Pais */}
          <Route path="/portal" element={<PortalWrapper />} />

          {/* Kiosk Mode is standalone, no sidebar */}
          <Route path="/kiosk" element={<KioskWrapper />} />
          
          {/* Admin Routes with Layout and Protection */}
          <Route path="/admin" element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="students" element={<StudentManagement />} />
            <Route path="registrations" element={<RegistrationAdmin />} />
            <Route path="classes" element={<ClassManagement />} />
            <Route path="team" element={<CatechistManagement />} />
            <Route path="attendance" element={<AttendanceReports />} />
            <Route path="events" element={<EventManager />} />
            <Route path="settings" element={<Settings />} />
            <Route path="logs" element={<RequireSupport><SystemLogs /></RequireSupport>} />
          </Route>
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
};

// Wrappers
const KioskWrapper = () => {
  const navigate = useNavigate();
  return <Kiosk onExit={() => navigate('/')} />;
}

const PortalWrapper = () => {
  const navigate = useNavigate();
  return <StudentPortal onExit={() => navigate('/')} />;
}

export default App;
