import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface StepWelcomeProps { onNext: () => void; }

export function StepWelcome({ onNext }: StepWelcomeProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Welcome to PACTA</CardTitle>
        <CardDescription className="text-center">
          Let&apos;s set up your organization in a few quick steps
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>We&apos;ll help you configure:</p>
          <ul className="space-y-2 ml-4 list-disc">
            <li><strong className="text-foreground">Admin account</strong> -- Your main administrator credentials</li>
            <li><strong className="text-foreground">First client</strong> -- Your primary client organization</li>
            <li><strong className="text-foreground">First supplier</strong> -- Your primary supplier/vendor</li>
          </ul>
          <p className="text-xs">All data stays on your machine. No cloud services, no third-party databases.</p>
        </div>
        <Button onClick={onNext} className="w-full" size="lg">Get Started</Button>
      </CardContent>
    </Card>
  );
}
