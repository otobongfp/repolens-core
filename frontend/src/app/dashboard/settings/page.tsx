'use client';

export const runtime = 'edge';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  useRepolensApi,
  EnvironmentConfig,
  UserSettings,
} from '../../utils/api';
import { useApi } from '../../context/ApiProvider';
import {
  SettingsIcon,
  KeyIcon,
  CloudIcon,
  DatabaseIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  RefreshIcon,
} from '../../components/LucideIcons';

export default function SettingsPage() {
  const {
    clearCache,
    getCacheStats,
    getSettings,
    updateSettings,
    testConnection,
    getEnvironmentInfo,
  } = useRepolensApi();
  const { useLocalBackend, setUseLocalBackend, isInitialized } = useApi();
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [aiModel, setAiModel] = useState('gpt-4');

  // Environment settings state
  const [envSettings, setEnvSettings] = useState<EnvironmentConfig>({
    openai_api_key: '',
    aws_access_key_id: '',
    aws_secret_access_key: '',
    aws_region: 'us-east-1',
    s3_bucket: '',
    use_local_backend: true,
    backend_url: 'http://localhost:4000',
  });
  const [connectionTestResults, setConnectionTestResults] = useState<any>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [envInfo, setEnvInfo] = useState<any>(null);

  // Load saved settings on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('openai_api_key');
    const savedModel = localStorage.getItem('ai_model');
    if (savedKey) setOpenaiKey(savedKey);
    if (savedModel) setAiModel(savedModel);

    // Load environment settings
    loadEnvironmentSettings();
    loadEnvironmentInfo();
  }, []);

  const loadEnvironmentSettings = async () => {
    try {
      const settings = await getSettings();
      setEnvSettings(settings.environment_config);
    } catch (error) {
      console.error('Failed to load environment settings:', error);
    }
  };

  const loadEnvironmentInfo = async () => {
    try {
      const info = await getEnvironmentInfo();
      setEnvInfo(info);
    } catch (error) {
      console.error('Failed to load environment info:', error);
    }
  };

  const saveEnvironmentSettings = async () => {
    try {
      await updateSettings({
        environment_config: envSettings,
        tenant_id: 'tenant_123', // TODO: Get from context
      });
      toast.success('Environment settings saved successfully');
    } catch (error) {
      toast.error('Failed to save environment settings');
      console.error('Failed to save environment settings:', error);
    }
  };

  const testConnections = async () => {
    setTestingConnection(true);
    try {
      const results = await testConnection();
      setConnectionTestResults(results);
      toast.success('Connection test completed');
    } catch (error) {
      toast.error('Connection test failed');
      console.error('Connection test failed:', error);
    } finally {
      setTestingConnection(false);
    }
  };

  const getConnectionStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className='h-4 w-4 text-green-500' />;
      case 'error':
        return <XCircleIcon className='h-4 w-4 text-red-500' />;
      case 'not_configured':
        return <AlertCircleIcon className='h-4 w-4 text-gray-500' />;
      default:
        return <AlertCircleIcon className='h-4 w-4 text-gray-500' />;
    }
  };

  const saveAISettings = () => {
    localStorage.setItem('openai_api_key', openaiKey);
    localStorage.setItem('ai_model', aiModel);
    toast.success('AI settings saved successfully');
  };

  const loadCacheStats = async (showToast = false) => {
    setLoading(true);
    try {
      const stats = await getCacheStats();
      setCacheStats(stats);
      if (showToast) {
        toast.success('Cache stats loaded');
      }
    } catch (error) {
      console.error('Failed to load cache stats:', error);
      if (showToast) {
        toast.error('Failed to load cache stats');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    // Show a toast with confirmation action
    toast(
      (t) => (
        <div className='flex flex-col gap-2'>
          <span>Are you sure you want to clear all cached data?</span>
          <div className='flex gap-2'>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                performClearCache();
              }}
              className='rounded bg-red-500 px-3 py-1 text-xs text-white transition hover:bg-red-600'
            >
              Yes, Clear Cache
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              className='rounded bg-gray-500 px-3 py-1 text-xs text-white transition hover:bg-gray-600'
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
    setLoading(true);
    try {
      await clearCache();
      await loadCacheStats();
      toast.success('Cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toast.error('Failed to clear cache');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex min-h-[60vh] flex-col items-center justify-center'>
      {/* Header */}
      <div className='mb-8 text-center'>
        <h1 className='text-foreground mb-2 font-serif text-3xl font-bold tracking-tighter md:text-4xl'>
          Settings
        </h1>
        <p className='text-muted-foreground max-w-xl text-sm md:text-base'>
          Manage your RepoLens preferences and data
        </p>
      </div>

      {/* Settings Content */}
      <div className='w-full max-w-2xl space-y-6'>
        {/* API Mode Settings */}
        <div className='rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md'>
          <h3 className='text-foreground mb-4 text-lg font-semibold'>
            API Mode
          </h3>
          <p className='text-muted-foreground mb-4 text-sm'>
            Choose between local backend or cloud API for repository analysis
          </p>

          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div>
                <div className='text-foreground font-medium'>
                  {useLocalBackend ? 'Local Backend' : 'Cloud API'}
                </div>
                <div className='text-muted-foreground text-sm'>
                  {useLocalBackend
                    ? 'Using local Python backend (port 8000)'
                    : 'Using cloud API'}
                </div>
                {!isInitialized && (
                  <div className='text-xs text-yellow-400'>
                    Loading preference...
                  </div>
                )}
              </div>
              <button
                onClick={() => setUseLocalBackend(!useLocalBackend)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  useLocalBackend ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    useLocalBackend ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className='rounded-lg border border-white/10 bg-white/5 p-3'>
              <div className='text-muted-foreground text-xs'>
                <strong>Local Backend:</strong> Fast parsing, works offline,
                requires local setup
                <br />
                <strong>Cloud API:</strong> Full AI analysis, requires internet
                connection
              </div>
            </div>
          </div>
        </div>

        {/* Environment Configuration */}
        <div className='rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md'>
          <h3 className='text-foreground mb-4 flex items-center gap-2 text-lg font-semibold'>
            <SettingsIcon className='h-5 w-5' />
            Environment Configuration
          </h3>
          <p className='text-muted-foreground mb-4 text-sm'>
            {useLocalBackend
              ? 'Configure your own API keys and services for cost control and security'
              : 'Override default cloud services with your own API keys (optional)'}
          </p>

          <div className='space-y-6'>
            {/* Backend Mode Info */}
            <div className='rounded-lg border border-white/10 bg-white/5 p-4'>
              <h4 className='text-foreground mb-2 text-sm font-medium'>
                Current Mode: {useLocalBackend ? 'Local Backend' : 'Cloud API'}
              </h4>
              <p className='text-muted-foreground text-xs'>
                {useLocalBackend
                  ? "You're using your local backend. Configure API keys below to control costs."
                  : "You're using cloud API. Configure API keys below to override our defaults."}
              </p>
              <div className='text-muted-foreground mt-2 text-xs'>
                Debug: localStorage ={' '}
                {typeof window !== 'undefined'
                  ? localStorage.getItem('useLocalBackend')
                  : 'N/A'}
                , Initialized = {isInitialized ? 'Yes' : 'No'}
              </div>
            </div>
            {/* OpenAI Configuration */}
            <div className='space-y-3'>
              <h4 className='text-foreground flex items-center gap-2 text-sm font-medium'>
                <KeyIcon className='h-4 w-4' />
                OpenAI API
                {!useLocalBackend && (
                  <span className='text-muted-foreground text-xs'>
                    (Optional - overrides cloud default)
                  </span>
                )}
              </h4>
              <div>
                <label className='text-muted-foreground mb-1 block text-xs'>
                  OpenAI API Key
                  {useLocalBackend && <span className='text-red-400'> *</span>}
                </label>
                <input
                  type='password'
                  value={envSettings.openai_api_key || ''}
                  onChange={(e) =>
                    setEnvSettings({
                      ...envSettings,
                      openai_api_key: e.target.value,
                    })
                  }
                  placeholder={
                    useLocalBackend ? 'sk-... (required)' : 'sk-... (optional)'
                  }
                  className='focus:border-primary w-full rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white placeholder-gray-400 focus:outline-none'
                />
                <p className='text-muted-foreground mt-1 text-xs'>
                  {useLocalBackend
                    ? 'Required for AI analysis with local backend'
                    : 'Optional - leave empty to use our cloud OpenAI key'}
                </p>
              </div>
            </div>

            {/* AWS Configuration */}
            <div className='space-y-3'>
              <h4 className='text-foreground flex items-center gap-2 text-sm font-medium'>
                <CloudIcon className='h-4 w-4' />
                AWS S3 Storage
                {!useLocalBackend && (
                  <span className='text-muted-foreground text-xs'>
                    (Optional - overrides cloud default)
                  </span>
                )}
              </h4>
              <p className='text-muted-foreground text-xs'>
                {useLocalBackend
                  ? 'Required for storing analysis results with local backend'
                  : 'Optional - leave empty to use our cloud S3 storage'}
              </p>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='text-muted-foreground mb-1 block text-xs'>
                    Access Key ID
                  </label>
                  <input
                    type='text'
                    value={envSettings.aws_access_key_id || ''}
                    onChange={(e) =>
                      setEnvSettings({
                        ...envSettings,
                        aws_access_key_id: e.target.value,
                      })
                    }
                    placeholder='AKIA...'
                    className='focus:border-primary w-full rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white placeholder-gray-400 focus:outline-none'
                  />
                </div>
                <div>
                  <label className='text-muted-foreground mb-1 block text-xs'>
                    Secret Access Key
                  </label>
                  <input
                    type='password'
                    value={envSettings.aws_secret_access_key || ''}
                    onChange={(e) =>
                      setEnvSettings({
                        ...envSettings,
                        aws_secret_access_key: e.target.value,
                      })
                    }
                    placeholder='Secret key...'
                    className='focus:border-primary w-full rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white placeholder-gray-400 focus:outline-none'
                  />
                </div>
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='text-muted-foreground mb-1 block text-xs'>
                    Region
                  </label>
                  <input
                    type='text'
                    value={envSettings.aws_region || 'us-east-1'}
                    onChange={(e) =>
                      setEnvSettings({
                        ...envSettings,
                        aws_region: e.target.value,
                      })
                    }
                    placeholder='us-east-1'
                    className='focus:border-primary w-full rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white placeholder-gray-400 focus:outline-none'
                  />
                </div>
                <div>
                  <label className='text-muted-foreground mb-1 block text-xs'>
                    S3 Bucket
                  </label>
                  <input
                    type='text'
                    value={envSettings.s3_bucket || ''}
                    onChange={(e) =>
                      setEnvSettings({
                        ...envSettings,
                        s3_bucket: e.target.value,
                      })
                    }
                    placeholder='my-bucket'
                    className='focus:border-primary w-full rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white placeholder-gray-400 focus:outline-none'
                  />
                </div>
              </div>
            </div>


            {/* Backend Configuration */}
            <div className='space-y-3'>
              <h4 className='text-foreground text-sm font-medium'>
                Backend Configuration
              </h4>
              <div className='flex items-center justify-between'>
                <div>
                  <div className='text-foreground text-sm font-medium'>
                    Use Local Backend
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    Use local Python backend instead of cloud services
                  </div>
                </div>
                <button
                  onClick={() =>
                    setEnvSettings({
                      ...envSettings,
                      use_local_backend: !envSettings.use_local_backend,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    envSettings.use_local_backend ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      envSettings.use_local_backend
                        ? 'translate-x-6'
                        : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div>
                <label className='text-muted-foreground mb-1 block text-xs'>
                  Backend URL
                </label>
                <input
                  type='text'
                  value={envSettings.backend_url || 'http://localhost:8000'}
                  onChange={(e) =>
                    setEnvSettings({
                      ...envSettings,
                      backend_url: e.target.value,
                    })
                  }
                  placeholder='http://localhost:8000'
                  className='focus:border-primary w-full rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white placeholder-gray-400 focus:outline-none'
                />
              </div>
            </div>

            {/* Connection Test */}
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <h4 className='text-foreground text-sm font-medium'>
                  Connection Test
                </h4>
                <button
                  onClick={testConnections}
                  disabled={testingConnection}
                  className='flex items-center gap-2 rounded-lg bg-blue-500 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-600 disabled:opacity-50'
                >
                  <RefreshIcon
                    className={`h-3 w-3 ${testingConnection ? 'animate-spin' : ''}`}
                  />
                  {testingConnection ? 'Testing...' : 'Test Connections'}
                </button>
              </div>

              {connectionTestResults && (
                <div className='space-y-2 rounded-lg border border-white/10 bg-white/5 p-3'>
                  {Object.entries(connectionTestResults.results || {}).map(
                    ([service, result]: [string, any]) => (
                      <div
                        key={service}
                        className='flex items-center justify-between text-xs'
                      >
                        <span className='text-muted-foreground capitalize'>
                          {service}
                        </span>
                        <div className='flex items-center gap-2'>
                          {getConnectionStatusIcon(result.status)}
                          <span
                            className={`text-xs ${
                              result.status === 'success'
                                ? 'text-green-400'
                                : result.status === 'error'
                                  ? 'text-red-400'
                                  : 'text-gray-400'
                            }`}
                          >
                            {result.message}
                          </span>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>

            {/* Save Button */}
            <button
              onClick={saveEnvironmentSettings}
              className='bg-primary hover:bg-primary/80 w-full rounded-lg px-4 py-2 text-sm font-semibold text-white transition'
            >
              Save Environment Settings
            </button>
          </div>
        </div>

        {/* Cache Management */}
        <div className='rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md'>
          <h3 className='text-foreground mb-4 text-lg font-semibold'>
            Cache Management
          </h3>
          <p className='text-muted-foreground mb-4 text-sm'>
            Manage cached repository analysis data to free up storage space
          </p>

          <div className='space-y-4'>
            <button
              onClick={() => loadCacheStats(true)}
              disabled={loading}
              className='bg-primary hover:bg-primary/80 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50'
            >
              {loading ? 'Loading...' : 'Check Cache Status'}
            </button>

            {cacheStats && (
              <div className='rounded-lg border border-white/10 bg-white/5 p-4'>
                <h4 className='text-foreground mb-2 font-medium'>
                  Cache Statistics
                </h4>
                <div className='space-y-1 text-sm text-gray-300'>
                  <p>Cached repositories: {cacheStats.count}</p>
                  <p>Total size: {cacheStats.totalSize || 'Unknown'}</p>
                </div>
              </div>
            )}

            <button
              onClick={handleClearCache}
              disabled={loading}
              className='rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50'
            >
              {loading ? 'Clearing...' : 'Clear All Cache'}
            </button>
          </div>
        </div>

        {/* AI Settings */}
        <div className='rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md'>
          <h3 className='text-foreground mb-4 text-lg font-semibold'>
            AI Settings
          </h3>
          <p className='text-muted-foreground mb-4 text-sm'>
            Configure AI analysis preferences and API settings
          </p>

          <div className='space-y-4'>
            <div>
              <label className='text-foreground mb-2 block text-sm font-medium'>
                OpenAI API Key
              </label>
              <input
                type='password'
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder='sk-...'
                className='focus:border-primary w-full rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder-gray-400 focus:outline-none'
              />
              <p className='text-muted-foreground mt-1 text-xs'>
                Your API key is stored locally and never shared
              </p>
            </div>

            <div>
              <label className='text-foreground mb-2 block text-sm font-medium'>
                AI Model
              </label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className='focus:border-primary w-full rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white focus:outline-none'
              >
                <option value='gpt-4'>GPT-4</option>
                <option value='gpt-3.5-turbo'>GPT-3.5 Turbo</option>
              </select>
            </div>

            <button
              onClick={saveAISettings}
              className='bg-primary hover:bg-primary/80 rounded-lg px-4 py-2 text-sm font-semibold text-white transition'
            >
              Save AI Settings
            </button>
          </div>
        </div>

        {/* About */}
        <div className='rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md'>
          <h3 className='text-foreground mb-4 text-lg font-semibold'>
            About RepoLens
          </h3>
          <div className='space-y-2 text-sm text-gray-300'>
            <p>Version: 1.0.0</p>
            <p>Built with Next.js, FastAPI, and Rust</p>
            <p>Open source educational platform</p>
          </div>
        </div>
      </div>
    </div>
  );
}
