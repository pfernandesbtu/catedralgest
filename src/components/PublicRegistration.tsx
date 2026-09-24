
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { getSacramentColor } from '../utils/colors';
import { RegistrationCampaign, RegistrationSubmission, SacramentType } from '../types';
import { ArrowLeft, CheckCircle, Send, Calendar, Clock, AlertTriangle, FileText } from 'lucide-react';
import { formatName, formatPhone } from '../utils/formatters';

const PublicRegistration: React.FC = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<RegistrationCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<RegistrationCampaign | null>(null);
  const [step, setStep] = useState<'SELECT' | 'FORM' | 'SUCCESS'>('SELECT');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Data
  const [studentName, setStudentName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [rg, setRg] = useState('');
  const [cpf, setCpf] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [fatherPhone, setFatherPhone] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [fatherEmail, setFatherEmail] = useState('');
  const [motherEmail, setMotherEmail] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('');
  
  // Specifics
  const [isBaptized, setIsBaptized] = useState(false);
  const [baptismPlace, setBaptismPlace] = useState('');
  const [hasFirstEucaristia, setHasFirstEucaristia] = useState(false);
  const [firstEucaristiaPlace, setFirstEucaristiaPlace] = useState('');
  const [preferredMeetingTime, setPreferredMeetingTime] = useState('');

  useEffect(() => {
    const all = db.getRegistrationCampaigns();
    const active = all.filter(c => c.active);
    setCampaigns(active);
    if (active.length === 0) setStep('SELECT'); 
  }, []);

  const handleSelectCampaign = (c: RegistrationCampaign) => {
      setSelectedCampaign(c);
      setStep('FORM');
      setPreferredMeetingTime(c.meetingOptions[0] || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedCampaign) return;
      if (!studentName || !birthDate || (!fatherName && !motherName && !guardianName)) {
          alert("Preencha os campos obrigatórios (Nome do filho, nascimento e pelo menos um responsável).");
          return;
      }

      setIsSubmitting(true);
      
      const submission: RegistrationSubmission = {
          id: Math.random().toString(36).substr(2, 9),
          campaignId: selectedCampaign.id,
          status: 'PENDING',
          submissionDate: new Date().toISOString(),
          studentName,
          studentPhone,
          birthDate,
          rg,
          cpf,
          fatherName,
          fatherPhone,
          motherName,
          motherPhone,
          guardianName,
          guardianPhone,
          fatherEmail,
          motherEmail,
          guardianEmail,
          guardianRelationship,
          isBaptized,
          baptismPlace: isBaptized ? baptismPlace : null,
          hasFirstEucaristia: selectedCampaign.sacrament === 'Crisma' ? hasFirstEucaristia : false,
          firstEucaristiaPlace: hasFirstEucaristia ? firstEucaristiaPlace : null,
          preferredMeetingTime
      };

      try {
          await db.addRegistrationSubmission(submission);
          setStep('SUCCESS');
      } catch (err: any) {
          alert("Erro ao enviar: " + err.message);
      } finally {
          setIsSubmitting(false);
      }
  };

  if (step === 'SELECT') {
      return (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
            <div className="max-w-3xl w-full">
                <button onClick={() => navigate('/')} className="mb-8 flex items-center text-slate-500 hover:text-slate-800 font-bold">
                    <ArrowLeft size={20} className="mr-2" /> Voltar ao Início
                </button>
                
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-black text-slate-900 mb-2">Inscrições Abertas</h1>
                    <p className="text-slate-600">Selecione abaixo a turma para realizar a pré-inscrição do catequizando.</p>
                </div>

                {campaigns.length === 0 ? (
                    <div className="bg-white p-12 rounded-2xl shadow-sm text-center border border-slate-200">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                            <Calendar size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Nenhuma inscrição disponível</h3>
                        <p className="text-slate-500 mt-2">No momento não há períodos de inscrição abertos. Aguarde novos comunicados da paróquia.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {campaigns.map(camp => (
                            <button 
                                key={camp.id}
                                onClick={() => handleSelectCampaign(camp)}
                                className="bg-white p-6 rounded-2xl shadow-lg border-2 border-transparent hover:border-blue-500 hover:scale-[1.02] transition-all text-left group"
                            >
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase mb-3 ${getSacramentColor(camp.sacrament, db.getSystemConfig().sacramentColors, (db.getSystemConfig().sacraments || []).indexOf(camp.sacrament)).badge}`}>
                                    {camp.sacrament}
                                </span>
                                <h3 className="text-xl font-black text-slate-900 mb-2 group-hover:text-blue-700">{camp.title}</h3>
                                <div className="space-y-1 text-sm text-slate-600">
                                    {/* FIX: Add T12:00:00 to prevent timezone rollback */}
                                    <p className="flex items-center"><Calendar size={14} className="mr-2" /> Início: {new Date(camp.startDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                                    <p className="flex items-center"><Clock size={14} className="mr-2" /> Opções: {camp.meetingOptions.length} horários</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
      );
  }

  if (step === 'SUCCESS') {
      return (
          <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
              <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center animate-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                      <CheckCircle size={48} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mb-4">Inscrição Recebida!</h2>
                  <p className="text-slate-600 mb-8">
                      Os dados foram enviados para a coordenação da catequese. Aguarde o contato ou a divulgação da lista oficial de turmas.
                  </p>
                  <button onClick={() => navigate('/')} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors">
                      Voltar ao Início
                  </button>
              </div>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden">
            <div className="bg-slate-900 p-6 md:p-10 text-white relative overflow-hidden">
                <div className="relative z-10">
                    <button onClick={() => setStep('SELECT')} className="flex items-center text-slate-400 hover:text-white text-sm font-bold mb-6 transition-colors">
                        <ArrowLeft size={16} className="mr-1" /> Voltar
                    </button>
                    <h2 className="text-3xl font-black mb-2">{selectedCampaign?.title}</h2>
                    <p className="text-slate-400">Preencha os dados abaixo com atenção para realizar a pré-matrícula.</p>
                </div>
                <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none transform translate-x-1/3 -translate-y-1/3">
                    <FileText size={200} />
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-8">
                
                {/* Seção Catequizando */}
                <div>
                    <h3 className="text-lg font-black text-slate-800 border-b border-slate-200 pb-2 mb-4 flex items-center">
                        <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">1</span>
                        Dados do Catequizando
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700 mb-1">Nome Completo</label>
                            <input required className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" value={studentName} onChange={e => setStudentName(formatName(e.target.value))} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Celular do Catequizando</label>
                            <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:border-blue-600" placeholder="(00) 00000-0000" value={studentPhone} onChange={e => setStudentPhone(formatPhone(e.target.value))} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Data de Nascimento</label>
                            <input type="date" required className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">RG</label>
                                <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:border-blue-600" value={rg} onChange={e => setRg(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">CPF</label>
                                <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:border-blue-600" value={cpf} onChange={e => setCpf(e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Seção Pais */}
                <div>
                    <h3 className="text-lg font-black text-slate-800 border-b border-slate-200 pb-2 mb-4 flex items-center">
                        <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">2</span>
                        Filiação e Contato
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Nome do Pai</label>
                            <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:border-blue-600" value={fatherName} onChange={e => setFatherName(formatName(e.target.value))} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Celular do Pai</label>
                            <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:border-blue-600" placeholder="(00) 00000-0000" value={fatherPhone} onChange={e => setFatherPhone(formatPhone(e.target.value))} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">E-mail do Pai</label>
                            <input type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:border-blue-600" placeholder="pai@exemplo.com" value={fatherEmail} onChange={e => setFatherEmail(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Nome da Mãe</label>
                            <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:border-blue-600" value={motherName} onChange={e => setMotherName(formatName(e.target.value))} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Celular da Mãe</label>
                            <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:border-blue-600" placeholder="(00) 00000-0000" value={motherPhone} onChange={e => setMotherPhone(formatPhone(e.target.value))} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">E-mail da Mãe</label>
                            <input type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:border-blue-600" placeholder="mae@exemplo.com" value={motherEmail} onChange={e => setMotherEmail(e.target.value)} />
                        </div>
                    </div>
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-3">Outro Responsável (se aplicável)</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <input placeholder="Nome Responsável" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-600" value={guardianName} onChange={e => setGuardianName(formatName(e.target.value))} />
                            <input placeholder="Grau Parentesco (ex: Avó)" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-600" value={guardianRelationship} onChange={e => setGuardianRelationship(e.target.value)} />
                            <input placeholder="Telefone" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-600" value={guardianPhone} onChange={e => setGuardianPhone(formatPhone(e.target.value))} />
                            <input type="email" placeholder="E-mail Responsável" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-600" value={guardianEmail} onChange={e => setGuardianEmail(e.target.value)} />
                        </div>
                    </div>
                </div>

                {/* Seção Religiosa */}
                <div>
                    <h3 className="text-lg font-black text-slate-800 border-b border-slate-200 pb-2 mb-4 flex items-center">
                        <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">3</span>
                        Dados Sacramentais
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-start md:items-center flex-col md:flex-row gap-4">
                            <label className="font-bold text-slate-700 w-32">É batizado?</label>
                            <div className="flex gap-4">
                                <label className="flex items-center cursor-pointer"><input type="radio" name="baptized" className="mr-2" checked={isBaptized} onChange={() => setIsBaptized(true)} /> Sim</label>
                                <label className="flex items-center cursor-pointer"><input type="radio" name="baptized" className="mr-2" checked={!isBaptized} onChange={() => setIsBaptized(false)} /> Não</label>
                            </div>
                            {isBaptized && (
                                <input placeholder="Em qual paróquia?" className="flex-1 w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-600" value={baptismPlace} onChange={e => setBaptismPlace(e.target.value)} />
                            )}
                        </div>

                        {selectedCampaign?.sacrament === 'Crisma' && (
                            <div className="flex items-start md:items-center flex-col md:flex-row gap-4">
                                <label className="font-bold text-slate-700 w-32">Fez 1ª Eucaristia?</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center cursor-pointer"><input type="radio" name="eucaristia" className="mr-2" checked={hasFirstEucaristia} onChange={() => setHasFirstEucaristia(true)} /> Sim</label>
                                    <label className="flex items-center cursor-pointer"><input type="radio" name="eucaristia" className="mr-2" checked={!hasFirstEucaristia} onChange={() => setHasFirstEucaristia(false)} /> Não</label>
                                </div>
                                {hasFirstEucaristia && (
                                    <input placeholder="Em qual paróquia?" className="flex-1 w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-600" value={firstEucaristiaPlace} onChange={e => setFirstEucaristiaPlace(e.target.value)} />
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Seção Preferência */}
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                    <h3 className="text-lg font-black text-blue-900 mb-4">Preferência de Horário</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedCampaign?.meetingOptions.map((opt, idx) => (
                            <label key={idx} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${preferredMeetingTime === opt ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-blue-200 text-slate-700 hover:border-blue-400'}`}>
                                <input 
                                    type="radio" 
                                    name="meetingTime" 
                                    className="mr-3 w-4 h-4 accent-white" 
                                    value={opt} 
                                    checked={preferredMeetingTime === opt} 
                                    onChange={(e) => setPreferredMeetingTime(e.target.value)} 
                                />
                                <span className="font-bold">{opt}</span>
                            </label>
                        ))}
                    </div>
                    <p className="text-xs text-blue-700 mt-3 font-medium flex items-center">
                        <AlertTriangle size={14} className="mr-1" />
                        A escolha do horário é uma preferência e depende da formação de turmas e disponibilidade de catequistas.
                    </p>
                </div>

                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-slate-900 text-white font-black text-lg py-4 rounded-xl shadow-xl hover:bg-slate-800 transition-transform active:scale-[0.99] flex items-center justify-center"
                >
                    {isSubmitting ? 'Enviando...' : <><Send size={20} className="mr-2" /> Enviar Inscrição</>}
                </button>

            </form>
        </div>
    </div>
  );
};

export default PublicRegistration;
