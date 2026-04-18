"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary - Captures React rendering errors to prevent blank screens
 *
 * Without this, any uncaught render error unmounts the entire React tree
 * resulting in a completely blank page with no feedback to the user.
 *
 * This component:
 * - Catches errors during rendering, lifecycle methods, and constructors
 * - Logs error details to console for debugging
 * - Displays a user-friendly error message with recovery options
 * - Optionally reports errors to an external service (TODO: add Sentry)
 *
 * Usage: Wrap at the App level or around individual page components
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details for debugging
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    this.setState({
      errorInfo,
    });

    // TODO: Send to error reporting service (Sentry, etc.)
    // logErrorToService(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    // Reload the page as a recovery mechanism
    window.location.reload();
  };

  handleGoHome = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.href = "/dashboard";
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Log detailed error for server-side debugging
      const errorDetails = {
        message: this.state.error?.message,
        stack: this.state.error?.stack,
        componentStack: this.state.errorInfo?.componentStack,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      };

      // Print to console for now - in production this would go to a log service
      console.error("[ErrorBoundary] Uncaught render error:", errorDetails);

      // Show toast for user awareness
      toast.error("An unexpected error occurred. Please refresh the page.");

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 p-4 bg-background">
          <div className="text-2xl font-semibold text-red-500">Something went wrong</div>
          <div className="text-muted-foreground text-center max-w-md">
            <p>An unexpected error occurred while loading this page.</p>
            {this.state.error && (
              <p className="mt-2 text-sm font-mono bg-muted p-2 rounded">
                {this.state.error.message}
              </p>
            )}
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={this.handleReset} variant="default">
              Refresh Page
            </Button>
            <Button onClick={this.handleGoHome} variant="outline">
              Return to Dashboard
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
