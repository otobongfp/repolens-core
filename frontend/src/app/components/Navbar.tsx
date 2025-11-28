'use client';

import { useAuth } from '../context/AuthProvider';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import UserMenu from './auth/UserMenu';
import AuthModal from './auth/AuthModal';
import { useState, useEffect, useRef } from 'react';
import { Github, Star, Menu, X } from 'lucide-react';

// GitHub repository info
const GITHUB_OWNER = 'otobongfp';
const GITHUB_REPO = 'repolens-core';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

// Cache
const STARS_CACHE_KEY = 'repolens_github_stars';
const STARS_CACHE_DURATION = 5 * 60 * 1000; 

function useGitHubStars() {
  const [stars, setStars] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check cache first
    const cached = localStorage.getItem(STARS_CACHE_KEY);
    if (cached) {
      try {
        const { count, timestamp } = JSON.parse(cached);
        const now = Date.now();
        if (now - timestamp < STARS_CACHE_DURATION) {
          setStars(count);
          setLoading(false);
          return;
        }
      } catch (e) {
        // Invalid cache, continue to fetch
      }
    }

    // Fetch from GitHub API
    fetch(GITHUB_API_URL)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch stars');
        return res.json();
      })
      .then((data) => {
        const count = data.stargazers_count || 0;
        setStars(count);
        // Cache the result
        localStorage.setItem(
          STARS_CACHE_KEY,
          JSON.stringify({ count, timestamp: Date.now() })
        );
      })
      .catch((error) => {
        console.warn('Failed to fetch GitHub stars:', error);
        if (cached) {
          try {
            const { count } = JSON.parse(cached);
            setStars(count);
          } catch (e) {
            // Ignore
          }
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { stars, loading };
}

export default function Navbar() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { stars, loading: starsLoading } = useGitHubStars();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMobileMenu(false);
      }
    };

    if (showMobileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMobileMenu]);

  return (
    <>
      <nav className='border-border bg-background fixed z-50 flex h-16 w-full items-center justify-center border px-4 text-white sm:px-6'>
        <section className='flex w-full max-w-5xl items-center justify-between xl:max-w-[1200px]'>
          <Link href='/' className='flex items-center gap-2'>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src='/logo.svg'
              alt='RepoLens Logo'
              width={32}
              height={32}
              className='h-8 w-8'
            />
            <span className='font-manrope text-xl font-bold tracking-tight text-white sm:text-2xl'>
              RepoLens
            </span>
            <span className='sr-only'>Go to repolens homepage</span>
          </Link>
          <section className='flex items-center gap-1.5 sm:gap-3'>
            {/* Desktop: Individual items */}
            <div className='hidden items-center gap-1.5 sm:flex sm:gap-3'>
              {/* GitHub Stars Badge */}
              <Link
                href={`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`}
                target='_blank'
                rel='noopener noreferrer'
                className='border-border bg-card/50 hover:bg-card/80 text-card-foreground flex h-10 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium transition'
              >
                <Github className='h-4 w-4' />
                <Star className='h-3.5 w-3.5 fill-yellow-400 text-yellow-400' />
                {starsLoading ? (
                  <span className='h-4 w-8 animate-pulse rounded bg-muted' />
                ) : stars !== null ? (
                  <span>{stars.toLocaleString()}</span>
                ) : (
                  <span>—</span>
                )}
              </Link>
              
              {/* Theme Toggle */}
            <ThemeToggle />

              {/* Auth Button */}
            {isAuthenticated ? (
                <div className='flex h-10 items-center'>
              <UserMenu />
                </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                  className='bg-primary text-primary-foreground hover:bg-primary/90 flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium transition duration-200'
                  aria-label='Sign In'
              >
                Sign In
              </button>
            )}
            </div>

            {/* Mobile: Dropdown Menu */}
            <div className='relative sm:hidden' ref={menuRef}>
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className='border-border bg-card/50 hover:bg-card/80 text-card-foreground flex h-9 w-9 items-center justify-center rounded-lg border transition'
                aria-label='Menu'
                aria-expanded={showMobileMenu}
              >
                {showMobileMenu ? (
                  <X className='h-5 w-5' />
                ) : (
                  <Menu className='h-5 w-5' />
                )}
              </button>

              {/* Mobile Dropdown */}
              {showMobileMenu && (
                <div className='border-border bg-card/95 absolute right-0 z-50 mt-2 w-56 rounded-lg border py-2 shadow-lg backdrop-blur-md'>
                  {/* GitHub Stars */}
                  <Link
                    href={`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    onClick={() => setShowMobileMenu(false)}
                    className='text-card-foreground hover:bg-accent flex items-center gap-3 px-4 py-2.5 transition-colors'
                  >
                    <div className='flex items-center gap-2'>
                      <Github className='h-4 w-4' />
                      <Star className='h-4 w-4 fill-yellow-400 text-yellow-400' />
                    </div>
                    <div className='flex-1'>
                      <div className='text-sm font-medium'>GitHub Stars</div>
                      {starsLoading ? (
                        <div className='text-muted-foreground h-4 w-12 animate-pulse rounded bg-muted text-xs' />
                      ) : stars !== null ? (
                        <div className='text-muted-foreground text-xs'>
                          {stars.toLocaleString()} stars
                        </div>
                      ) : (
                        <div className='text-muted-foreground text-xs'>—</div>
                      )}
                    </div>
                  </Link>

                  <div className='border-border my-1 border-t' />

                  {/* Theme Toggle */}
                  <div className='px-4 py-2'>
                    <div className='text-muted-foreground mb-2 text-xs font-medium uppercase'>
                      Theme
                    </div>
                    <ThemeToggle />
                  </div>

                  <div className='border-border my-1 border-t' />

                  {/* Sign In / User Menu */}
                  {isAuthenticated ? (
                    <div className='px-4 py-2'>
                      <UserMenu />
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setShowMobileMenu(false);
                        setShowAuthModal(true);
                      }}
                      className='bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition duration-200'
                    >
                      Sign In
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        </section>
      </nav>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </>
  );
}
