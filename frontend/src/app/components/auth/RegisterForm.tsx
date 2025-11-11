'use client';

import { useState } from 'react';
import { useAuth } from '../../context/AuthProvider';
import toast from 'react-hot-toast';
// Password validation temporarily disabled
// import {
//   validatePassword,
//   getPasswordStrengthColor,
//   getPasswordStrengthText,
//   PasswordValidationResult,
// } from '../../../lib/passwordValidation';

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export default function RegisterForm({
  onSuccess,
  onSwitchToLogin,
}: RegisterFormProps) {
  const { register, getGoogleAuthUrl, getGithubAuthUrl } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Password validation temporarily disabled
  // const [passwordValidation, setPasswordValidation] =
  //   useState<PasswordValidationResult>({
  //     isValid: false,
  //     errors: [],
  //     strength: 'weak',
  //   });

  // Password validation temporarily disabled
  // const handlePasswordChange = (newPassword: string) => {
  //   setPassword(newPassword);
  //   const validation = validatePassword(newPassword);
  //   setPasswordValidation(validation);
  // };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Password validation temporarily disabled
    // if (!passwordValidation.isValid) {
    //   toast.error('Password does not meet requirements');
    //   return;
    // }

    setIsLoading(true);

    try {
      await register(email, password, fullName, username);
      toast.success('Registration successful!');
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Registration failed',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const url = await getGoogleAuthUrl();
      window.location.href = url;
    } catch (error) {
      toast.error('Google login not available');
    }
  };

  const handleGithubLogin = async () => {
    try {
      const url = await getGithubAuthUrl();
      window.location.href = url;
    } catch (error) {
      toast.error('GitHub login not available');
    }
  };

  return (
    <div className='mx-auto w-full max-w-4xl'>
      <div className='bg-card/50 border-border rounded-2xl border p-8 backdrop-blur-md'>
        <div className='mb-8 text-center'>
          <h2 className='text-card-foreground mb-2 text-2xl font-bold'>
            Create Account
          </h2>
          <p className='text-muted-foreground'>
            Join RepoLens and start analyzing code
          </p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-6'>
          <div className='grid grid-cols-1 gap-6 sm:grid-cols-2'>
            <div>
              <label
                htmlFor='fullName'
                className='text-muted-foreground mb-2 block text-sm font-medium'
              >
                Full Name
              </label>
              <input
                id='fullName'
                type='text'
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className='border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-lg border px-4 py-3 focus:ring-2 focus:outline-none'
                placeholder='Enter your full name'
              />
            </div>

            <div>
              <label
                htmlFor='username'
                className='text-muted-foreground mb-2 block text-sm font-medium'
              >
                Username
              </label>
              <input
                id='username'
                type='text'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className='border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-lg border px-4 py-3 focus:ring-2 focus:outline-none'
                placeholder='Choose a username'
              />
            </div>
          </div>

          <div>
            <label
              htmlFor='email'
              className='text-muted-foreground mb-2 block text-sm font-medium'
            >
              Email
            </label>
            <input
              id='email'
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className='border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-lg border px-4 py-3 focus:ring-2 focus:outline-none'
              placeholder='Enter your email'
            />
          </div>

          <div className='grid grid-cols-1 gap-6 sm:grid-cols-2'>
            <div>
              <label
                htmlFor='password'
                className='text-muted-foreground mb-2 block text-sm font-medium'
              >
                Password
              </label>
              <input
                id='password'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className='border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-lg border px-4 py-3 focus:ring-2 focus:outline-none'
                placeholder='Create a strong password'
              />

              {/* Password Strength Indicator - temporarily disabled */}
              {/* {password && (
                <div className='mt-2'>
                  <div className='flex items-center gap-2'>
                    <span className='text-muted-foreground text-sm'>
                      Strength:
                    </span>
                    <span
                      className={`text-sm font-medium ${getPasswordStrengthColor(passwordValidation.strength)}`}
                    >
                      {getPasswordStrengthText(passwordValidation.strength)}
                    </span>
                  </div>

                  {passwordValidation.errors.length > 0 && (
                    <div className='mt-2 space-y-1'>
                      {passwordValidation.errors.map((error, index) => (
                        <div key={index} className='text-sm text-red-500'>
                          • {error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )} */}
            </div>

            <div>
              <label
                htmlFor='confirmPassword'
                className='text-muted-foreground mb-2 block text-sm font-medium'
              >
                Confirm Password
              </label>
              <input
                id='confirmPassword'
                type='password'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className='border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-lg border px-4 py-3 focus:ring-2 focus:outline-none'
                placeholder='Confirm your password'
              />
            </div>
          </div>

          <button
            type='submit'
            disabled={isLoading || password !== confirmPassword}
            className='bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/50 w-full rounded-lg px-4 py-3 font-semibold transition duration-200 disabled:cursor-not-allowed'
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className='mt-6'>
          <div className='relative'>
            <div className='absolute inset-0 flex items-center'>
              <div className='border-border w-full border-t' />
            </div>
            <div className='relative flex justify-center text-sm'>
              <span className='text-muted-foreground bg-transparent px-2'>
                Or continue with
              </span>
            </div>
          </div>

          <div className='mt-6 grid grid-cols-2 gap-3'>
            <button
              onClick={handleGoogleLogin}
              className='border-border bg-background text-foreground hover:bg-accent inline-flex w-full justify-center rounded-lg border px-4 py-3 transition duration-200'
            >
              <svg className='h-5 w-5' viewBox='0 0 24 24'>
                <path
                  fill='currentColor'
                  d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
                />
                <path
                  fill='currentColor'
                  d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
                />
                <path
                  fill='currentColor'
                  d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
                />
                <path
                  fill='currentColor'
                  d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
                />
              </svg>
              <span className='ml-2'>Google</span>
            </button>

            <button
              onClick={handleGithubLogin}
              className='border-border bg-background text-foreground hover:bg-accent inline-flex w-full justify-center rounded-lg border px-4 py-3 transition duration-200'
            >
              <svg className='h-5 w-5' fill='currentColor' viewBox='0 0 24 24'>
                <path d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' />
              </svg>
              <span className='ml-2'>GitHub</span>
            </button>
          </div>
        </div>

        <div className='mt-6 text-center'>
          <p className='text-muted-foreground'>
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className='text-primary hover:text-primary/80 font-medium'
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
