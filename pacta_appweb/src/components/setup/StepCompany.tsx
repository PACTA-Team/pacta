import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CompanyFormData {
  name: string;
  address: string;
  tax_id: string;
}

interface StepCompanyProps {
  data: CompanyFormData;
  onChange: (data: CompanyFormData) => void;
  onNext: () => void;
  onPrev: () => void;
  companyMode: 'single' | 'multi';
}

export default function StepCompany({ data, onChange, onNext, onPrev, companyMode }: StepCompanyProps) {
  const { t } = useTranslation('setup');
  const isFormValid = data.name.trim().length >= 2;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('company.title')}</CardTitle>
        <CardDescription>{companyMode === 'multi' ? 'Parent company details' : t('company.name')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="company-name">{t('company.name')} *</Label>
          <Input
            id="company-name"
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            placeholder={t('company.namePlaceholder')}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-address">{t('company.address')}</Label>
          <Input
            id="company-address"
            value={data.address}
            onChange={(e) => onChange({ ...data, address: e.target.value })}
            placeholder={t('company.addressPlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-tax-id">{t('company.taxId')}</Label>
          <Input
            id="company-tax-id"
            value={data.tax_id}
            onChange={(e) => onChange({ ...data, tax_id: e.target.value })}
            placeholder={t('company.taxIdPlaceholder')}
          />
        </div>
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onPrev} className="flex-1">{t('back', { ns: 'common' })}</Button>
          <Button onClick={onNext} className="flex-1" disabled={!isFormValid}>{t('next', { ns: 'common' })}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export type { CompanyFormData };
