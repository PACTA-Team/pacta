
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [name, setName] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = await login(email, password);
    if (user) {
      toast.success('Login successful!');
      navigate('/dashboard');
    } else {
      toast.error('Invalid email or password');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = await register(name, email, password);
    if (user) {
      toast.success('Registration successful! Please login.');
      setShowRegister(false);
      setName('');
      setEmail('');
      setPassword('');
    } else {
      toast.error('Email already exists');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 sm:p-6 lg:p-8">
      <Card className="w-full max-w-md shadow-lg dark:shadow-2xl">
        <CardHeader className="space-y-3 pb-6">
          <CardTitle className="text-2xl font-bold text-center sm:text-3xl">
            {showRegister ? 'Create Account' : 'PACTA Web'}
          </CardTitle>
          <CardDescription className="text-center text-sm sm:text-base">
            {showRegister ? 'Set up your account to get started' : 'Contract Management System'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 sm:px-8">
          {showRegister ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Register
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setShowRegister(false)}
              >
                Back to Login
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@pacta.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="text-sm text-muted-foreground">
              </div>
              <div className="space-y-3">
                <Button type="submit" className="w-full">
                  Login
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowRegister(true)}
                >
                  Create Account
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
