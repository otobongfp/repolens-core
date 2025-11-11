'use client';

import { useState } from 'react';
import { useRepolensApi, ProjectCreateRequest } from '../utils/api';
import { useAuth } from '../context/AuthProvider';
import {
  XIcon,
  FolderIcon,
  GithubIcon,
  CloudIcon,
  HardDriveIcon,
  CheckIcon,
  AlertCircleIcon,
} from './LucideIcons';
import toast from 'react-hot-toast';

interface ProjectCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: any) => void;
}

type SourceType = 'local' | 'github';

export default function ProjectCreationModal({
  isOpen,
  onClose,
  onProjectCreated,
}: ProjectCreationModalProps) {
  const { user } = useAuth();
  const { createProject } = useRepolensApi();
  const [step, setStep] = useState(1);
  const [sourceType, setSourceType] = useState<SourceType>('local');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    local_path: '',
    github_url: '',
    branch: 'main',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setStep(1);
    setSourceType('local');
    setFormData({
      name: '',
      description: '',
      local_path: '',
      github_url: '',
      branch: 'main',
    });
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name.trim()) {
        setError('Project name is required');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const projectData: ProjectCreateRequest = {
        name: formData.name,
        description: formData.description || undefined,
        source_config: {
          type: sourceType,
          ...(sourceType === 'local' && { local_path: formData.local_path }),
          ...(sourceType === 'github' && { github_url: formData.github_url }),
          branch: formData.branch,
        },
      };

      const project = await createProject(projectData);
      toast.success('Project created successfully!');
      onProjectCreated(project);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      console.error('Failed to create project:', err);
    } finally {
      setLoading(false);
    }
  };

  const validateStep2 = () => {
    switch (sourceType) {
      case 'local':
        return formData.local_path.trim() !== '';
      case 'github':
        return formData.github_url.trim() !== '';
      default:
        return false;
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'>
      <div className='bg-card border-border mx-4 max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg border shadow-xl'>
        {/* Header */}
        <div className='border-border border-b p-6'>
          <div className='flex items-center justify-between'>
            <h2 className='text-card-foreground text-xl font-bold'>
              Create New Project
            </h2>
            <button
              onClick={handleClose}
              className='text-muted-foreground hover:text-card-foreground p-1'
            >
              <XIcon className='h-5 w-5' />
            </button>
          </div>
          <p className='text-muted-foreground mt-2 text-sm'>
            Step {step} of 3:{' '}
            {step === 1
              ? 'Basic Information'
              : step === 2
                ? 'Storage Configuration'
                : 'Review & Create'}
          </p>
        </div>

        {/* Content */}
        <div className='max-h-[60vh] overflow-y-auto p-6'>
          {error && (
            <div className='mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3'>
              <AlertCircleIcon className='h-4 w-4 text-red-500' />
              <p className='text-sm text-red-400'>{error}</p>
            </div>
          )}

          {/* Step 1: Basic Information */}
          {step === 1 && (
            <div className='space-y-4'>
              <div>
                <label className='text-card-foreground mb-2 block text-sm font-medium'>
                  Project Name *
                </label>
                <input
                  type='text'
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder='Enter project name'
                  className='border-border bg-background text-card-foreground focus:ring-primary w-full rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none'
                />
              </div>
              <div>
                <label className='text-card-foreground mb-2 block text-sm font-medium'>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder='Enter project description (optional)'
                  rows={3}
                  className='border-border bg-background text-card-foreground focus:ring-primary w-full resize-none rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none'
                />
              </div>
            </div>
          )}

          {/* Step 2: Source Configuration */}
          {step === 2 && (
            <div className='space-y-6'>
              <div>
                <label className='text-card-foreground mb-3 block text-sm font-medium'>
                  Source Type
                </label>
                <div className='grid grid-cols-2 gap-3'>
                  {[
                    {
                      type: 'local',
                      label: 'Local Path',
                      icon: HardDriveIcon,
                      desc: 'Local filesystem',
                    },
                    {
                      type: 'github',
                      label: 'GitHub Repo',
                      icon: GithubIcon,
                      desc: 'GitHub repository',
                    },
                  ].map(({ type, label, icon: Icon, desc }) => (
                    <button
                      key={type}
                      onClick={() => setSourceType(type as SourceType)}
                      className={`rounded-lg border p-4 transition-all ${
                        sourceType === type
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-primary/50 text-muted-foreground'
                      }`}
                    >
                      <Icon className='mx-auto mb-2 h-6 w-6' />
                      <div className='text-sm font-medium'>{label}</div>
                      <div className='text-xs opacity-75'>{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Local Path */}
              {sourceType === 'local' && (
                <div>
                  <label className='text-card-foreground mb-2 block text-sm font-medium'>
                    Local Path *
                  </label>
                  <input
                    type='text'
                    value={formData.local_path}
                    onChange={(e) =>
                      setFormData({ ...formData, local_path: e.target.value })
                    }
                    placeholder='/path/to/your/code'
                    className='border-border bg-background text-card-foreground focus:ring-primary w-full rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none'
                  />
                  <p className='text-muted-foreground mt-1 text-xs'>
                    Absolute path to your local code directory
                  </p>
                </div>
              )}

              {/* GitHub URL */}
              {sourceType === 'github' && (
                <div>
                  <label className='text-card-foreground mb-2 block text-sm font-medium'>
                    GitHub Repository URL *
                  </label>
                  <input
                    type='url'
                    value={formData.github_url}
                    onChange={(e) =>
                      setFormData({ ...formData, github_url: e.target.value })
                    }
                    placeholder='https://github.com/username/repository'
                    className='border-border bg-background text-card-foreground focus:ring-primary w-full rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none'
                  />
                  <div className='mt-3'>
                    <label className='text-card-foreground mb-2 block text-sm font-medium'>
                      Branch
                    </label>
                    <input
                      type='text'
                      value={formData.branch}
                      onChange={(e) =>
                        setFormData({ ...formData, branch: e.target.value })
                      }
                      placeholder='main'
                      className='border-border bg-background text-card-foreground focus:ring-primary w-full rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none'
                    />
                  </div>
                  <p className='text-muted-foreground mt-1 text-xs'>
                    Public or private repository URL
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className='space-y-4'>
              <h3 className='text-card-foreground font-medium'>
                Project Summary
              </h3>
              <div className='bg-background space-y-3 rounded-lg p-4'>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Name:</span>
                  <span className='text-card-foreground font-medium'>
                    {formData.name}
                  </span>
                </div>
                {formData.description && (
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Description:</span>
                    <span className='text-card-foreground'>
                      {formData.description}
                    </span>
                  </div>
                )}
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Source Type:</span>
                  <span className='text-card-foreground capitalize'>
                    {sourceType}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Location:</span>
                  <span className='text-card-foreground text-sm'>
                    {sourceType === 'local' && formData.local_path}
                    {sourceType === 'github' && formData.github_url}
                  </span>
                </div>
                {sourceType === 'github' && (
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Branch:</span>
                    <span className='text-card-foreground text-sm'>
                      {formData.branch}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='border-border border-t p-6'>
          <div className='flex justify-between'>
            <button
              onClick={handleBack}
              disabled={step === 1}
              className='text-muted-foreground hover:text-card-foreground px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50'
            >
              Back
            </button>

            <div className='flex gap-3'>
              <button
                onClick={handleClose}
                className='text-muted-foreground hover:text-card-foreground px-4 py-2'
              >
                Cancel
              </button>

              {step < 3 ? (
                <button
                  onClick={handleNext}
                  disabled={step === 2 && !validateStep2()}
                  className='bg-primary hover:bg-primary/80 text-primary-foreground rounded-lg px-4 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className='bg-primary hover:bg-primary/80 text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
                >
                  {loading ? (
                    <>
                      <div className='h-4 w-4 animate-spin rounded-full border-b-2 border-white'></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckIcon className='h-4 w-4' />
                      Create Project
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
