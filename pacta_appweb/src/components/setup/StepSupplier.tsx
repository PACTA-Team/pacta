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

interface StepSupplierProps {
  data: PartyFormData;
  onChange: (data: PartyFormData) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function StepSupplier({ data, onChange, onNext, onPrev }: StepSupplierProps) {
  const { t } = useTranslation('setup');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tutorialMode, setTutorialMode] = useState(false);

   const handleNext = () => {
     const result = partySchema.safeParse(data);
     if (!result.success) {
       const fieldErrors: Record<string, string> = {};
       result.error.issues.forEach(e => { fieldErrors[e.path[0]] = e.message; });
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
            <CardTitle className="text-xl">{t('supplier.title')}</CardTitle>
            <CardDescription>{t('supplier.subtitle')}</CardDescription>
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
              <strong>Tip:</strong> {t('supplier.helpTip', 'Enter your main supplier details. This is optional - you can skip this step if you don\'t have a primary supplier yet.')}
            </p>
          </div>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="supplier-name">{t('supplier.name')} *</Label>
            {tutorialMode && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>The official legal name of your supplier</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <Input id="supplier-name" value={data.name} onChange={e => updateField('name', e.target.value)} placeholder={t('supplier.namePlaceholder')} required aria-invalid={!!errors.name} aria-describedby={errors.name ? 'supplier-name-error' : undefined} />
          {errors.name && <p id="supplier-name-error" className="text-sm text-red-500" role="alert">{errors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-address">{t('supplier.address')}</Label>
          <Input id="supplier-address" value={data.address || ''} onChange={e => updateField('address', e.target.value)} placeholder={t('supplier.addressPlaceholder')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-reu">{t('supplier.taxId')}</Label>
          <Input id="supplier-reu" value={data.reu_code || ''} onChange={e => updateField('reu_code', e.target.value)} placeholder={t('supplier.taxIdPlaceholder')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-contacts">{t('supplier.phone')}</Label>
          <Input id="supplier-contacts" value={data.contacts || ''} onChange={e => updateField('contacts', e.target.value)} placeholder={t('supplier.phonePlaceholder')} />
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
