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
  const isFormValid = data.name.trim().length >= 2;

  const title = companyMode === 'multi' ? 'Empresa Matriz' : 'Información de la Empresa';
  const description = companyMode === 'multi'
    ? 'Configure los datos de la empresa matriz que gestionará las subsidiarias.'
    : 'Configure los datos de su empresa.';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="company-name">Nombre de la empresa *</Label>
          <Input
            id="company-name"
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            placeholder="Ej: Corporación Legal SA"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-address">Dirección</Label>
          <Input
            id="company-address"
            value={data.address}
            onChange={(e) => onChange({ ...data, address: e.target.value })}
            placeholder="Ej: Av. Principal 123, Ciudad"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-tax-id">RUT / Tax ID</Label>
          <Input
            id="company-tax-id"
            value={data.tax_id}
            onChange={(e) => onChange({ ...data, tax_id: e.target.value })}
            placeholder="Ej: 76.123.456-7"
          />
        </div>
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onPrev} className="flex-1">Back</Button>
          <Button onClick={onNext} className="flex-1" disabled={!isFormValid}>Next</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export type { CompanyFormData };
