import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { adminSchema, type AdminFormData } from '@/lib/setup-validation';
import { useState } from 'react';
import { toast } from 'sonner';

interface StepAdminProps {
  data: AdminFormData;
  onChange: (data: AdminFormData) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function StepAdmin({ data, onChange, onNext, onPrev }: StepAdminProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleNext = () => {
    const result = adminSchema.safeParse(data);
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

  const updateField = (field: keyof AdminFormData, value: string) => {
    onChange({ ...data, [field]: value });
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const passwordStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return score;
  };

  const strength = passwordStrength(data.password);
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['', 'text-red-500', 'text-yellow-500', 'text-blue-500', 'text-green-500'][strength];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Admin Account</CardTitle>
        <CardDescription>Create the main administrator account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="setup-name">Full Name</Label>
          <Input id="setup-name" value={data.name} onChange={e => updateField('name', e.target.value)} placeholder="Admin User" autoComplete="name" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} />
          {errors.name && <p id="name-error" className="text-sm text-red-500" role="alert">{errors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="setup-email">Email</Label>
          <Input id="setup-email" type="email" value={data.email} onChange={e => updateField('email', e.target.value)} placeholder="admin@pacta.local" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} />
          {errors.email && <p id="email-error" className="text-sm text-red-500" role="alert">{errors.email}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="setup-password">Password</Label>
          <Input id="setup-password" type="password" value={data.password} onChange={e => updateField('password', e.target.value)} placeholder="Min. 8 characters" autoComplete="new-password" aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : 'password-strength'} />
          {data.password && <p id="password-strength" className={`text-xs ${strengthColor}`}>Strength: {strengthLabel}</p>}
          {errors.password && <p id="password-error" className="text-sm text-red-500" role="alert">{errors.password}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="setup-confirm">Confirm Password</Label>
          <Input id="setup-confirm" type="password" value={data.confirmPassword} onChange={e => updateField('confirmPassword', e.target.value)} placeholder="Repeat password" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined} />
          {errors.confirmPassword && <p id="confirm-error" className="text-sm text-red-500" role="alert">{errors.confirmPassword}</p>}
        </div>
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onPrev} className="flex-1">Back</Button>
          <Button onClick={handleNext} className="flex-1">Next</Button>
        </div>
      </CardContent>
    </Card>
  );
}
