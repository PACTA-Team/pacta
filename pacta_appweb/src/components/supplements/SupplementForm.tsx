import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Supplement, CreateSupplementRequest } from '@/types';

type ContractSummary = {
  id: number;
  internal_id: string;
  contract_number: string;
  title: string;
};

interface SupplementFormProps {
  onSubmit: (data: CreateSupplementRequest) => Promise<void>;
  editingSupplement?: Supplement;
  contracts: ContractSummary[];
  onCancel: () => void;
}

export default function SupplementForm({
  onSubmit,
  editingSupplement,
  contracts,
  onCancel,
}: SupplementFormProps) {
  const { t } = useTranslation('supplements');
  const { t: tCommon } = useTranslation('common');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const data: CreateSupplementRequest = {
      contract_id: Number(formData.get('contract_id')),
      supplement_number: formData.get('supplement_number') as string,
      description: formData.get('description') as string,
      effective_date: formData.get('effective_date') as string,
      modifications: formData.get('modifications') as string || undefined,
    };

    onSubmit(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editingSupplement ? t('editSupplement') : t('addNew')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contract_id">{t('contract')} *</Label>
            <Select
              name="contract_id"
              defaultValue={editingSupplement ? String(editingSupplement.contract_id) : ''}
              disabled={!!editingSupplement}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder={t('contract')} />
              </SelectTrigger>
              <SelectContent>
                {contracts.map((contract) => (
                  <SelectItem key={contract.id} value={String(contract.id)}>
                    {contract.contract_number} - {contract.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplement_number">{t('title')} *</Label>
              <Input
                id="supplement_number"
                name="supplement_number"
                defaultValue={editingSupplement?.supplement_number ?? ''}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="effective_date">{t('effectiveDate')} *</Label>
              <Input
                id="effective_date"
                name="effective_date"
                type="date"
                defaultValue={editingSupplement?.effective_date ?? ''}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('description')} *</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={editingSupplement?.description ?? ''}
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modifications">{t('type')} Summary</Label>
            <Textarea
              id="modifications"
              name="modifications"
              defaultValue={editingSupplement?.modifications ?? ''}
              rows={4}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit">
              {editingSupplement ? t('updateSupplement') : t('createSupplement')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
