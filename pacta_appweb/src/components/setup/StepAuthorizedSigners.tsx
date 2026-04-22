import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';

interface Signer {
  name: string;
  position: string;
  email: string;
}

interface AuthorizedSignersFormData {
  authorizedSigners: Signer[];
}

interface StepAuthorizedSignersProps {
  data: AuthorizedSignersFormData;
  onChange: (data: AuthorizedSignersFormData) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function StepAuthorizedSigners({ data, onChange, onNext, onPrev }: StepAuthorizedSignersProps) {
  const { t } = useTranslation('setup');
  const signers = data.authorizedSigners || [];

  const addSigner = () => {
    onChange({
      authorizedSigners: [...signers, { name: '', position: '', email: '' }],
    });
  };

  const updateSigner = (index: number, field: keyof Signer, value: string) => {
    const updated = [...signers];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ authorizedSigners: updated });
  };

  const removeSigner = (index: number) => {
    const updated = signers.filter((_, i) => i !== index);
    onChange({ authorizedSigners: updated });
  };

  const isEmailValid = (email: string) => {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const hasValidSigners = signers.every(
    (s) => s.name.trim().length >= 2 && s.position.trim().length >= 2 && isEmailValid(s.email)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('authorizedSigners.title')}</CardTitle>
        <CardDescription>{t('authorizedSigners.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {signers.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p>{t('authorizedSigners.noSigners')}</p>
            <p className="text-sm mt-1">{t('authorizedSigners.addPrompt')}</p>
          </div>
        ) : (
          signers.map((signer, index) => (
            <Card key={index} className="border-muted">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {t('authorizedSigners.signerNumber', { number: index + 1 })}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSigner(index)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor={`signer-name-${index}`}>
                      {t('authorizedSigners.name')} *
                    </Label>
                    <Input
                      id={`signer-name-${index}`}
                      placeholder={t('authorizedSigners.namePlaceholder')}
                      value={signer.name}
                      onChange={(e) => updateSigner(index, 'name', e.target.value)}
                      autoFocus={index === signers.length - 1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`signer-position-${index}`}>
                      {t('authorizedSigners.position')} *
                    </Label>
                    <Input
                      id={`signer-position-${index}`}
                      placeholder={t('authorizedSigners.positionPlaceholder')}
                      value={signer.position}
                      onChange={(e) => updateSigner(index, 'position', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`signer-email-${index}`}>
                      {t('authorizedSigners.email')} *
                    </Label>
                    <Input
                      id={`signer-email-${index}`}
                      type="email"
                      placeholder={t('authorizedSigners.emailPlaceholder')}
                      value={signer.email}
                      onChange={(e) => updateSigner(index, 'email', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}

        <Button variant="outline" onClick={addSigner} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          {t('authorizedSigners.addSigner')}
        </Button>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onPrev} className="flex-1">
            {t('back', { ns: 'common' })}
          </Button>
          <Button onClick={onNext} className="flex-1" disabled={signers.length === 0 || !hasValidSigners}>
            {t('next', { ns: 'common' })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export type { AuthorizedSignersFormData, Signer };