"use client";

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Home, LogIn } from 'lucide-react';

export default function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
          <ShieldAlert className="h-10 w-10 text-red-600 dark:text-red-400" aria-hidden="true" />
        </div>
        <h1 className="text-7xl font-bold text-red-600 dark:text-red-400">403</h1>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">Access Denied</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Setup has already been completed. This page is no longer accessible.
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <Button onClick={() => navigate('/')}>
            <Home className="mr-2 h-4 w-4" />
            Go to Home
          </Button>
          <Button variant="outline" onClick={() => navigate('/login')}>
            <LogIn className="mr-2 h-4 w-4" />
            Login
          </Button>
        </div>
      </div>
    </div>
  );
}
