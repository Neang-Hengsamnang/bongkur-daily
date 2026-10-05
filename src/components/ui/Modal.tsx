import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
  /** On small screens, render as a full-width bottom sheet with internal scroll. */
  mobileSheet?: boolean;
}

export default function Modal({
  open, title, onClose, children, footer,
  maxWidth = 'max-w-md',
  mobileSheet = false,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const align   = mobileSheet ? 'items-end sm:items-center' : 'items-center';
  const padding = mobileSheet ? 'p-0 sm:p-4' : 'p-4';
  const radius  = mobileSheet ? 'rounded-t-2xl sm:rounded-xl' : 'rounded-xl';
  const sizing  = mobileSheet ? 'max-h-[92vh] sm:max-h-[90vh] flex flex-col' : '';

  return (
    <div className={`fixed inset-0 z-[1080] flex justify-center ${align} ${padding}`}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative w-full ${maxWidth} ${radius} bg-white shadow-2xl ${sizing}`}>
        {mobileSheet && (
          <div className="flex justify-center pt-2 sm:hidden">
            <div className="h-1.5 w-10 rounded-full bg-slate-300" />
          </div>
        )}

        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="truncate text-base font-medium text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={`px-5 py-4 ${mobileSheet ? 'flex-1 overflow-y-auto' : ''}`}>
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}