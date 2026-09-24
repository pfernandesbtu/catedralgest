
import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, Settings, GraduationCap, CalendarCheck, CalendarRange, UserCog, Menu, X, ClipboardList, ShieldAlert } from 'lucide-react';
import { Catechist, UserRole } from '../types';
import { db } from '../services/db';

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const currentUserStr = localStorage.getItem('currentUser');
  const currentUser: Catechist | null = currentUserStr ? JSON.parse(currentUserStr) : null;
  
  // Permissões Centralizadas
  
  const isCoordinator = currentUser?.role === UserRole.COORDINATOR;
  const isPadre = currentUser?.role === UserRole.PADRE;
  const hasFullAccess = isCoordinator;
  const hasViewAllAccess = hasFullAccess || isPadre;
  const [systemConfig, setSystemConfig] = useState(db.getSystemConfig());

  useEffect(() => {
      const unsubscribe = db.onChange(() => {
          setSystemConfig(db.getSystemConfig());
      });
      return unsubscribe;
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const linkClass = ({ isActive }: { isActive: boolean }) => 
    `group flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-bold tracking-wide mb-2 ${
      isActive 
        ? 'bg-blue-700 text-white shadow-lg shadow-blue-900/50 ring-1 ring-blue-500' 
        : 'text-slate-300 hover:bg-white/10 hover:text-white'
    }`;

  const NavLinks = () => (
    <>
      <div className="px-4 py-2 mt-2 mb-2 text-[11px] font-black text-slate-500 uppercase tracking-widest">
        Gestão Pastoral
      </div>
      
      <NavLink to="/admin" end className={linkClass} onClick={closeMobileMenu}>
        <LayoutDashboard size={20} className="mr-3 opacity-90 group-hover:opacity-100 transition-opacity" />
        Dashboard
      </NavLink>
      
      {hasViewAllAccess && (
        <>
            <NavLink to="/admin/students" className={linkClass} onClick={closeMobileMenu}>
            <Users size={20} className="mr-3 opacity-90 group-hover:opacity-100 transition-opacity" />
            Catequizandos
            </NavLink>

            {systemConfig.registrationEnabled && (
                <NavLink to="/admin/registrations" className={linkClass} onClick={closeMobileMenu}>
                <ClipboardList size={20} className="mr-3 opacity-90 group-hover:opacity-100 transition-opacity" />
                Inscrições
                </NavLink>
            )}
        </>
      )}

      <NavLink to="/admin/classes" className={linkClass} onClick={closeMobileMenu}>
        <GraduationCap size={20} className="mr-3 opacity-90 group-hover:opacity-100 transition-opacity" />
        Turmas
      </NavLink>

      <NavLink to="/admin/team" className={linkClass} onClick={closeMobileMenu}>
        <UserCog size={20} className="mr-3 opacity-90 group-hover:opacity-100 transition-opacity" />
        Equipe de Catequese
      </NavLink>

      <div className="px-4 py-2 mt-8 mb-2 text-[11px] font-black text-slate-500 uppercase tracking-widest">
        Controle & Eventos
      </div>

      <NavLink to="/admin/attendance" className={linkClass} onClick={closeMobileMenu}>
        <CalendarCheck size={20} className="mr-3 opacity-90 group-hover:opacity-100 transition-opacity" />
        Frequência
      </NavLink>

      <NavLink to="/admin/events" className={linkClass} onClick={closeMobileMenu}>
        <CalendarRange size={20} className="mr-3 opacity-90 group-hover:opacity-100 transition-opacity" />
        Agenda
      </NavLink>

      {currentUser?.email?.toLowerCase().trim() === 'suporte@viacaeli.net' && (
        <>
          <div className="px-4 py-2 mt-8 mb-2 text-[11px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-amber-400" />
            Suporte Técnico
          </div>
          <NavLink to="/admin/logs" className={linkClass} onClick={closeMobileMenu}>
            <ShieldAlert size={20} className="mr-3 text-amber-400 opacity-90 group-hover:opacity-100 transition-opacity" />
            Logs do Sistema
          </NavLink>
        </>
      )}
    </>
  );

  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      <aside className="w-72 bg-slate-950 text-white hidden md:flex flex-col shadow-2xl z-20 relative overflow-hidden border-r border-slate-800">
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-blue-600 rounded-full blur-[100px] opacity-10 pointer-events-none"></div>

        <div className="p-8 pb-8 relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative">
                <div className="absolute inset-0 bg-blue-500 blur-lg opacity-40 rounded-full"></div>
                <div className="relative bg-gradient-to-br from-blue-700 to-blue-900 p-2 rounded-xl shadow-inner border border-white/20 flex items-center justify-center">
                    <img src="/logo.png" alt="Logo" className="h-8 w-8 object-contain" />
                </div>
            </div>
            <div>
              <h1 className="text-white text-xl font-extrabold leading-tight tracking-tight">
                CatedralGest
              </h1>
              <span className="text-[11px] text-blue-200 font-bold uppercase tracking-widest">
                Catequese Integrada
              </span>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar relative z-10">
          <div className="px-4 py-2 mb-4 bg-white/5 rounded-xl border border-white/5">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Usuário Autenticado:</p>
              <p className="text-sm font-bold text-white truncate">{currentUser?.name || 'Usuário'}</p>
              <div className="flex items-center justify-between mt-1">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${
                    
                    isPadre ? 'bg-yellow-600 text-white' :
                    isCoordinator ? 'bg-purple-600 text-white' : 
                    'bg-slate-700 text-slate-300'
                }`}>
                    {currentUser?.role}
                </span>
              </div>
          </div>

          <NavLinks />
        </nav>

        <div className="p-4 mt-auto relative z-10 bg-slate-950/50 backdrop-blur-sm">
          {hasFullAccess && (
            <NavLink to="/admin/settings" className={linkClass} onClick={closeMobileMenu}>
                <Settings size={20} className="mr-3 opacity-90" />
                <span className="font-bold">Configurações</span>
            </NavLink>
          )}
          
          <div className="border-t border-slate-800 my-3"></div>

          <button 
            onClick={handleLogout}
            className="group flex items-center justify-center w-full px-4 py-3 bg-red-900/20 hover:bg-red-700 text-red-300 hover:text-white rounded-xl transition-all duration-300 font-bold border border-red-900/30 hover:border-red-600"
          >
            <LogOut size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" />
            Sair
          </button>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col animate-in slide-in-from-left duration-200 md:hidden">
            <div className="p-6 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-700 p-1.5 rounded-lg flex items-center justify-center">
                        <img src="/logo.png" alt="Logo" className="h-6 w-6 object-contain" />
                    </div>
                    <span className="font-extrabold text-white text-lg">CatedralGest</span>
                </div>
                <button onClick={toggleMobileMenu} className="p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700">
                    <X size={24} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                 <div className="px-4 py-3 mb-6 bg-slate-900 rounded-xl border border-slate-800">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Logado como:</p>
                    <p className="text-sm font-bold text-white truncate">{currentUser?.name || 'Usuário'}</p>
                    <div className="flex items-center justify-between mt-1">
                        <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase ${
                            isPadre ? 'bg-yellow-600 text-white' : isCoordinator ? 'bg-purple-900 text-purple-200' : 'bg-slate-800 text-slate-300'
                        }`}>
                            {currentUser?.role}
                        </span>
                    </div>
                </div>

                <NavLinks />
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950">
                 {hasFullAccess && (
                    <NavLink to="/admin/settings" className={linkClass} onClick={closeMobileMenu}>
                        <Settings size={20} className="mr-3 opacity-90" />
                        <span className="font-bold">Configurações</span>
                    </NavLink>
                  )}
                  <button 
                    onClick={handleLogout}
                    className="group flex items-center justify-center w-full px-4 py-3 bg-red-900/20 hover:bg-red-700 text-red-300 hover:text-white rounded-xl transition-all duration-300 font-bold border border-red-900/30 hover:border-red-600 mt-2"
                  >
                    <LogOut size={18} className="mr-2" />
                    Sair
                  </button>
            </div>
        </div>
      )}

      <main className="flex-1 overflow-auto bg-slate-100 relative">
        <header className="bg-white border-b border-slate-300 h-16 flex items-center justify-between px-4 md:hidden sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
             <button 
                onClick={toggleMobileMenu}
                className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
             >
                 <Menu size={24} />
             </button>
             <div className="flex items-center gap-2">
                <div className="bg-blue-700 p-1 rounded-md flex items-center justify-center">
                    <img src="/logo.png" alt="Logo" className="h-5 w-5 object-contain" />
                </div>
                <span className="font-extrabold text-slate-900 text-lg">CatedralGest</span>
             </div>
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-600 transition-colors">
            <LogOut size={22} />
          </button>
        </header>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
