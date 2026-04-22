import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface RoleFormData {
  role?: 'manager' | 'editor' | 'viewer';
}

interface StepRoleSelectionProps {
  data: RoleFormData;
  onChange: (data: RoleFormData) => void;
  onNext: () => void;
  onPrev: () => void;
}

const ROLES = [
  {
    value: 'manager' as const,
    labelKey: 'roleSelection.manager',
    descriptionKey: 'roleSelection.managerDesc',
  },
  {
    value: 'editor' as const,
    labelKey: 'roleSelection.editor',
    descriptionKey: 'roleSelection.editorDesc',
  },
  {
    value: 'viewer' as const,
    labelKey: 'roleSelection.viewer',
    descriptionKey: 'roleSelection.viewerDesc',
  },
];

export default function StepRoleSelection({ data, onChange, onNext, onPrev }: StepRoleSelectionProps) {
  const { t } = useTranslation('setup');
  const isFormValid = !!data.role;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('roleSelection.title')}</CardTitle>
        <CardDescription>{t('roleSelection.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded-r-md">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {t('roleSelection.warning')}
          </p>
        </div>

        <RadioGroup
          value={data.role || ''}
          onValueChange={(v) => onChange({ role: v as RoleFormData['role'] })}
          className="space-y-3"
        >
          {ROLES.map((role) => (
            <Label key={role.value} htmlFor={role.value} className="cursor-pointer block">
              <Card className="cursor-pointer hover:border-primary transition-colors border-2 hover:bg-accent/50">
                <CardContent className="p-4 flex items-start gap-3">
                  <RadioGroupItem value={role.value} id={role.value} className="mt-1" />
                  <div>
                    <div className="font-medium">{t(role.labelKey)}</div>
                    <div className="text-sm text-muted-foreground">{t(role.descriptionKey)}</div>
                  </div>
                </CardContent>
              </Card>
            </Label>
          ))}
        </RadioGroup>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onPrev} className="flex-1">
            {t('back', { ns: 'common' })}
          </Button>
          <Button onClick={onNext} className="flex-1" disabled={!isFormValid}>
            {t('next', { ns: 'common' })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export type { RoleFormData };