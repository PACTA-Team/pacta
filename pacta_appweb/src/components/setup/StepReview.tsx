import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AdminFormData, PartyFormData } from '@/lib/setup-validation';
import type { CompanyFormData } from './StepCompany';

interface StepReviewProps {
  companyMode: 'single' | 'multi';
  company: CompanyFormData;
  admin: AdminFormData;
  client: PartyFormData;
  supplier: PartyFormData;
  onPrev: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export function StepReview({ companyMode, company, admin, client, supplier, onPrev, onSubmit, loading }: StepReviewProps) {
  const { t } = useTranslation('setup');
  const { t: tCommon } = useTranslation('common');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('review.title')}</CardTitle>
        <CardDescription>{t('review.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            {t('review.company')}
          </h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Name:</dt><dd>{company.name}</dd></div>
            {company.address && <div className="flex justify-between"><dt className="text-muted-foreground">Address:</dt><dd>{company.address}</dd></div>}
            {company.tax_id && <div className="flex justify-between"><dt className="text-muted-foreground">Tax ID:</dt><dd>{company.tax_id}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted-foreground">Mode:</dt><dd className="capitalize">{companyMode === 'single' ? t('review.singleCompany') : t('review.multiCompany')}</dd></div>
          </dl>
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{t('review.admin')}</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Name:</dt><dd>{admin.name}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Email:</dt><dd>{admin.email}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Password:</dt><dd>........</dd></div>
          </dl>
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{t('review.client')}</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Name:</dt><dd>{client.name}</dd></div>
            {client.address && <div className="flex justify-between"><dt className="text-muted-foreground">Address:</dt><dd>{client.address}</dd></div>}
            {client.reu_code && <div className="flex justify-between"><dt className="text-muted-foreground">REU Code:</dt><dd>{client.reu_code}</dd></div>}
          </dl>
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{t('review.supplier')}</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Name:</dt><dd>{supplier.name}</dd></div>
            {supplier.address && <div className="flex justify-between"><dt className="text-muted-foreground">Address:</dt><dd>{supplier.address}</dd></div>}
            {supplier.reu_code && <div className="flex justify-between"><dt className="text-muted-foreground">REU Code:</dt><dd>{supplier.reu_code}</dd></div>}
          </dl>
        </div>
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onPrev} className="flex-1" disabled={loading}>{tCommon('back')}</Button>
          <Button onClick={onSubmit} className="flex-1" disabled={loading}>
            {loading ? t('review.settingUp') : t('review.completeSetup')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
