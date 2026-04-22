import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listCompanies } from '@/lib/companies-api';

interface SelectCompanyFormData {
  mode: 'existing' | 'new';
  companyId?: number;
  companyName?: string;
}

interface StepSelectCompanyProps {
  data: SelectCompanyFormData;
  onChange: (data: SelectCompanyFormData) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function StepSelectCompany({ data, onChange, onNext, onPrev }: StepSelectCompanyProps) {
  const { t } = useTranslation('setup');
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCompanies()
      .then(setCompanies)
      .catch(() => setCompanies([]))
      .finally(() => setLoading(false));
  }, []);

  const mode = data.mode || 'existing';
  const canProceed = mode === 'existing' ? !!data.companyId : !!data.companyName && data.companyName.trim().length >= 2;

  const handleModeChange = (newMode: 'existing' | 'new') => {
    onChange({
      mode: newMode,
      companyId: newMode === 'existing' ? undefined : data.companyId,
      companyName: newMode === 'new' ? '' : data.companyName,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('selectCompany.title')}</CardTitle>
        <CardDescription>{t('selectCompany.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Button
            variant={mode === 'existing' ? 'default' : 'outline'}
            onClick={() => handleModeChange('existing')}
            className="flex-1"
          >
            {t('selectCompany.existing')}
          </Button>
          <Button
            variant={mode === 'new' ? 'default' : 'outline'}
            onClick={() => handleModeChange('new')}
            className="flex-1"
          >
            {t('selectCompany.createNew')}
          </Button>
        </div>

        {mode === 'existing' ? (
          <div className="space-y-2">
            <Label htmlFor="company-select">{t('selectCompany.selectLabel')}</Label>
            {loading ? (
              <div className="text-sm text-muted-foreground">{t('loading', { ns: 'common' })}</div>
            ) : companies.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t('selectCompany.noCompanies')}</div>
            ) : (
              <Select
                value={data.companyId?.toString() || ''}
                onValueChange={(v) => onChange({ ...data, companyId: parseInt(v) })}
              >
                <SelectTrigger id="company-select">
                  <SelectValue placeholder={t('selectCompany.selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="new-company-name">{t('selectCompany.newCompanyLabel')} *</Label>
            <Input
              id="new-company-name"
              value={data.companyName || ''}
              onChange={(e) => onChange({ ...data, companyName: e.target.value })}
              placeholder={t('selectCompany.newCompanyPlaceholder')}
              autoFocus
            />
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onPrev} className="flex-1">
            {t('back', { ns: 'common' })}
          </Button>
          <Button onClick={onNext} className="flex-1" disabled={!canProceed}>
            {t('next', { ns: 'common' })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export type { SelectCompanyFormData };