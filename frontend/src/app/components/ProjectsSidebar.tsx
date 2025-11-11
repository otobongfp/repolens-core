'use client';

import { useState, useEffect } from 'react';
import { useRepolensApi, Project } from '../utils/api';
import {
  FolderIcon,
  PlusIcon,
  GithubIcon,
  CloudIcon,
  HardDriveIcon,
  MoreVerticalIcon,
  TrashIcon,
  EditIcon,
  PlayIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
} from './LucideIcons';
import toast from 'react-hot-toast';

interface ProjectsSidebarProps {
  onProjectSelect?: (project: Project) => void;
  selectedProjectId?: string;
  onCreateProject?: () => void;
}

export default function ProjectsSidebar({
  onProjectSelect,
  selectedProjectId,
  onCreateProject,
}: ProjectsSidebarProps) {
  const { getProjects, deleteProject, analyzeProject } = useRepolensApi();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getProjects();
      const projectsList = response?.projects || [];
      setProjects(projectsList);
    } catch (err) {
      setError('Failed to load projects');
      console.error('Failed to load projects:', err);
      setProjects([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (
    projectId: string,
    projectName: string,
  ) => {
    toast(
      (t) => (
        <div className='flex flex-col gap-2'>
          <span>Are you sure you want to delete "{projectName}"?</span>
          <div className='flex gap-2'>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                performDeleteProject(projectId);
              }}
              className='text-primary-foreground rounded bg-red-500 px-3 py-1 text-xs transition hover:bg-red-600'
            >
              Yes, Delete
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
        duration: 10000,
        style: {
          background: 'var(--card)',
          color: 'var(--card-foreground)',
          border: '1px solid var(--border)',
          minWidth: '300px',
        },
      },
    );
  };

  const performDeleteProject = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      await loadProjects();
      toast.success('Project deleted successfully');
    } catch (err) {
      toast.error('Failed to delete project');
      console.error('Failed to delete project:', err);
    }
  };

  const handleAnalyzeProject = async (projectId: string) => {
    try {
      await analyzeProject(projectId);
      toast.success('Analysis started successfully');
      await loadProjects(); // Refresh to show updated status
    } catch (err) {
      toast.error('Failed to start analysis');
      console.error('Failed to start analysis:', err);
    }
  };

  const getProjectIcon = (project: Project) => {
    switch (project.source_config.type) {
      case 'github':
        return <GithubIcon className='h-4 w-4' />;
      case 'local':
      default:
        return <HardDriveIcon className='h-4 w-4' />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircleIcon className='h-4 w-4 text-green-500' />;
      case 'analyzing':
        return <ClockIcon className='h-4 w-4 text-blue-500' />;
      case 'completed':
        return <CheckCircleIcon className='h-4 w-4 text-green-500' />;
      case 'error':
        return <XCircleIcon className='h-4 w-4 text-red-500' />;
      case 'cloning':
        return <ClockIcon className='h-4 w-4 text-yellow-500' />;
      default:
        return <AlertCircleIcon className='h-4 w-4 text-gray-500' />;
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <aside className='bg-sidebar flex h-full w-80 min-w-[18rem] flex-col border-r border-white/10 p-4 shadow-xl'>
        <div className='flex h-32 items-center justify-center'>
          <div className='border-primary h-8 w-8 animate-spin rounded-full border-b-2'></div>
        </div>
        <p className='text-center text-gray-400'>Loading projects...</p>
      </aside>
    );
  }

  return (
    <aside className='bg-sidebar flex h-full w-80 min-w-[18rem] flex-col border-r border-white/10 p-4 shadow-xl'>
      {/* Header */}
      <div className='mb-4'>
        <h2 className='text-primary mb-2 text-lg font-bold'>Projects</h2>
        <button
          onClick={onCreateProject}
          className='bg-primary hover:bg-primary/80 text-primary-foreground flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 font-semibold transition'
        >
          <PlusIcon className='h-4 w-4' />
          Add New Project
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className='mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3'>
          <p className='text-sm text-red-400'>{error}</p>
          <button
            onClick={loadProjects}
            className='mt-1 text-xs text-red-400 underline hover:text-red-300'
          >
            Retry
          </button>
        </div>
      )}

      {/* Projects List */}
      <div className='flex-1 overflow-auto'>
        {!projects || projects.length === 0 ? (
          <div className='py-8 text-center'>
            <FolderIcon className='mx-auto mb-3 h-12 w-12 text-gray-400' />
            <p className='mb-2 text-sm text-gray-400'>No projects yet</p>
            <p className='text-xs text-gray-500'>
              Create your first project to get started with code analysis
            </p>
          </div>
        ) : (
          <div className='space-y-2'>
            {projects && projects.length > 0 && projects.map((project) => (
              <div
                key={project.project_id}
                className={`bg-background/80 rounded-lg border border-white/5 p-3 shadow-sm transition-all ${
                  selectedProjectId === project.project_id
                    ? 'border-primary/50 bg-primary/5'
                    : 'hover:bg-background/90'
                }`}
              >
                {/* Project Header */}
                <div className='mb-2 flex items-start justify-between'>
                  <div className='flex min-w-0 flex-1 items-center gap-2'>
                    {getProjectIcon(project)}
                    <div className='min-w-0 flex-1'>
                      <h3 className='truncate text-sm font-medium text-white'>
                        {project.name}
                      </h3>
                      <p className='truncate text-xs text-gray-400'>
                        {project.source_config.type === 'github'
                          ? project.source_config.github_url
                          : project.source_config.local_path}
                      </p>
                    </div>
                  </div>

                  {/* Project Actions */}
                  <div className='flex items-center gap-1'>
                    {getStatusIcon(project.status)}
                    <button
                      onClick={() =>
                        setExpandedProject(
                          expandedProject === project.project_id
                            ? null
                            : project.project_id,
                        )
                      }
                      className='p-1 text-gray-400 hover:text-white'
                    >
                      <MoreVerticalIcon className='h-4 w-4' />
                    </button>
                  </div>
                </div>

                {/* Project Status */}
                <div className='mb-2 flex items-center justify-between text-xs text-gray-400'>
                  <span className='capitalize'>{project.status}</span>
                  <span>{project.analysis_count} analyses</span>
                </div>

                {/* Expanded Details */}
                {expandedProject === project.project_id && (
                  <div className='mt-2 space-y-2 border-t border-white/5 pt-2'>
                    {/* Project Info */}
                    <div className='space-y-1 text-xs text-gray-400'>
                      {project.description && (
                        <p className='text-gray-300'>{project.description}</p>
                      )}
                      <div className='flex justify-between'>
                        <span>Files: {project.file_count || 'Unknown'}</span>
                        <span>Size: {formatBytes(project.size_bytes)}</span>
                      </div>
                      <div className='flex justify-between'>
                        <span>Created: {formatDate(project.created_at)}</span>
                        {project.last_analyzed && (
                          <span>
                            Last analyzed: {formatDate(project.last_analyzed)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className='flex gap-2 pt-2'>
                      <button
                        onClick={() => onProjectSelect?.(project)}
                        className='bg-primary hover:bg-primary/80 text-primary-foreground flex flex-1 items-center justify-center gap-1 rounded px-3 py-1 text-xs font-medium transition'
                      >
                        <PlayIcon className='h-3 w-3' />
                        Select
                      </button>

                      {project.status === 'ready' && (
                        <button
                          onClick={() =>
                            handleAnalyzeProject(project.project_id)
                          }
                          className='flex items-center justify-center gap-1 rounded bg-blue-500 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-600'
                        >
                          <PlayIcon className='h-3 w-3' />
                          Analyze
                        </button>
                      )}

                      <button
                        onClick={() =>
                          handleDeleteProject(project.project_id, project.name)
                        }
                        className='flex items-center justify-center gap-1 rounded bg-red-500 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-600'
                      >
                        <TrashIcon className='h-3 w-3' />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className='mt-4 border-t border-white/5 pt-3'>
        <div className='text-center text-xs text-gray-400'>
          {projects?.length || 0} project{(projects?.length || 0) !== 1 ? 's' : ''} total
        </div>
      </div>
    </aside>
  );
}
