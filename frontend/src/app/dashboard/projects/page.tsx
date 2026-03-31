'use client';

export const runtime = 'edge';

import { useState, useEffect } from 'react';
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
  SearchIcon,
  PlusIcon,
  HardDriveIcon,
} from '../../components/LucideIcons';

export default function ProjectsPage() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch projects initially to populate the grid
  const { getProjects, analyzeProject } = useRepolensApi();
  
  const loadProjects = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await getProjects();
      setProjects(response?.projects || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
    
    // Set up polling for active analyses
    const interval = setInterval(() => {
      const hasActiveAnalysis = projects.some(p => p.status === 'analyzing');
      if (hasActiveAnalysis) {
        loadProjects(true); // Silent refresh
      }
    }, 5000); // Poll every 5 seconds if something is analyzing

    return () => clearInterval(interval);
  }, [projects]); // Changed dependency to projects to pick up status changes

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
  };

  const handleProjectCreated = (project: Project) => {
    setSelectedProject(project);
    loadProjects(); // Refresh the list
  };

  const handleAnalyzeProject = async (id?: string) => {
    const projectId = id || selectedProject?.project_id;
    if (!projectId) return;

    try {
      setAnalysisLoading(true);
      await analyzeProject(projectId);
      loadProjects(); // Refresh status
    } catch (error) {
      console.error('Failed to start analysis:', error);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'analyzing': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'completed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'error': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'cloning': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'ready': return <CheckCircleIcon className='h-4 w-4' />;
      case 'analyzing':
      case 'cloning': return <ClockIcon className='h-4 w-4 animate-pulse' />;
      case 'error': return <AlertCircleIcon className='h-4 w-4' />;
      default: return <ClockIcon className='h-4 w-4' />;
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className='flex h-full bg-background'>
      {/* Projects Sidebar */}
      <ProjectsSidebar
        onProjectSelect={handleProjectSelect}
        selectedProjectId={selectedProject?.project_id}
        onCreateProject={() => setShowCreateModal(true)}
      />

      {/* Main Content */}
      <div className='flex flex-1 flex-col overflow-hidden'>
        {selectedProject ? (
          <div className='flex h-full flex-col overflow-auto'>
            {/* Project Header (Detailed View) */}
            <div className='border-border bg-card/30 sticky top-0 z-10 border-b p-6 backdrop-blur-md'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-4'>
                  <button 
                    onClick={() => setSelectedProject(null)}
                    className='hover:bg-accent rounded-full p-2 transition-colors'
                  >
                    <FolderIcon className='h-5 w-5 rotate-180' />
                  </button>
                  <div className='bg-primary/10 text-primary rounded-xl p-3'>
                    <FolderIcon className='h-6 w-6' />
                  </div>
                  <div>
                    <h1 className='text-card-foreground text-2xl font-bold tracking-tight'>
                      {selectedProject.name}
                    </h1>
                    <p className='text-muted-foreground text-sm'>
                      {selectedProject.description || 'No description provided'}
                    </p>
                  </div>
                </div>

                <div className='flex items-center gap-4'>
                  <div className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${getStatusColor(selectedProject.status)}`}>
                    {getStatusIcon(selectedProject.status)}
                    <span className='capitalize'>{selectedProject.status}</span>
                  </div>

                  {selectedProject.status === 'analyzing' && selectedProject.progress_percentage !== null && (
                    <div className='flex items-center gap-3 min-w-[200px]'>
                      <div className='flex-1'>
                         <div className='mb-1 flex justify-between text-[10px] font-bold uppercase'>
                            <span className='text-primary'>{selectedProject.current_step}</span>
                            <span>{selectedProject.progress_percentage}%</span>
                         </div>
                         <div className='bg-muted h-1.5 w-full overflow-hidden rounded-full'>
                            <div 
                              className='bg-primary h-full transition-all duration-1000 ease-out'
                              style={{ width: `${selectedProject.progress_percentage}%` }}
                            ></div>
                         </div>
                      </div>
                    </div>
                  )}

                  {selectedProject.status === 'ready' && (
                    <button
                      onClick={() => handleAnalyzeProject()}
                      disabled={analysisLoading}
                      className='bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20 flex items-center gap-2 rounded-lg px-5 py-2.5 font-semibold shadow-lg transition-all active:scale-95 disabled:opacity-50'
                    >
                      {analysisLoading ? (
                        <div className='h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white'></div>
                      ) : (
                        <PlayIcon className='h-4 w-4' />
                      )}
                      {analysisLoading ? 'Analyzing...' : 'Analyze Project'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Project Details */}
            <div className='p-8'>
              <div className='grid grid-cols-1 gap-8 lg:grid-cols-3'>
                {/* Stats Row */}
                <div className='lg:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-4'>
                  {[
                    { label: 'Status', value: selectedProject.status, color: getStatusColor(selectedProject.status).split(' ')[1] },
                    { label: 'Files', value: selectedProject.file_count || '0' },
                    { label: 'Analyses', value: selectedProject.analysis_count },
                    { label: 'Size', value: formatBytes(selectedProject.size_bytes) }
                  ].map((stat, i) => (
                    <div key={i} className='bg-card/50 border-border rounded-2xl border p-5 transition-all hover:bg-card'>
                      <p className='text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wider'>{stat.label}</p>
                      <p className={`text-2xl font-bold tracking-tight ${stat.color || 'text-card-foreground capitalize'}`}>
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className='space-y-8 lg:col-span-2'>
                  <div className='bg-card border-border overflow-hidden rounded-2xl border'>
                    <div className='border-border bg-muted/30 border-b px-6 py-4'>
                      <h2 className='text-card-foreground font-bold'>Project Information</h2>
                    </div>
                    <div className='p-6'>
                      <div className='grid grid-cols-2 gap-8'>
                        <div className='space-y-1'>
                          <label className='text-muted-foreground text-xs font-medium uppercase'>Storage Type</label>
                          <p className='text-card-foreground font-semibold capitalize flex items-center gap-2'>
                            <HardDriveIcon className='h-4 w-4 text-primary' />
                            {selectedProject.source_config.type}
                          </p>
                        </div>
                        <div className='space-y-1'>
                          <label className='text-muted-foreground text-xs font-medium uppercase'>Created On</label>
                          <p className='text-card-foreground font-semibold'>{formatDate(selectedProject.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className='bg-card border-border overflow-hidden rounded-2xl border'>
                     <div className='border-border bg-muted/30 border-b px-6 py-4'>
                      <h2 className='text-card-foreground font-bold'>Source Configuration</h2>
                    </div>
                    <div className='p-6'>
                      <div className='space-y-4'>
                        <div className='space-y-1'>
                          <label className='text-muted-foreground text-xs font-medium uppercase'>Repository Path</label>
                          <div className='bg-background/80 border-border flex items-center gap-3 rounded-xl border p-4 font-mono text-sm shadow-inner'>
                             <FolderIcon className='text-primary h-4 w-4 shrink-0' />
                             <span className='truncate text-primary'>
                              {selectedProject.source_config.type === 'local' && selectedProject.source_config.local_path}
                              {selectedProject.source_config.type === 'github' && selectedProject.source_config.github_url}
                             </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className='space-y-6'>
                   <div className='bg-card border-border overflow-hidden rounded-2xl border'>
                    <div className='border-border bg-muted/30 border-b px-6 py-4'>
                      <h2 className='text-card-foreground font-bold'>History</h2>
                    </div>
                    <div className='p-6 space-y-4'>
                       <div className='flex items-center gap-3 text-sm'>
                          <ClockIcon className='text-muted-foreground h-4 w-4' />
                          <div className='flex flex-1 justify-between'>
                             <span className='text-muted-foreground'>Last Updated</span>
                             <span className='text-card-foreground font-medium'>{formatDate(selectedProject.updated_at)}</span>
                          </div>
                       </div>
                       {selectedProject.last_analyzed && (
                         <div className='flex items-center gap-3 text-sm'>
                            <BarChartIcon className='text-primary h-4 w-4' />
                            <div className='flex flex-1 justify-between'>
                               <span className='text-muted-foreground'>Last Analyzed</span>
                               <span className='text-card-foreground font-medium'>{formatDate(selectedProject.last_analyzed)}</span>
                            </div>
                         </div>
                       )}
                    </div>
                  </div>

                  <div className='bg-primary/5 border-primary/20 overflow-hidden rounded-2xl border p-1'>
                    <div className='bg-card border-border rounded-xl border p-5'>
                      <h2 className='text-card-foreground mb-4 font-bold'>Actions</h2>
                      <div className='space-y-3'>
                        <button
                          onClick={() => handleAnalyzeProject()}
                          disabled={analysisLoading || selectedProject.status === 'analyzing'}
                          className='bg-primary hover:bg-primary/90 text-primary-foreground flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold transition-all active:scale-[0.98] disabled:opacity-50'
                        >
                          <PlayIcon className='h-4 w-4' />
                          {analysisLoading ? 'Processing...' : 'Run Analysis'}
                        </button>

                        <button
                          disabled
                          className='bg-secondary hover:bg-secondary/80 text-secondary-foreground flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold transition disabled:opacity-30'
                        >
                          <BarChartIcon className='h-4 w-4' />
                          View Traceability
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Dashboard Grid View */
          <div className='flex h-full flex-col overflow-hidden bg-background/50'>
            {/* Dashboard Header */}
            <div className='border-border bg-card/30 flex items-center justify-between border-b px-8 py-6 backdrop-blur-md'>
              <div>
                <h1 className='text-card-foreground text-3xl font-extrabold tracking-tight'>Dashboard</h1>
                <p className='text-muted-foreground font-medium'>Monitor and manage your repository analysis tasks</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className='bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 rounded-xl px-6 py-3 font-bold shadow-lg shadow-primary/20 transition-all active:scale-95'
              >
                <PlusIcon className='h-5 w-5' />
                New Project
              </button>
            </div>

            {/* Filter Bar */}
            <div className='bg-card/50 border-border flex items-center gap-6 border-b px-8 py-4'>
              <div className='relative flex-1 group'>
                <div className='absolute inset-y-0 left-4 flex items-center pointer-events-none group-focus-within:text-primary transition-colors text-muted-foreground'>
                  <SearchIcon className='h-5 w-5' />
                </div>
                <input
                  type='text'
                  placeholder='Search projects by name or description...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='bg-background/80 border-border focus:border-primary/50 focus:ring-primary/20 w-full rounded-xl border py-2.5 pl-12 pr-4 text-sm font-medium transition-all focus:ring-4 outline-none'
                />
              </div>

              <div className='flex items-center gap-2'>
                <span className='text-muted-foreground text-sm font-bold uppercase tracking-wider mr-2'>Status:</span>
                <div className='flex bg-muted/50 rounded-xl p-1 border border-border'>
                  {['all', 'analyzing', 'completed', 'error', 'ready'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`rounded-lg px-4 py-1.5 text-xs font-bold capitalize transition-all ${
                        statusFilter === status
                          ? 'bg-card text-primary shadow-sm ring-1 ring-border'
                          : 'text-muted-foreground hover:bg-card/50 hover:text-foreground'
                      }`}
                    >
                      {status === 'all' ? 'Show All' : status}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Grid Content */}
            <div className='flex-1 overflow-auto p-8'>
              {loading ? (
                <div className='flex h-full items-center justify-center'>
                  <div className='bg-card border-border flex items-center gap-4 rounded-2xl border p-8 shadow-xl'>
                    <div className='border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent'></div>
                    <span className='text-lg font-bold'>Loading Projects</span>
                  </div>
                </div>
              ) : filteredProjects.length > 0 ? (
                <div className='grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3'>
                  {filteredProjects.map((project) => (
                    <div 
                      key={project.project_id}
                      onClick={() => setSelectedProject(project)}
                      className='bg-card border-border hover:border-primary/50 group relative flex cursor-pointer flex-col overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/5'
                    >
                      {/* Status Accent Bar */}
                      <div className={`h-1.5 w-full ${getStatusColor(project.status).split(' ')[1].replace('text-', 'bg-')}`}></div>
                      
                      <div className='p-6'>
                        <div className='mb-4 flex items-start justify-between'>
                          <div className='bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground rounded-2xl p-3 transition-colors'>
                            <HardDriveIcon className='h-6 w-6' />
                          </div>
                          <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${getStatusColor(project.status)}`}>
                            {getStatusIcon(project.status)}
                            {project.status}
                          </div>
                        </div>

                        <h3 className='text-card-foreground line-clamp-1 mb-1 text-xl font-black tracking-tight group-hover:text-primary transition-colors'>
                          {project.name}
                        </h3>
                        <p className='text-muted-foreground line-clamp-2 mb-6 h-10 text-sm font-medium'>
                          {project.description || 'No description provided for this project.'}
                        </p>

                        {project.status === 'analyzing' && project.progress_percentage !== null && (
                          <div className='mb-6'>
                            <div className='mb-2 flex items-center justify-between text-xs font-bold'>
                              <span className='text-primary animate-pulse flex items-center gap-1'>
                                <ClockIcon className='h-3 w-3' />
                                {project.current_step || 'Processing'}...
                              </span>
                              <span className='text-card-foreground'>{project.progress_percentage}%</span>
                            </div>
                            <div className='bg-muted h-2 w-full overflow-hidden rounded-full'>
                              <div 
                                className='bg-primary h-full transition-all duration-1000 ease-out'
                                style={{ width: `${project.progress_percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        )}

                        <div className='mb-6 grid grid-cols-2 gap-3'>
                          <div className='bg-muted/40 rounded-xl px-4 py-2.5'>
                            <p className='text-[10px] font-bold text-muted-foreground uppercase opacity-50'>Files</p>
                            <p className='text-sm font-black'>{project.file_count || '0'}</p>
                          </div>
                          <div className='bg-muted/40 rounded-xl px-4 py-2.5'>
                             <p className='text-[10px] font-bold text-muted-foreground uppercase opacity-50'>Size</p>
                             <p className='text-sm font-black'>{formatBytes(project.size_bytes)}</p>
                          </div>
                        </div>

                        <div className='flex items-center justify-between border-t border-border pt-4'>
                          <div className='flex items-center gap-2 text-xs font-bold text-muted-foreground'>
                            <ClockIcon className='h-3.5 w-3.5' />
                            {formatDate(project.updated_at)}
                          </div>
                          
                          <div className='flex items-center gap-2'>
                             {project.status === 'ready' && (
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   handleAnalyzeProject(project.project_id);
                                 }}
                                 className='bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-lg p-2 transition-all active:scale-90'
                                 title='Quick Analyze'
                               >
                                 <PlayIcon className='h-4 w-4' />
                               </button>
                             )}
                             <div className='bg-accent text-accent-foreground rounded-lg px-3 py-2 text-xs font-black group-hover:bg-primary group-hover:text-primary-foreground transition-all'>
                               Details
                             </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Empty State */
                <div className='bg-card/50 border-border border-dashed flex h-full flex-col items-center justify-center rounded-3xl border-4 p-12 text-center'>
                  <div className='bg-muted rounded-full p-8 mb-6'>
                    <FolderIcon className='text-muted-foreground h-16 w-16' />
                  </div>
                  <h2 className='text-card-foreground mb-2 text-3xl font-black tracking-tight'>
                    {searchQuery ? 'No matching projects' : 'Your workspace is empty'}
                  </h2>
                  <p className='text-muted-foreground mb-8 max-w-sm font-medium'>
                    {searchQuery 
                      ? `We couldn't find any projects matching "${searchQuery}". Try a different term or clear filters.`
                      : 'Create your first project to start analyzing code repositories and generating intelligence.'}
                  </p>
                  {searchQuery ? (
                    <button
                      onClick={() => {setSearchQuery(''); setStatusFilter('all');}}
                      className='bg-primary hover:bg-primary/80 text-primary-foreground rounded-xl px-8 py-3 font-bold transition-all'
                    >
                      Clear Search
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className='bg-primary hover:bg-primary/80 text-primary-foreground rounded-xl px-8 py-3 font-bold shadow-lg shadow-primary/20 transition-all active:scale-95'
                    >
                      Create Project
                    </button>
                  )}
                </div>
              )}
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
