import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SetupModeSelectorProps {
  mode: 'single' | 'multi';
  onChange: (mode: 'single' | 'multi') => void;
}

export default function SetupModeSelector({ mode, onChange }: SetupModeSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">¿Cómo usará PACTA?</CardTitle>
        <CardDescription>
          Seleccione el modo de operación que mejor se adapte a su organización.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => onChange('single')}
            className={`p-6 rounded-lg border-2 text-left transition ${
              mode === 'single'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
            aria-pressed={mode === 'single'}
          >
            <div className="font-semibold mb-2 text-base">Empresa Individual</div>
            <p className="text-sm text-muted-foreground">
              Una sola empresa, todos los abogados gestionan contratos y suplementos.
              Ideal para organizaciones sin subsidiarias.
            </p>
          </button>
          <button
            type="button"
            onClick={() => onChange('multi')}
            className={`p-6 rounded-lg border-2 text-left transition ${
              mode === 'multi'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
            aria-pressed={mode === 'multi'}
          >
            <div className="font-semibold mb-2 text-base">Multiempresa</div>
            <p className="text-sm text-muted-foreground">
              Empresa matriz + subsidiarias con abogados independientes y contratos
              separados. Cada subsidiaria opera de forma aislada.
            </p>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
