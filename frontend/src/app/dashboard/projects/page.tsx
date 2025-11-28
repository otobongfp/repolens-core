'use client';

export const runtime = 'edge';

import { useState } from 'react';
import { useRepolensApi, Project } from '../../utils/api';
import ProjectsSidebar from '../../components/ProjectsSidebar';
import ProjectCreationModal from '../../components/ProjectCreationModal';
import {
  FolderIcon,
  PlayIcon,
  BarChartIcon,
  ClockIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from '../../components/LucideIcons';

export default function ProjectsPage() {
  const { analyzeProject } = useRepolensApi();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
  };

  const handleProjectCreated = (project: Project) => {
    setSelectedProject(project);
    // Refresh the sidebar by triggering a re-render
    window.location.reload();
  };

  const handleAnalyzeProject = async () => {
    if (!selectedProject) return;

    try {
      setAnalysisLoading(true);
      await analyzeProject(selectedProject.project_id);
      // Refresh project data
      window.location.reload();
    } catch (error) {
      console.error('Failed to start analysis:', error);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'text-green-500';
      case 'analyzing':
        return 'text-blue-500';
      case 'completed':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      case 'cloning':
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircleIcon className='h-5 w-5 text-green-500' />;
      case 'analyzing':
        return <ClockIcon className='h-5 w-5 text-blue-500' />;
      case 'completed':
        return <CheckCircleIcon className='h-5 w-5 text-green-500' />;
      case 'error':
        return <AlertCircleIcon className='h-5 w-5 text-red-500' />;
      case 'cloning':
        return <ClockIcon className='h-5 w-5 text-yellow-500' />;
      default:
        return <AlertCircleIcon className='h-5 w-5 text-gray-500' />;
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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className='flex h-full'>
      {/* Projects Sidebar */}
      <ProjectsSidebar
        onProjectSelect={handleProjectSelect}
        selectedProjectId={selectedProject?.project_id}
        onCreateProject={() => setShowCreateModal(true)}
      />

      {/* Main Content */}
      <div className='flex flex-1 flex-col'>
        {selectedProject ? (
          <>
            {/* Project Header */}
            <div className='border-border bg-card/50 border-b p-6'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-4'>
                  <div className='bg-primary rounded-lg p-3'>
                    <FolderIcon className='text-primary-foreground h-6 w-6' />
                  </div>
                  <div>
                    <h1 className='text-card-foreground text-2xl font-bold'>
                      {selectedProject.name}
                    </h1>
                    <p className='text-muted-foreground'>
                      {selectedProject.description || 'No description provided'}
                    </p>
                  </div>
                </div>

                <div className='flex items-center gap-3'>
                  {getStatusIcon(selectedProject.status)}
                  <span
                    className={`font-medium capitalize ${getStatusColor(selectedProject.status)}`}
                  >
                    {selectedProject.status}
                  </span>

                  {selectedProject.status === 'ready' && (
                    <button
                      onClick={handleAnalyzeProject}
                      disabled={analysisLoading}
                      className='bg-primary hover:bg-primary/80 text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
                    >
                      {analysisLoading ? (
                        <>
                          <div className='h-4 w-4 animate-spin rounded-full border-b-2 border-white'></div>
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <PlayIcon className='h-4 w-4' />
                          Analyze Project
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Project Details */}
            <div className='flex-1 p-6'>
              <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
                {/* Project Information */}
                <div className='space-y-6 lg:col-span-2'>
                  <div className='bg-card border-border rounded-lg border p-6'>
                    <h2 className='text-card-foreground mb-4 text-lg font-semibold'>
                      Project Information
                    </h2>
                    <div className='grid grid-cols-2 gap-4'>
                      <div>
                        <label className='text-muted-foreground text-sm'>
                          Storage Type
                        </label>
                        <p className='text-card-foreground font-medium capitalize'>
                          {selectedProject.source_config.type}
                        </p>
                      </div>
                      <div>
                        <label className='text-muted-foreground text-sm'>
                          Files
                        </label>
                        <p className='text-card-foreground font-medium'>
                          {selectedProject.file_count || 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <label className='text-muted-foreground text-sm'>
                          Size
                        </label>
                        <p className='text-card-foreground font-medium'>
                          {formatBytes(selectedProject.size_bytes)}
                        </p>
                      </div>
                      <div>
                        <label className='text-muted-foreground text-sm'>
                          Analyses
                        </label>
                        <p className='text-card-foreground font-medium'>
                          {selectedProject.analysis_count}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className='bg-card border-border rounded-lg border p-6'>
                    <h2 className='text-card-foreground mb-4 text-lg font-semibold'>
                      Source Configuration
                    </h2>
                    <div className='space-y-3'>
                      <div>
                        <label className='text-muted-foreground text-sm'>
                          Location
                        </label>
                        <p className='text-card-foreground bg-background rounded border p-2 font-mono text-sm'>
                          {selectedProject.source_config.type === 'local' &&
                            selectedProject.source_config.local_path}
                          {selectedProject.source_config.type === 'github' &&
                            selectedProject.source_config.github_url}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Project Stats */}
                <div className='space-y-6'>
                  <div className='bg-card border-border rounded-lg border p-6'>
                    <h2 className='text-card-foreground mb-4 text-lg font-semibold'>
                      Project Stats
                    </h2>
                    <div className='space-y-4'>
                      <div className='flex items-center justify-between'>
                        <span className='text-muted-foreground'>Created</span>
                        <span className='text-card-foreground text-xs'>
                          {formatDate(selectedProject.created_at)}
                        </span>
                      </div>
                      <div className='flex items-center justify-between'>
                        <span className='text-muted-foreground'>Updated</span>
                        <span className='text-card-foreground text-xs'>
                          {formatDate(selectedProject.updated_at)}
                        </span>
                      </div>
                      {selectedProject.last_analyzed && (
                        <div className='flex items-center justify-between'>
                          <span className='text-muted-foreground'>
                            Last Analyzed
                          </span>
                          <span className='text-card-foreground text-xs'>
                            {formatDate(selectedProject.last_analyzed)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className='bg-card border-border rounded-lg border p-6'>
                    <h2 className='text-card-foreground mb-4 text-lg font-semibold'>
                      Quick Actions
                    </h2>
                    <div className='space-y-3'>
                      <button
                        onClick={handleAnalyzeProject}
                        disabled={
                          analysisLoading || selectedProject.status !== 'ready'
                        }
                        className='bg-primary hover:bg-primary/80 text-primary-foreground flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        <PlayIcon className='h-4 w-4' />
                        {analysisLoading ? 'Analyzing...' : 'Start Analysis'}
                      </button>

                      <button
                        disabled
                        className='bg-secondary hover:bg-secondary/80 text-secondary-foreground flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        <BarChartIcon className='h-4 w-4' />
                        View Reports
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className='flex flex-1 items-center justify-center'>
            <div className='max-w-md text-center'>
              <FolderIcon className='text-muted-foreground mx-auto mb-4 h-16 w-16' />
              <h2 className='text-card-foreground mb-2 text-xl font-semibold'>
                No Project Selected
              </h2>
              <p className='text-muted-foreground mb-6'>
                Select a project from the sidebar to view its details and start
                analysis.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className='bg-primary hover:bg-primary/80 text-primary-foreground rounded-lg px-6 py-3 font-medium transition'
              >
                Create Your First Project
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Project Creation Modal */}
      <ProjectCreationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
}
