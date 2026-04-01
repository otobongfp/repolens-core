'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RefreshCw, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorPage error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

interface ErrorPageProps {
  error?: Error;
  onRetry: () => void;
}

export function ErrorPage({ error, onRetry }: ErrorPageProps) {
  return (
    <div className='bg-background flex min-h-screen items-center justify-center px-4'>
      <div className='w-full max-w-2xl text-center'>
        {/* Error Icon */}
        <div className='mb-8'>
          <div className='bg-destructive/10 mx-auto flex h-20 w-20 items-center justify-center rounded-full'>
            <AlertTriangle className='text-destructive h-10 w-10' />
          </div>
        </div>

        {/* Error Title */}
        <h1 className='text-foreground mb-4 text-3xl font-bold'>
          Oops! Something went wrong
        </h1>

        {/* Error Description */}
        <p className='text-muted-foreground mb-8 text-lg'>
          We encountered an unexpected error. Don't worry, our team has been
          notified and we're working to fix it.
        </p>

        {/* Error Details (Development Only) */}
        {process.env.NODE_ENV === 'development' && error && (
          <div className='bg-destructive/5 border-destructive/20 mb-8 rounded-lg border p-4 text-left'>
            <h3 className='text-destructive mb-2 flex items-center gap-2 font-semibold'>
              <Bug className='h-4 w-4' />
              Error Details (Development)
            </h3>
            <pre className='text-destructive/80 overflow-auto text-sm whitespace-pre-wrap'>
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </div>
        )}

        {/* Action Buttons */}
        <div className='flex flex-col justify-center gap-4 sm:flex-row'>
          <button
            onClick={onRetry}
            className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-semibold transition'
          >
            <RefreshCw className='h-4 w-4' />
            Try Again
          </button>

          <Link
            href='/'
            className='border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-base font-semibold transition'
          >
            <Home className='h-4 w-4' />
            Go Home
          </Link>
        </div>

        {/* Help Text */}
        <p className='text-muted-foreground mt-8 text-sm'>
          If this problem persists, please{' '}
          <Link
            href='https://github.com/otobongfp/repolens/issues'
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary hover:underline'
          >
            report it on GitHub
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ErrorBoundary;
