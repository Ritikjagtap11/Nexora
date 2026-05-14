import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ modal, onClose }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (modal) confirmRef.current?.focus();
  }, [modal]);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, onClose]);

  if (!modal) return null;

  const {
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    onConfirm
  } = modal;

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  return (
    // 🌌 BACKDROP (blur + app glow)
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn"
      style={{
        background:
          "radial-gradient(circle at 20% 20%, rgba(249,95,158,0.18), transparent 40%), rgba(0,0,0,0.45)",
        backdropFilter: "blur(8px)"
      }}
      onClick={onClose}
    >
      {/* 💎 GLASS PANEL */}
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="
          relative w-full max-w-sm p-6
          glass-card
          animate-scaleIn
        "
      >
        {/* ❌ CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg
          text-gray-400 hover:text-gray-700 dark:hover:text-white
          hover:bg-black/5 dark:hover:bg-white/10 transition"
        >
          <X size={16} />
        </button>

        {/* ⚠️ ICON */}
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center mb-4
          ${danger
            ? 'bg-red-500/10 dark:bg-red-500/20'
            : 'bg-primary/15'
          }`}>
          <AlertTriangle
            size={24}
            className={danger ? 'text-red-500' : 'text-primary'}
          />
        </div>

        {/* 🧠 TITLE */}
        <h2
          id="confirm-title"
          className="text-lg font-semibold text-gray-900 dark:text-white"
        >
          {title}
        </h2>

        {/* 💬 MESSAGE */}
        {message && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
            {message}
          </p>
        )}

        {/* 🔘 ACTIONS */}
        <div className="flex justify-end gap-3 mt-7">
          {/* Cancel */}
          <button
            onClick={onClose}
            className="
              px-4 py-2 rounded-xl text-sm font-medium
              bg-black/5 dark:bg-white/10
              hover:bg-black/10 dark:hover:bg-white/20
              transition
            "
          >
            {cancelLabel}
          </button>

          {/* Confirm */}
          <button
            ref={confirmRef}
            onClick={handleConfirm}
            className={`
              px-5 py-2 rounded-xl text-sm font-semibold text-white
              transition-all active:scale-95
              shadow-lg
              ${danger
                ? 'bg-gradient-to-r from-red-500 to-red-600 shadow-red-500/40'
                : 'bg-gradient-to-r from-primary to-accent shadow-primary/40'
              }
            `}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}