import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './ui/Modal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIos(): boolean {
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export default function InstallPwaButton() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosOpen, setIosOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (isStandalone()) { setHidden(true); return; }
    if (localStorage.getItem('sdps_pwa_dismissed') === '1') { setHidden(true); return; }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (hidden) return null;

  const onInstall = async () => {
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        setPrompt(null);
        setHidden(true);
      }
      return;
    }
    if (isIos()) {
      setIosOpen(true);
    } else {
      // No install prompt available — most likely already installed
      setHidden(true);
    }
  };

  const onDismiss = () => {
    localStorage.setItem('sdps_pwa_dismissed', '1');
    setHidden(true);
  };

  // Only render the pill if there's something to install
  if (!prompt && !isIos()) return null;

  return (
    <>
      <div className="flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-1 text-xs text-brand-800">
        <button
          type="button"
          onClick={onInstall}
          className="font-medium hover:underline"
        >
          📲 {t('pwa_install')}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-1 text-brand-700/60 hover:text-brand-800"
          aria-label={t('pwa_dismiss')}
        >
          ✕
        </button>
      </div>

      <Modal
        open={iosOpen}
        onClose={() => setIosOpen(false)}
        title={t('pwa_ios_title')}
        footer={
          <button
            onClick={() => setIosOpen(false)}
            className="rounded-md bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            {t('action_close')}
          </button>
        }
      >
        <ol className="space-y-3 text-sm text-slate-700">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">1</span>
            <span>{t('pwa_ios_step1')}</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">2</span>
            <span>{t('pwa_ios_step2')}</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">3</span>
            <span>{t('pwa_ios_step3')}</span>
          </li>
        </ol>
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
          {t('pwa_ios_hint')}
        </div>
      </Modal>
    </>
  );
}