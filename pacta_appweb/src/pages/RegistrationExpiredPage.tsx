import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Phone } from 'lucide-react';
import { AnimatedLogo } from '@/components/AnimatedLogo';

export default function RegistrationExpiredPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen flex">
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-8">
        <AnimatedLogo size="xl" />
        <h1 className="mt-6 text-4xl font-bold tracking-tight">PACTA</h1>
        <p className="mt-2 text-lg text-muted-foreground text-center max-w-sm">
          Manage contracts with clarity
        </p>
      </div>

      <div className="flex w-full md:w-1/2 lg:w-2/5 items-center justify-center bg-background p-6">
        <div className="w-full max-w-md md:hidden mb-8 flex justify-center">
          <AnimatedLogo size="md" />
        </div>
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">Verification Code Expired</CardTitle>
            <CardDescription className="text-center">
              The 5-minute window for email verification has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center">
                Please contact support or an administrators to activate your account.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>support@pacta.app</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>Contact your system administrator</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => navigate('/login')}>
                Back to Login
              </Button>
              <Button className="flex-1" onClick={() => navigate('/')}>
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
