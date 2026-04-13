import { useTranslation } from 'react-i18next';

export default function PendingApprovalPage() {
  const { t } = useTranslation('pending');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl">{"\u23F3"}</div>
        <h2 className="text-2xl font-bold">{t('title')}</h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t('description')}
        </p>
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {t('waitMessage')}
          </p>
        </div>
      </div>
    </div>
  );
}
