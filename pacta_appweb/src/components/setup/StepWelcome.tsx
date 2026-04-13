import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface StepWelcomeProps { onNext: () => void; }

export function StepWelcome({ onNext }: StepWelcomeProps) {
  const { t } = useTranslation('setup');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">{t('welcome.title')}</CardTitle>
        <CardDescription className="text-center">
          {t('welcome.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>{t('welcome.description')}</p>
          <ul className="space-y-2 ml-4 list-disc">
            <li><strong className="text-foreground">{t('welcome.bullets.0')}</strong></li>
            <li><strong className="text-foreground">{t('welcome.bullets.1')}</strong></li>
            <li><strong className="text-foreground">{t('welcome.bullets.2')}</strong></li>
          </ul>
          <p className="text-xs">{t('welcome.privacy')}</p>
        </div>
        <Button onClick={onNext} className="w-full" size="lg">{t('welcome.getStarted')}</Button>
      </CardContent>
    </Card>
  );
}
