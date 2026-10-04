import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import NewPaymentTab from './NewPaymentTab';
import HistoryTab from './HistoryTab';
import { countOutstanding } from '../../lib/api/payments';

type Tab = 'history' | 'outstanding' | 'new';

export default function Payments() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('new');
  const [unpaidCount, setUnpaidCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const count = await countOutstanding();
        if (!cancelled) setUnpaidCount(count);
      } catch {
        /* non-fatal */
      }
    })();
    return () => { cancelled = true; };
  }, [tab]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-heading text-slate-900">{t('payments_title')}</h1>

      <div className="flex gap-1 border-b border-slate-200">
        {(['new', 'history', 'outstanding'] as Tab[]).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={
              'relative -mb-px px-4 py-2 text-sm font-medium ' +
              (tab === tb
                ? 'border-b-2 border-brand-500 text-brand-700'
                : 'text-slate-500 hover:text-slate-800')
            }
          >
            {t(`payments_tab_${tb}`)}
            {tb === 'outstanding' && unpaidCount > 0 && (
              <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                {unpaidCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'new' && <NewPaymentTab />}
      {tab === 'history' && <HistoryTab key="history" mode="history" />}
      {tab === 'outstanding' && <HistoryTab key="outstanding" mode="outstanding" />}
    </div>
  );
}