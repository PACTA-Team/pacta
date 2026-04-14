import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { registrationAPI } from '@/lib/registration-api';
import { toast } from 'sonner';
import { AnimatedLogo } from '@/components/AnimatedLogo';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const [code, setCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(300);

  useEffect(() => {
    if (timeLeft <= 0) {
      navigate('/registration-expired');
      return;
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, navigate]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registrationAPI.verifyCode(email, code);
      toast.success('Email verified successfully!');
      navigate('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid code';
      if (message.includes('expired')) {
        navigate('/registration-expired');
      } else {
        toast.error(message);
      }
    }
  };

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
            <CardTitle className="text-center">Verify Your Email</CardTitle>
            <CardDescription className="text-center">
              Enter the 6-digit code sent to {email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <div className="text-4xl font-mono font-bold text-primary">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Time remaining</p>
            </div>
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                  autoFocus
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Verify & Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
