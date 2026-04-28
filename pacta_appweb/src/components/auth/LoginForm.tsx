
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { registrationAPI } from '@/lib/registration-api';
import { forgotPasswordAPI } from '@/lib/forgot-password-api';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('login');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result: { user: import('@/types').User | null; error?: string } = await login(email, password);
      if (result.user) {
        toast.success(t('loginTitle'));
        navigate('/dashboard');
      } else {
        toast.error(result.error || t('loginError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error('Please enter your email');
      return;
    }
    setIsSubmitting(true);
    try {
      await forgotPasswordAPI.requestReset(forgotEmail);
      toast.success('Password reset email sent! Check your inbox.');
      setShowForgotPassword(false);
      setForgotEmail('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
      const currentLang = i18n.language.startsWith('es') ? 'es' : 'en';
      const data = await registrationAPI.register(name, email, password, currentLang) as { status: 'pending_email' | 'pending_approval' | 'success' };
      if (data.status === 'pending_email') {
        setVerificationEmail(email);
        setShowVerification(true);
        toast.info(t('emailVerificationToast'));
      } else if (data.status === 'pending_approval') {
        toast.success(t('approvalPendingToast'));
        setShowRegister(false);
        setName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      } else {
        toast.success(t('registerSuccess'));
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('registerError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registrationAPI.verifyCode(verificationEmail, verificationCode);
      toast.success('Email verified! You are now logged in.');
      navigate('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      if (message.includes('expired')) {
        navigate('/registration-expired');
      } else {
        toast.error(message);
      }
    }
  };

  return (
    <Card className="w-full max-w-md shadow-lg dark:shadow-2xl">
      <CardHeader className="space-y-3 pb-6">
        <CardTitle className="text-2xl font-bold text-center sm:text-3xl">
          {showRegister ? t('createAccount') : t('title')}
        </CardTitle>
        <CardDescription className="text-center text-sm sm:text-base">
          {showRegister ? t('setupDesc') : t('subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 sm:px-8">
        {showRegister ? (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('fullName')}</Label>
              <Input
                id="name"
                type="text"
                placeholder={t('fullNamePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {showVerification && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="code">Verification Code</Label>
                  <Input
                    id="code"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="text-center text-2xl tracking-widest"
                    autoFocus
                    required
                  />
                </div>
                <Button type="button" onClick={handleVerifyCode} className="w-full" disabled={isSubmitting}>
                  Verify Email
                </Button>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {t('register')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setShowRegister(false);
                setConfirmPassword('');
              }}
            >
              {t('backToLogin')}
            </Button>
          </form>
) : (
          <>
            {!showForgotPassword ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t('password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t('passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-3">
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {t('loginBtn')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowRegister(true)}
                  >
                    {t('createAccount')}
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    className="w-full text-sm"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setForgotEmail(email);
                    }}
                  >
                    Forgot Password?
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgotEmail">Email</Label>
                  <Input
                    id="forgotEmail"
                    type="email"
                    placeholder="Enter your email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  Send Reset Link
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowForgotPassword(false)}
                >
                  Back to Login
                </Button>
              </form>
            )}
          </>
        )}
        </CardContent>
    </Card>
  );
}
