# Setup Mode Auto-Advance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add auto-advance navigation to the SetupModeSelector step so users proceed to the next step immediately after selecting a company mode.

**Architecture:** Add an `onSelect` callback prop to `SetupModeSelector` that fires when a mode card is clicked, triggering the wizard's `next()` function. Enhance card interactivity with hover/active scale transforms for tactile feedback. Add a Back button for navigation consistency.

**Tech Stack:** React, TypeScript, Tailwind CSS, shadcn/ui Button

---

### Task 1: Update SetupModeSelector with Auto-Advance

**Files:**
- Modify: `pacta_appweb/src/components/setup/SetupModeSelector.tsx`

**Step 1: Add `onSelect` prop and wire it to card clicks**

Add `onSelect` to the interface and call it after `onChange` in each card's onClick handler. Import `Button` from shadcn/ui. Add hover/active scale transforms to cards.

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SetupModeSelectorProps {
  mode: 'single' | 'multi';
  onChange: (mode: 'single' | 'multi') => void;
  onSelect: () => void;
}

export default function SetupModeSelector({ mode, onChange, onSelect }: SetupModeSelectorProps) {
  const handleSelect = (newMode: 'single' | 'multi') => {
    onChange(newMode);
    onSelect();
  };

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
            onClick={() => handleSelect('single')}
            className={`p-6 rounded-lg border-2 text-left transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] ${
              mode === 'single'
                ? 'border-primary bg-primary/5 shadow-md'
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
            onClick={() => handleSelect('multi')}
            className={`p-6 rounded-lg border-2 text-left transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] ${
              mode === 'multi'
                ? 'border-primary bg-primary/5 shadow-md'
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
        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={() => onChange(mode === 'single' ? 'multi' : 'single')} className="text-muted-foreground">
            Switch to {mode === 'single' ? 'Multiempresa' : 'Empresa Individual'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/mowgli/pacta/pacta_appweb && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to SetupModeSelector

**Step 3: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/components/setup/SetupModeSelector.tsx
git commit -m "feat: add auto-advance to setup mode selector"
```

---

### Task 2: Wire onSelect in SetupWizard

**Files:**
- Modify: `pacta_appweb/src/components/setup/SetupWizard.tsx:63` (the SetupModeSelector render line)

**Step 1: Pass onNext as onSelect prop**

In the `renderStep` function, update the SetupModeSelector call to pass `onNext`:

```tsx
case 1: return <SetupModeSelector mode={companyMode} onChange={setCompanyMode} onSelect={onNext} />;
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/mowgli/pacta/pacta_appweb && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/components/setup/SetupWizard.tsx
git commit -m "feat: wire auto-advance in setup wizard"
```

---

### Task 3: Visual Verification in Browser

**Step 1: Build the frontend**

Run: `cd /home/mowgli/pacta/pacta_appweb && npm run build`
Expected: Build succeeds with no errors

**Step 2: Commit final state**

```bash
cd /home/mowgli/pacta
git status
```

Verify all changes are committed.
