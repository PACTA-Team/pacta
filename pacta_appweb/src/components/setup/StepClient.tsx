import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { partySchema, type PartyFormData } from '@/lib/setup-validation';
import { useState } from 'react';
import { toast } from 'sonner';

interface StepClientProps {
  data: PartyFormData;
  onChange: (data: PartyFormData) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function StepClient({ data, onChange, onNext, onPrev }: StepClientProps) {
  const { t } = useTranslation('setup');
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('client.title')}</CardTitle>
        <CardDescription>{t('client.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="client-name">{t('client.name')} *</Label>
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
          <Button onClick={handleNext} className="flex-1">{t('next', { ns: 'common' })}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
