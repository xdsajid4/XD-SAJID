import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { PendingConfirmation } from '../types';

interface ConfirmationModalProps {
  pendingConfirmation: PendingConfirmation | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  pendingConfirmation,
  onConfirm,
  onCancel,
}) => {
  if (!pendingConfirmation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-100">
              {pendingConfirmation.title || 'Confirm Action'}
            </h3>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed">
              {pendingConfirmation.description}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5 pt-4 border-t border-slate-800">
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            Confirm & Execute
          </button>
        </div>
      </div>
    </div>
  );
};
