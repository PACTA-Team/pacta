
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation('login');

  useEffect(() => {
    if (showRegister) {
      fetch('/api/companies', { credentials: 'include' })
        .then(r => r.json())
        .then(data => setCompanies(Array.isArray(data) ? data : []))
        .catch(() => setCompanies([]));
    }
  }, [showRegister]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.user) {
      toast.success(t('loginTitle'));
      navigate('/dashboard');
    } else {
      toast.error(result.error || t('loginError'));
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const companyParam = selectedCompanyId === 'other' ? companyName : undefined;
      const data = await registrationAPI.register(name, email, password, registrationMode, companyParam);
      if (data.status === 'pending_email') {
        setVerificationEmail(email);
        setShowVerification(true);
        toast.info('Verification code sent to your email');
      } else if (data.status === 'pending_approval') {
        toast.success('Registration submitted. An admin will review your request.');
        setShowRegister(false);
        setName('');
        setEmail('');
        setPassword('');
        setCompanyName('');
        setSelectedCompanyId('');
      } else {
        toast.success(t('registerSuccess'));
        setShowRegister(false);
        setName('');
        setEmail('');
        setPassword('');
        setCompanyName('');
        setSelectedCompanyId('');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('registerError'));
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
              <Label htmlFor="company">Company</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                  <SelectItem value="other">Other (new company)</SelectItem>
                </SelectContent>
              </Select>
              {selectedCompanyId === 'other' && (
                <Input
                  id="companyName"
                  placeholder="Enter new company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
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
                    onChange={(e) => setVerificationCode(e.target.value)}
                    maxLength={6}
                    className="text-center text-2xl tracking-widest"
                    autoFocus
                    required
                  />
                </div>
                <Button onClick={handleVerifyCode} className="w-full">
                  Verify Email
                </Button>
              </div>
            )}
            <Button type="submit" className="w-full">
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
            <div className="text-sm text-muted-foreground">
            </div>
            <div className="space-y-3">
              <Button type="submit" className="w-full">
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
