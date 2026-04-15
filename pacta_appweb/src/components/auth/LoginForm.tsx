
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { registrationAPI } from '@/lib/registration-api';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [name, setName] = useState('');
  const [registrationMode, setRegistrationMode] = useState<'email' | 'approval'>('email');
  const [companyName, setCompanyName] = useState('');
  const [companies, setCompanies] = useState<{id: number, name: string}[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [showVerification, setShowVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation('login');

  useEffect(() => {
    if (showRegister) {
      fetch('/api/public/companies')
        .then(r => r.json())
        .then(data => setCompanies(Array.isArray(data) ? data : []))
        .catch(() => setCompanies([]));
    }
  }, [showRegister]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await login(email, password);
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const isNewCompany = selectedCompanyId === 'other';
      const companyParam = isNewCompany ? companyName : undefined;
      const companyId = isNewCompany ? undefined : (selectedCompanyId ? parseInt(selectedCompanyId) : undefined);
      const data = await registrationAPI.register(name, email, password, registrationMode, companyParam, companyId);
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
        setCompanyName('');
        setSelectedCompanyId('');
      } else {
        // First user: auto-logged in, navigate to dashboard
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
              <Label>Registration Method</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="email"
                    checked={registrationMode === 'email'}
                    onChange={() => setRegistrationMode('email')}
                    className="accent-primary"
                  />
                  <span className="text-sm">Email verification</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="approval"
                    checked={registrationMode === 'approval'}
                    onChange={() => setRegistrationMode('approval')}
                    className="accent-primary"
                  />
                  <span className="text-sm">Admin approval</span>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="company">{t('companyLabel')}</Label>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-muted-foreground/30 text-xs text-muted-foreground hover:border-muted-foreground hover:text-foreground">?</span>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-xs">
                        {t('companyTip')}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger id="company">
                  <SelectValue placeholder={t('companyPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                  <SelectItem value="other">{t('newCompanyOption')}</SelectItem>
                </SelectContent>
              </Select>
              {selectedCompanyId === 'other' && (
                <Input
                  id="companyName"
                  placeholder="Enter new company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              )}
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
                setCompanyName('');
                setSelectedCompanyId('');
              }}
            >
              {t('backToLogin')}
            </Button>
          </form>
        ) : (
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
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
