import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authAPI } from '@/lib/auth-api';
import { toast } from 'sonner';
import { AnimatedLogo } from '@/components/AnimatedLogo';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error('Invalid or missing reset token');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      toast.success('Password reset successfully!');
      navigate('/login');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password';
      toast.error(message);
    } finally {
      setIsLoading(false);
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
            <CardTitle className="text-center">Reset Your Password</CardTitle>
            <CardDescription className="text-center">
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
