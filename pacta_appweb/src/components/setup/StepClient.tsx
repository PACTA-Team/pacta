import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { partySchema, type PartyFormData } from '@/lib/setup-validation';
import { useState } from 'react';
import { toast } from 'sonner';
import { HelpCircle, SkipForward } from 'lucide-react';

interface StepClientProps {
  data: PartyFormData;
  onChange: (data: PartyFormData) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function StepClient({ data, onChange, onNext, onPrev }: StepClientProps) {
  const { t } = useTranslation('setup');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tutorialMode, setTutorialMode] = useState(false);

  const handleNext = () => {
    const result = partySchema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(e => { fieldErrors[e.path[0]] = e.message; });
      setErrors(fieldErrors);
      toast.error('Please fix the errors below');
      return;
    }
    setErrors({});
    onNext();
  };

  const updateField = (field: keyof PartyFormData, value: string) => {
    onChange({ ...data, [field]: value });
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const skipStep = () => {
    onNext();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">{t('client.title')}</CardTitle>
            <CardDescription>{t('client.subtitle')}</CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => setTutorialMode(!tutorialMode)} className={tutorialMode ? 'bg-blue-100' : ''}>
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{tutorialMode ? 'Disable help tips' : 'Enable help tips'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {tutorialMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> {t('client.helpTip', 'Enter your main client details. This is optional - you can skip this step if you don\'t have a primary client yet.')}
            </p>
          </div>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="client-name">{t('client.name')} *</Label>
            {tutorialMode && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>The official legal name of your client</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <Input id="client-name" value={data.name} onChange={e => updateField('name', e.target.value)} placeholder={t('client.namePlaceholder')} required aria-invalid={!!errors.name} aria-describedby={errors.name ? 'client-name-error' : undefined} />
          {errors.name && <p id="client-name-error" className="text-sm text-red-500" role="alert">{errors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="client-address">{t('client.address')}</Label>
          <Input id="client-address" value={data.address || ''} onChange={e => updateField('address', e.target.value)} placeholder={t('client.addressPlaceholder')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="client-reu">{t('client.taxId')}</Label>
          <Input id="client-reu" value={data.reu_code || ''} onChange={e => updateField('reu_code', e.target.value)} placeholder={t('client.taxIdPlaceholder')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="client-contacts">{t('client.phone')}</Label>
          <Input id="client-contacts" value={data.contacts || ''} onChange={e => updateField('contacts', e.target.value)} placeholder={t('client.phonePlaceholder')} />
        </div>
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onPrev} className="flex-1">{t('back', { ns: 'common' })}</Button>
          <Button variant="outline" onClick={skipStep} className="flex-1 text-muted-foreground">
            <SkipForward className="h-4 w-4 mr-2" />
            {t('skip', { ns: 'common' })}
          </Button>
          <Button onClick={handleNext} className="flex-1">{t('next', { ns: 'common' })}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
