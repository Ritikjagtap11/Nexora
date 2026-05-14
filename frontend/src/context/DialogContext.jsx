import { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, HelpCircle, CheckCircle } from 'lucide-react';

const DialogContext = createContext();

export const useDialog = () => useContext(DialogContext);

export const DialogProvider = ({ children }) => {
  const [dialogs, setDialogs] = useState([]);

  const addDialog = useCallback((type, message, onConfirm, onCancel, defaultValue = '') => {
    const id = Date.now().toString();
    setDialogs((prev) => [...prev, { id, type, message, onConfirm, onCancel, defaultValue }]);
    return id;
  }, []);

  const closeDialog = useCallback((id) => {
    setDialogs((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const alert = useCallback((message) => {
    return new Promise((resolve) => {
      addDialog('alert', message, () => {
        resolve();
      });
    });
  }, [addDialog]);

  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      addDialog(
        'confirm',
        message,
        () => resolve(true),
        () => resolve(false)
      );
    });
  }, [addDialog]);

  const prompt = useCallback((message, defaultValue = '') => {
    return new Promise((resolve) => {
      addDialog(
        'prompt',
        message,
        (value) => resolve(value),
        () => resolve(null),
        defaultValue
      );
    });
  }, [addDialog]);

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt }}>
      {children}
      <DialogContainer dialogs={dialogs} closeDialog={closeDialog} />
    </DialogContext.Provider>
  );
};

const DialogContainer = ({ dialogs, closeDialog }) => {
  if (dialogs.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      {dialogs.map((dialog, index) => (
        <DialogItem key={dialog.id} dialog={dialog} closeDialog={closeDialog} isTop={index === dialogs.length - 1} />
      ))}
    </div>
  );
};

const DialogItem = ({ dialog, closeDialog, isTop }) => {
  const [inputValue, setInputValue] = useState(dialog.defaultValue || '');

  const handleConfirm = () => {
    if (dialog.type === 'prompt') {
      dialog.onConfirm?.(inputValue);
    } else {
      dialog.onConfirm?.();
    }
    closeDialog(dialog.id);
  };

  const handleCancel = () => {
    dialog.onCancel?.();
    closeDialog(dialog.id);
  };

  if (!isTop) return null;

  return (
    <div className="glass-card w-full max-w-sm p-6 relative animate-in fade-in zoom-in duration-200">
      <div className="flex items-center gap-3 mb-4">
        {dialog.type === 'alert' && <AlertCircle className="w-6 h-6 text-primary" />}
        {dialog.type === 'confirm' && <HelpCircle className="w-6 h-6 text-primary" />}
        {dialog.type === 'prompt' && <HelpCircle className="w-6 h-6 text-primary" />}
        <h3 className="text-lg font-semibold dark:text-white text-gray-900">
          {dialog.type === 'alert' ? 'Alert' : dialog.type === 'confirm' ? 'Confirm' : 'Input Required'}
        </h3>
      </div>
      
      <p className="dark:text-gray-300 text-gray-600 text-sm mb-6">{dialog.message}</p>
      
      {dialog.type === 'prompt' && (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="w-full bg-white dark:bg-background-dark border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 mb-6 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          autoFocus
        />
      )}

      <div className="flex justify-end gap-3">
        {(dialog.type === 'confirm' || dialog.type === 'prompt') && (
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium dark:text-gray-300 text-gray-600 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleConfirm}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primary-light text-white transition-colors"
        >
          {dialog.type === 'alert' ? 'OK' : 'Confirm'}
        </button>
      </div>
    </div>
  );
};
