import React, { createContext, useContext, useState, ReactNode } from 'react';
import { soundFX } from '../lib/soundFX';
import { CheckCircle2, AlertTriangle, Info, X, Zap } from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'success' | 'warning' | 'info' | 'agent';
  title: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
}

interface ToastContextType {
  toast: (options: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = ({ type, title, message, actionText, onAction }: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    if (type === 'success' || type === 'agent') {
      soundFX.playSuccess();
    } else if (type === 'warning') {
      soundFX.playAlert();
    } else {
      soundFX.playClick();
    }

    setToasts((prev) => [...prev, { id, type, title, message, actionText, onAction }]);

    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      {/* Toast Render Stack */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9990,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '380px',
          pointerEvents: 'none'
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              pointerEvents: 'auto',
              background: '#ffffff',
              border: `2px solid ${
                t.type === 'success' ? '#10b981' : t.type === 'warning' ? '#f97316' : t.type === 'agent' ? '#0044ff' : '#111111'
              }`,
              borderRadius: '4px',
              padding: '0.85rem 1rem',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              animation: 'slide-in-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div style={{ marginTop: '2px' }}>
              {t.type === 'success' && <CheckCircle2 size={18} style={{ color: '#10b981' }} />}
              {t.type === 'warning' && <AlertTriangle size={18} style={{ color: '#f97316' }} />}
              {t.type === 'agent' && <Zap size={18} style={{ color: '#0044ff' }} />}
              {t.type === 'info' && <Info size={18} style={{ color: '#111111' }} />}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '0.85rem',
                color: '#111111'
              }}>
                {t.title}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#52525b', marginTop: '2px', lineHeight: 1.4 }}>
                {t.message}
              </div>
              {t.actionText && (
                <button
                  onClick={() => {
                    if (t.onAction) t.onAction();
                    removeToast(t.id);
                  }}
                  style={{
                    marginTop: '8px',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    background: t.type === 'agent' ? '#0044ff' : '#111111',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '2px',
                    padding: '3px 8px',
                    cursor: 'pointer'
                  }}
                >
                  {t.actionText}
                </button>
              )}
            </div>

            <button
              onClick={() => removeToast(t.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#a1a1aa',
                padding: 0
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
