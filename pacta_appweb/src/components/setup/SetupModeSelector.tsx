import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SetupModeSelectorProps {
  mode: 'single' | 'multi';
  onChange: (mode: 'single' | 'multi') => void;
  onSelect?: () => void;
}

export default function SetupModeSelector({ mode, onChange, onSelect }: SetupModeSelectorProps) {
  const { t } = useTranslation('setup');
  const handleSelect = (newMode: 'single' | 'multi') => {
    onChange(newMode);
    onSelect?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('modeSelector.title')}</CardTitle>
        <CardDescription>
          {t('modeSelector.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => handleSelect('single')}
            className={`p-6 rounded-lg border-2 text-left transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              mode === 'single'
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border hover:border-primary/50'
            }`}
            aria-pressed={mode === 'single'}
          >
            <div className="font-semibold mb-2 text-base">{t('modeSelector.singleCompany')}</div>
            <p className="text-sm text-muted-foreground">
              {t('modeSelector.singleCompanyDesc')}
            </p>
          </button>
          <button
            type="button"
            onClick={() => handleSelect('multi')}
            className={`p-6 rounded-lg border-2 text-left transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              mode === 'multi'
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border hover:border-primary/50'
            }`}
            aria-pressed={mode === 'multi'}
          >
            <div className="font-semibold mb-2 text-base">{t('modeSelector.multiCompany')}</div>
            <p className="text-sm text-muted-foreground">
              {t('modeSelector.multiCompanyDesc')}
            </p>
          </button>
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={() => handleSelect(mode === 'single' ? 'multi' : 'single')} className="text-muted-foreground">
            {mode === 'single' ? t('modeSelector.changeToMulti') : t('modeSelector.changeToSingle')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
