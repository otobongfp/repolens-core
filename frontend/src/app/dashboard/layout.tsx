'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  CodeIcon,
  PuzzleIcon,
  BrainIcon,
  BotIcon,
  SettingsIcon,
  MenuIcon,
  XIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DatabaseIcon,
  FolderIcon,
} from '../components/LucideIcons';
import { useRepolensApi } from '../utils/api';
import { useApi } from '../context/ApiProvider';
import ProtectedRoute from '../components/ProtectedRoute';
import DashboardNavbar from '../components/DashboardNavbar';

interface SidebarItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  route: string;
  disabled?: boolean;
}

const sidebarItems: SidebarItem[] = [
  {
    id: 'projects',
    title: 'Projects',
    icon: <FolderIcon className='h-5 w-5' />,
    route: '/dashboard/projects',
  },
  {
    id: 'analyze',
    title: 'Analyze Repo',
    icon: <CodeIcon className='h-5 w-5' />,
    route: '/dashboard/analyze',
  },
  {
    id: 'requirements',
    title: 'Match Requirements',
    icon: <PuzzleIcon className='h-5 w-5' />,
    route: '/dashboard/requirements',
  },
  {
    id: 'learning',
    title: 'Micro Learning',
    icon: <BrainIcon className='h-5 w-5' />,
    route: '/dashboard/learning',
    disabled: true,
  },
  {
    id: 'ai-assistant',
    title: 'Ask AI',
    icon: <BotIcon className='h-5 w-5' />,
    route: '/dashboard/ai-assistant',
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: <SettingsIcon className='h-5 w-5' />,
    route: '/dashboard/settings',
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cacheExpanded, setCacheExpanded] = useState(false);
  const [cacheStats, setCacheStats] = useState<{
    count: number;
    size: number;
  } | null>(null);
  const [cacheLoading, setCacheLoading] = useState(false);
  const pathname = usePathname();
  const { getCacheStats, clearCache } = useRepolensApi();
  const { useLocalBackend, setUseLocalBackend } = useApi();

  // Close sidebar on mobile when route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Load cache stats on mount
  useEffect(() => {
    loadCacheStats();
  }, []);

  const loadCacheStats = async (showToast = false) => {
    try {
      const stats = await getCacheStats();
      setCacheStats(stats);
      if (showToast) {
        toast.success('Cache stats refreshed');
      }
    } catch (error) {
      console.error('Failed to load cache stats:', error);
      if (showToast) {
        toast.error('Failed to load cache stats');
      }
    }
  };

  const handleClearCache = async () => {
    toast(
      (t) => (
        <div className='flex flex-col gap-2'>
          <span>
            Are you sure you want to clear all cached repository data?
          </span>
          <div className='flex gap-2'>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                performClearCache();
              }}
              className='text-primary-foreground rounded bg-red-500 px-3 py-1 text-xs transition hover:bg-red-600'
            >
              Yes, Clear Cache
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              className='text-primary-foreground rounded bg-gray-500 px-3 py-1 text-xs transition hover:bg-gray-600'
            >
              Cancel
            </button>
          </div>
        </div>
      ),
      {
        duration: 10000, // Keep it open longer for user to decide
        style: {
          background: 'var(--card)',
          color: 'var(--card-foreground)',
          border: '1px solid var(--border)',
          minWidth: '300px',
        },
      },
    );
  };

  const performClearCache = async () => {
    setCacheLoading(true);
    try {
      await clearCache();
      await loadCacheStats();
      toast.success('Cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toast.error('Failed to clear cache');
    } finally {
      setCacheLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <ProtectedRoute>
      <DashboardNavbar />
      <div className='bg-sidebar flex min-h-screen pt-16'>
        {/* Mobile sidebar toggle */}
        <button
          className='bg-primary/90 text-primary-foreground fixed top-20 left-4 z-50 flex h-11 w-11 items-center justify-center rounded-lg shadow-lg md:hidden'
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        >
          {sidebarOpen ? (
            <XIcon className='h-5 w-5' />
          ) : (
            <MenuIcon className='h-5 w-5' />
          )}
        </button>

        {/* Sidebar overlay for mobile */}
        {sidebarOpen && (
          <div
            className='fixed inset-0 z-40 bg-black/50 md:hidden'
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Desktop Sidebar - Fixed */}
        <aside className='bg-card/50 border-border fixed top-16 left-0 hidden h-[calc(100vh-4rem)] w-64 flex-col border-r backdrop-blur-md md:flex'>
          {/* Sidebar Header */}
          <div className='border-border border-b p-6'>
            <Link href='/select' className='flex items-center gap-3'>
              <div className='bg-primary rounded-lg p-2'>
                <CodeIcon className='text-primary-foreground h-6 w-6' />
              </div>
              <div>
                <h2 className='text-card-foreground text-lg font-bold'>
                  RepoLens
                </h2>
                <p className='text-muted-foreground text-xs'>Dashboard</p>
              </div>
            </Link>
          </div>

          {/* Navigation Items */}
          <nav className='flex-1 p-4'>
            <ul className='space-y-2'>
              {sidebarItems.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.disabled ? '#' : item.route}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      pathname === item.route
                        ? 'bg-primary text-primary-foreground'
                        : item.disabled
                          ? 'text-muted-foreground cursor-not-allowed opacity-50'
                          : 'text-muted-foreground hover:text-card-foreground hover:bg-accent'
                    }`}
                    onClick={
                      item.disabled ? (e) => e.preventDefault() : undefined
                    }
                  >
                    {item.icon}
                    <span>{item.title}</span>
                    {item.disabled && (
                      <span className='text-primary-foreground ml-auto rounded-full bg-orange-500 px-2 py-0.5 text-xs'>
                        Soon
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Cache Manager */}
          <div className='border-border border-t p-4'>
            <button
              onClick={() => setCacheExpanded(!cacheExpanded)}
              className='text-muted-foreground hover:text-card-foreground flex w-full items-center justify-between text-sm transition-colors'
            >
              <div className='flex items-center gap-2'>
                <DatabaseIcon className='h-4 w-4' />
                <span>Cache Manager</span>
              </div>
              {cacheExpanded ? (
                <ChevronUpIcon className='h-4 w-4' />
              ) : (
                <ChevronDownIcon className='h-4 w-4' />
              )}
            </button>

            {cacheExpanded && (
              <div className='mt-3 space-y-3'>
                {cacheStats && (
                  <div className='text-muted-foreground text-xs'>
                    <div>Cached repos: {cacheStats.count}</div>
                    <div>Size: {formatBytes(cacheStats.size)}</div>
                  </div>
                )}

                <div className='flex gap-2'>
                  <button
                    onClick={() => loadCacheStats(true)}
                    className='bg-accent text-accent-foreground hover:bg-accent/80 rounded px-2 py-1 text-xs transition'
                  >
                    Refresh
                  </button>
                  <button
                    onClick={handleClearCache}
                    disabled={cacheLoading}
                    className='text-primary-foreground rounded bg-red-500/80 px-2 py-1 text-xs transition hover:bg-red-500 disabled:opacity-50'
                  >
                    {cacheLoading ? 'Clearing...' : 'Clear'}
                  </button>
                </div>

                <div className='text-muted-foreground text-xs'>
                  Cache expires after 24 hours
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Footer */}
          <div className='border-border border-t p-4'>
            <Link
              href='/select'
              className='text-muted-foreground hover:text-card-foreground flex items-center gap-2 text-sm transition-colors'
            >
              <span>← Back to Features</span>
            </Link>
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className='fixed inset-0 z-40 md:hidden'>
            <div
              className='fixed inset-0 bg-black/50'
              onClick={() => setSidebarOpen(false)}
            />
            <div className='bg-card/50 fixed top-0 left-0 h-full w-64 backdrop-blur-md'>
              <div className='flex h-full flex-col'>
                {/* Sidebar Header */}
                <div className='border-border border-b p-6'>
                  <Link
                    href='/select'
                    className='flex items-center gap-3'
                    onClick={() => setSidebarOpen(false)}
                  >
                    <div className='bg-primary rounded-lg p-2'>
                      <CodeIcon className='text-primary-foreground h-6 w-6' />
                    </div>
                    <div>
                      <h2 className='text-card-foreground text-lg font-bold'>
                        RepoLens
                      </h2>
                      <p className='text-muted-foreground text-xs'>Dashboard</p>
                    </div>
                  </Link>
                </div>

                {/* Navigation Items */}
                <nav className='flex-1 p-4'>
                  <ul className='space-y-2'>
                    {sidebarItems.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={item.disabled ? '#' : item.route}
                          className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            pathname === item.route
                              ? 'bg-primary text-primary-foreground'
                              : item.disabled
                                ? 'text-muted-foreground cursor-not-allowed opacity-50'
                                : 'text-muted-foreground hover:text-card-foreground hover:bg-accent'
                          }`}
                          onClick={
                            item.disabled
                              ? (e) => e.preventDefault()
                              : () => setSidebarOpen(false)
                          }
                        >
                          {item.icon}
                          <span>{item.title}</span>
                          {item.disabled && (
                            <span className='text-primary-foreground ml-auto rounded-full bg-orange-500 px-2 py-0.5 text-xs'>
                              Soon
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>

                {/* Cache Manager */}
                <div className='border-border border-t p-4'>
                  <button
                    onClick={() => setCacheExpanded(!cacheExpanded)}
                    className='text-muted-foreground hover:text-card-foreground flex w-full items-center justify-between text-sm transition-colors'
                  >
                    <div className='flex items-center gap-2'>
                      <DatabaseIcon className='h-4 w-4' />
                      <span>Cache Manager</span>
                    </div>
                    {cacheExpanded ? (
                      <ChevronUpIcon className='h-4 w-4' />
                    ) : (
                      <ChevronDownIcon className='h-4 w-4' />
                    )}
                  </button>

                  {cacheExpanded && (
                    <div className='mt-3 space-y-3'>
                      {cacheStats && (
                        <div className='text-muted-foreground text-xs'>
                          <div>Cached repos: {cacheStats.count}</div>
                          <div>Size: {formatBytes(cacheStats.size)}</div>
                        </div>
                      )}

                      <div className='flex gap-2'>
                        <button
                          onClick={() => loadCacheStats(true)}
                          className='bg-accent text-accent-foreground hover:bg-accent/80 rounded px-2 py-1 text-xs transition'
                        >
                          Refresh
                        </button>
                        <button
                          onClick={handleClearCache}
                          disabled={cacheLoading}
                          className='text-primary-foreground rounded bg-red-500/80 px-2 py-1 text-xs transition hover:bg-red-500 disabled:opacity-50'
                        >
                          {cacheLoading ? 'Clearing...' : 'Clear'}
                        </button>
                      </div>

                      <div className='text-muted-foreground text-xs'>
                        Cache expires after 24 hours
                      </div>
                    </div>
                  )}
                </div>

                {/* Sidebar Footer */}
                <div className='border-border border-t p-4'>
                  <Link
                    href='/select'
                    className='text-muted-foreground hover:text-card-foreground flex items-center gap-2 text-sm transition-colors'
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span>← Back to Features</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content - Scrollable */}
        <main className='ml-0 flex flex-1 flex-col overflow-auto md:ml-64'>
          <div className='flex-1 p-4 sm:p-6'>{children}</div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
