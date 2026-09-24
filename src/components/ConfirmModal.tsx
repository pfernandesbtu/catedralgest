import React from 'react';
import { Trash2, CheckCircle2 } from 'lucide-react';

export interface ConfirmDialogState {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  isDestructive?: boolean;
  confirmButtonText?: string;
}

interface Props {
  dialog: ConfirmDialogState;
  onClose: () => void;
}

export const ConfirmModal: React.FC<Props> = ({ dialog, onClose }) => {
  if (!dialog.isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
         <div className={`p-6 border-b border-slate-200 flex items-center gap-3 ${dialog.isDestructive ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
            {dialog.isDestructive ? <Trash2 size={24} /> : <CheckCircle2 size={24} />}
            <h3 className="text-lg font-bold">Confirmar Ação</h3>
         </div>
         <div className="p-6">
            <p className="text-slate-700 font-medium">{dialog.message}</p>
         </div>
         <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-100 transition-colors shadow-sm"
            >
              Cancelar
            </button>
            <button 
              onClick={() => {
                dialog.onConfirm();
                onClose();
              }}
              className={`px-4 py-2 rounded-lg text-white font-bold transition-colors shadow-sm ${dialog.isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {dialog.confirmButtonText || 'Confirmar'}
            </button>
         </div>
      </div>
    </div>
  );
};
