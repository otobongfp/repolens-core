'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useApi } from './ApiProvider';

interface User {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  is_verified: boolean;
  role: string;
  tenant_id: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    full_name?: string,
    username?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  getGoogleAuthUrl: () => Promise<string>;
  getGithubAuthUrl: () => Promise<string>;
  handleOAuthCallback: (
    provider: 'google' | 'github',
    code: string,
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshToken: async () => {},
  getGoogleAuthUrl: async () => '',
  getGithubAuthUrl: async () => '',
  handleOAuthCallback: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { apiBase } = useApi();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Check for existing session on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${apiBase}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Token is invalid, try to refresh
        await refreshToken();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const data = await response.json();
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      setUser(data.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (
    email: string,
    password: string,
    full_name?: string,
    username?: string,
  ) => {
    try {
      const response = await fetch(`${apiBase}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, full_name, username }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }

      const data = await response.json();
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      setUser(data.user);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        await fetch(`${apiBase}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
    }
  };

  const refreshToken = async () => {
    try {
      const refreshTokenValue = localStorage.getItem('refresh_token');
      if (!refreshTokenValue) {
        throw new Error('No refresh token');
      }

      const response = await fetch(`${apiBase}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshTokenValue }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      setUser(data.user);
    } catch (error) {
      console.error('Token refresh error:', error);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
      throw error;
    }
  };

  const getGoogleAuthUrl = async (): Promise<string> => {
    const response = await fetch(`${apiBase}/api/auth/oauth/google`);
    if (!response.ok) {
      throw new Error('Failed to get Google auth URL');
    }
    const data = await response.json();
    return data.authorization_url;
  };

  const getGithubAuthUrl = async (): Promise<string> => {
    const response = await fetch(`${apiBase}/api/auth/oauth/github`);
    if (!response.ok) {
      throw new Error('Failed to get GitHub auth URL');
    }
    const data = await response.json();
    return data.authorization_url;
  };

  const handleOAuthCallback = async (
    provider: 'google' | 'github',
    code: string,
  ) => {
    try {
      const response = await fetch(
        `${apiBase}/api/auth/oauth/${provider}/callback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'OAuth authentication failed');
      }

      const data = await response.json();
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      setUser(data.user);
    } catch (error) {
      console.error('OAuth callback error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        login,
        register,
        logout,
        refreshToken,
        getGoogleAuthUrl,
        getGithubAuthUrl,
        handleOAuthCallback,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
