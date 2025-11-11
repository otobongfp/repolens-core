'use client';

import { useAuth } from '../context/AuthProvider';
import { useApi } from '../context/ApiProvider';
import AuthModal from './auth/AuthModal';
import LoadingSpinner from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function ProtectedRoute({
  children,
  fallback,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { useLocalBackend } = useApi();

  // In local mode, skip auth check
  if (useLocalBackend) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className='bg-background flex min-h-screen items-center justify-center'>
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className='bg-background min-h-screen'>
        {fallback || (
          <div className='flex min-h-screen items-center justify-center'>
            <div className='text-center'>
              <h1 className='mb-4 text-2xl font-bold text-white'>
                Authentication Required
              </h1>
              <p className='mb-8 text-gray-400'>
                Please sign in to access this page
              </p>
              <AuthModal />
            </div>
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
