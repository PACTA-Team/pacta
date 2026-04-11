import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { partySchema, type PartyFormData } from '@/lib/setup-validation';
import { useState } from 'react';
import { toast } from 'sonner';

interface StepSupplierProps {
  data: PartyFormData;
  onChange: (data: PartyFormData) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function StepSupplier({ data, onChange, onNext, onPrev }: StepSupplierProps) {
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
        <CardTitle className="text-xl">First Supplier</CardTitle>
        <CardDescription>Add your primary supplier/vendor</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="supplier-name">Supplier Name *</Label>
          <Input id="supplier-name" value={data.name} onChange={e => updateField('name', e.target.value)} placeholder="Supplier Company" required aria-invalid={!!errors.name} aria-describedby={errors.name ? 'supplier-name-error' : undefined} />
          {errors.name && <p id="supplier-name-error" className="text-sm text-red-500" role="alert">{errors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-address">Address</Label>
          <Input id="supplier-address" value={data.address || ''} onChange={e => updateField('address', e.target.value)} placeholder="Optional" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-reu">REU Code</Label>
          <Input id="supplier-reu" value={data.reu_code || ''} onChange={e => updateField('reu_code', e.target.value)} placeholder="Optional" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-contacts">Contacts</Label>
          <Input id="supplier-contacts" value={data.contacts || ''} onChange={e => updateField('contacts', e.target.value)} placeholder="Optional (JSON)" />
        </div>
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onPrev} className="flex-1">Back</Button>
          <Button onClick={handleNext} className="flex-1">Next</Button>
        </div>
      </CardContent>
    </Card>
  );
}
