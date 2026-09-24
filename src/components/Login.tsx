
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { Catechist } from '../types';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    const savedPassword = localStorage.getItem('rememberedPassword');
    if (savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);
  
  // State for Change Password Flow
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentUser, setCurrentUser] = useState<Catechist | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await db.login(email, password);
      
      if (rememberMe) {
          localStorage.setItem('rememberedEmail', email);
          localStorage.setItem('rememberedPassword', password);
      } else {
          localStorage.removeItem('rememberedEmail');
          localStorage.removeItem('rememberedPassword');
      }

      if (user.isDefaultPassword) {
          // Force password change
          setCurrentUser(user);
          setShowChangePassword(true);
          setIsLoading(false);
      } else {
          // Success
          localStorage.setItem('currentUser', JSON.stringify(user));
          navigate('/admin');
      }

    } catch (err: any) {
      setError(err.message || 'Falha ao entrar.');
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      if (newPassword.length < 6) {
          setError('A senha deve ter pelo menos 6 caracteres.');
          return;
      }
      if (newPassword !== confirmPassword) {
          setError('As senhas não coincidem.');
          return;
      }
      if (!currentUser) return;

      setIsLoading(true);
      try {
          await db.changePassword(currentUser.id, newPassword);
          // Update local object to proceed
          const updatedUser = { ...currentUser, isDefaultPassword: false, password: newPassword };
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));

          if (rememberMe) {
              localStorage.setItem('rememberedPassword', newPassword);
          }

          navigate('/admin');
      } catch (err: any) {
          setError(err.message || "Erro ao alterar senha");
          setIsLoading(false);
      }
  };

  if (showChangePassword) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in duration-300">
                <div className="text-center mb-6">
                    <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-600">
                        <ShieldCheck size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800">Troca de Senha Obrigatória</h2>
                    <p className="text-slate-600 mt-2 text-sm">
                        Olá <strong>{currentUser?.name}</strong>. Como este é seu primeiro acesso (ou sua senha foi resetada), você precisa definir uma nova senha pessoal.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm font-bold flex items-center">
                        <AlertCircle size={16} className="mr-2" /> {error}
                    </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Nova Senha</label>
                        <input 
                            type="password"
                            required
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Confirmar Nova Senha</label>
                        <input 
                            type="password"
                            required
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repita a senha"
                        />
                    </div>
                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center"
                    >
                        {isLoading ? 'Salvando...' : 'Definir Senha e Entrar'}
                    </button>
                </form>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[10%] left-[20%] w-[400px] h-[400px] bg-blue-600/20 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[10%] right-[20%] w-[300px] h-[300px] bg-purple-600/20 rounded-full blur-[80px]"></div>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative z-10 animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-8">
            <div className="bg-blue-600 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
                <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
            </div>
            <h1 className="text-2xl font-black text-slate-800">Acesso Restrito</h1>
            <p className="text-slate-500 mt-1">Coordenação e Catequistas</p>
        </div>

        {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-6 text-sm font-bold flex items-center animate-in slide-in-from-top-2">
                <AlertCircle size={16} className="mr-2" /> {error}
            </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">E-mail</label>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                        type="email"
                        required
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all font-medium text-slate-900"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Senha</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                        type="password"
                        required
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all font-medium text-slate-900"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex items-center">
                <input 
                    id="rememberMe"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="rememberMe" className="ml-2 text-sm font-medium text-slate-700 cursor-pointer">
                    Lembrar e-mail e senha
                </label>
            </div>

            <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center group"
            >
                {isLoading ? 'Verificando...' : (
                    <>Entrar <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" /></>
                )}
            </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-slate-100">
             <button 
                onClick={() => navigate('/')}
                className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
             >
                 Voltar para tela inicial
             </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
