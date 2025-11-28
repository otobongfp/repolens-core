'use client';

export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRepolensApi, Project } from '../../utils/api';
import MainTabs from '../../components/MainTabs';
import LoadingSpinner from '../../components/LoadingSpinner';
import AnalysisTimeline, {
  AnalysisStep,
} from '../../components/AnalysisTimeline';
import AnalysisResults, {
  AnalysisResult,
} from '../../components/AnalysisResults';
import { useGraphData } from '../../context/GraphDataProvider';
import {
  FolderIcon,
  GithubIcon,
  HardDriveIcon,
  PlayIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  AlertCircleIcon,
  Eye as EyeIcon,
} from '../../components/LucideIcons';
import toast from 'react-hot-toast';

export default function AnalyzePage() {
  const router = useRouter();
  const {
    getProjects,
    analyzeProject,
    getAnalysisProgress,
    getAnalysisResult,
  } = useRepolensApi();
  const { graph, isLoading, error } = useGraphData();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [analyzingProject, setAnalyzingProject] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [analysisProgress, setAnalysisProgress] = useState<any>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [showResults, setShowResults] = useState(false);
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>([]);

  // Local storage keys
  const STORAGE_KEYS = {
    SELECTED_PROJECT: 'repolens_selected_project',
    ANALYSIS_STATE: 'repolens_analysis_state',
    ANALYSIS_RESULT: 'repolens_analysis_result',
  };

  useEffect(() => {
    loadProjects();
    initializeAnalysisSteps();
    restoreAnalysisState();
  }, []);

  // Local storage utility functions
  const saveToStorage = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  };

  const loadFromStorage = (key: string) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return null;
    }
  };

  const clearStorage = (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  };

  const restoreAnalysisState = () => {
    const savedProject = loadFromStorage(STORAGE_KEYS.SELECTED_PROJECT);
    const savedAnalysisState = loadFromStorage(STORAGE_KEYS.ANALYSIS_STATE);
    const savedAnalysisResult = loadFromStorage(STORAGE_KEYS.ANALYSIS_RESULT);

    if (savedProject) {
      setSelectedProject(savedProject);
    }

    if (savedAnalysisState) {
      setAnalysisId(savedAnalysisState.analysisId);
      setAnalyzingProject(savedAnalysisState.analyzingProject);
      setShowResults(savedAnalysisState.showResults);
      setAnalysisProgress(savedAnalysisState.analysisProgress);
    }

    if (savedAnalysisResult) {
      setAnalysisResult(savedAnalysisResult);
    }
  };

  const initializeAnalysisSteps = () => {
    const steps: AnalysisStep[] = [
      {
        id: 'discovery',
        name: 'File Discovery',
        description: 'Scanning project directory for source files',
        status: 'pending',
      },
      {
        id: 'parsing',
        name: 'Code Parsing',
        description: 'Parsing source files with Tree-sitter',
        status: 'pending',
      },
      {
        id: 'analyzing',
        name: 'Call Graph Analysis',
        description: 'Analyzing function calls and relationships',
        status: 'pending',
      },
      {
        id: 'storing',
        name: 'Graph Storage',
        description: 'Storing analysis results in Neo4j',
        status: 'pending',
      },
      {
        id: 'ai_analysis',
        name: 'AI Insights',
        description: 'Generating AI-powered insights',
        status: 'pending',
      },
    ];
    setAnalysisSteps(steps);
  };

  // Persist selected project changes
  useEffect(() => {
    if (selectedProject) {
      saveToStorage(STORAGE_KEYS.SELECTED_PROJECT, selectedProject);
    } else {
      clearStorage(STORAGE_KEYS.SELECTED_PROJECT);
    }
  }, [selectedProject]);

  // Persist analysis state changes
  useEffect(() => {
    const analysisState = {
      analysisId,
      analyzingProject,
      showResults,
      analysisProgress,
    };

    if (analysisId || analyzingProject || showResults || analysisProgress) {
      saveToStorage(STORAGE_KEYS.ANALYSIS_STATE, analysisState);
    } else {
      clearStorage(STORAGE_KEYS.ANALYSIS_STATE);
    }
  }, [analysisId, analyzingProject, showResults, analysisProgress]);

  // Persist analysis result changes
  useEffect(() => {
    if (analysisResult) {
      saveToStorage(STORAGE_KEYS.ANALYSIS_RESULT, analysisResult);
    } else {
      clearStorage(STORAGE_KEYS.ANALYSIS_RESULT);
    }
  }, [analysisResult]);

  const updateAnalysisSteps = (progress: any) => {
    setAnalysisSteps((prev) =>
      prev.map((step) => {
        const stepProgress = getStepProgress(progress, step.id);
        return {
          ...step,
          status: stepProgress.status as
            | 'pending'
            | 'running'
            | 'completed'
            | 'error',
          progress: stepProgress.progress,
          startedAt: (stepProgress as any).startedAt,
          completedAt: (stepProgress as any).completedAt,
          errorMessage: (stepProgress as any).errorMessage,
        };
      }),
    );
  };

  const getStepProgress = (progress: any, stepId: string) => {
    const currentStep = progress.current_step?.toLowerCase() || '';
    const status = progress.status || 'pending';

    // Map progress status to step status
    if (status === 'completed') {
      return { status: 'completed', progress: 100 };
    }
    if (status === 'error') {
      return { status: 'error', errorMessage: progress.error_message };
    }

    // Determine which step is currently running
    if (currentStep.includes('discovering') || currentStep.includes('files')) {
      return stepId === 'discovery'
        ? { status: 'running', progress: progress.progress_percentage }
        : {
            status:
              stepId === 'parsing' ||
              stepId === 'analyzing' ||
              stepId === 'storing' ||
              stepId === 'ai_analysis'
                ? 'completed'
                : 'pending',
          };
    }
    if (currentStep.includes('parsing') || currentStep.includes('parsed')) {
      return stepId === 'parsing'
        ? { status: 'running', progress: progress.progress_percentage }
        : {
            status:
              stepId === 'discovery'
                ? 'completed'
                : stepId === 'analyzing' ||
                    stepId === 'storing' ||
                    stepId === 'ai_analysis'
                  ? 'completed'
                  : 'pending',
          };
    }
    if (
      currentStep.includes('analyzing') ||
      currentStep.includes('call graph')
    ) {
      return stepId === 'analyzing'
        ? { status: 'running', progress: progress.progress_percentage }
        : {
            status:
              stepId === 'discovery' || stepId === 'parsing'
                ? 'completed'
                : stepId === 'storing' || stepId === 'ai_analysis'
                  ? 'completed'
                  : 'pending',
          };
    }
    if (currentStep.includes('storing') || currentStep.includes('neo4j')) {
      return stepId === 'storing'
        ? { status: 'running', progress: progress.progress_percentage }
        : {
            status:
              stepId === 'discovery' ||
              stepId === 'parsing' ||
              stepId === 'analyzing'
                ? 'completed'
                : stepId === 'ai_analysis'
                  ? 'completed'
                  : 'pending',
          };
    }
    if (currentStep.includes('ai') || currentStep.includes('insights')) {
      return stepId === 'ai_analysis'
        ? { status: 'running', progress: progress.progress_percentage }
        : { status: 'completed' };
    }

    return { status: 'pending' };
  };

  // Progress tracking effect
  useEffect(() => {
    if (!analysisId || !analyzingProject) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const progress = await getAnalysisProgress(
          analyzingProject,
          analysisId,
        );
        setAnalysisProgress(progress);

        // Update analysis steps based on progress
        updateAnalysisSteps(progress);

        if (progress.status === 'completed') {
          clearInterval(interval);
          setAnalyzingProject(null);
          setAnalysisId(null);

          // Get final results
          try {
            const result = await getAnalysisResult(
              analyzingProject,
              analysisId,
            );
            toast.success(`Analysis completed for ${selectedProject?.name}!`);

            // Store analysis result and show results
            setAnalysisResult(result);
            setShowResults(true);

            // Update project status to completed
            if (selectedProject) {
              setSelectedProject({ ...selectedProject, status: 'completed' });
            }

            // Reload projects to get updated analysis count
            loadProjects();
          } catch (error) {
            console.error('Failed to get analysis result:', error);
          }
        } else if (progress.status === 'error') {
          clearInterval(interval);
          setAnalyzingProject(null);
          setAnalysisId(null);
          toast.error(
            `Analysis failed: ${progress.error_message || 'Unknown error'}`,
          );
        }
      } catch (error) {
        console.error('Failed to get progress:', error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [analysisId, analyzingProject, selectedProject]);

  const loadProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await getProjects();
      setProjects(response.projects || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleAnalyzeProject = async (project: Project) => {
    try {
      setAnalyzingProject(project.project_id);

      // Update project status to analyzing BEFORE setting selectedProject
      const analyzingProject = { ...project, status: 'analyzing' as const };
      setSelectedProject(analyzingProject);
      setAnalysisProgress(null);

      const result = await analyzeProject(project.project_id, 'full', false);

      setAnalysisId(result.analysis_id);
      toast.success(`Analysis started for ${project.name}`);

      // Update project status locally in the projects list
      setProjects((prev) =>
        prev.map((p) =>
          p.project_id === project.project_id
            ? { ...p, status: 'analyzing' }
            : p,
        ),
      );
    } catch (error) {
      console.error('Failed to start analysis:', error);
      toast.error(
        `Failed to start analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      setAnalyzingProject(null);
      setAnalysisId(null);
      setSelectedProject(null); // Reset selected project on error
    }
  };

  const handleVisualize = () => {
    // Navigate to visualization or show detailed results
    setShowResults(true);
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setShowResults(false);
    setAnalysisResult(null);
    setAnalysisProgress(null);
    setAnalysisId(null);
    setAnalyzingProject(null);
    initializeAnalysisSteps();

    // Clear analysis state but keep project selected
    clearStorage(STORAGE_KEYS.ANALYSIS_STATE);
    clearStorage(STORAGE_KEYS.ANALYSIS_RESULT);
  };

  const handleVisualizeProject = async (project: Project) => {
    try {
      // For now, just show the project as selected and show results
      setSelectedProject(project);
      setShowResults(true);

      // In the future, we could fetch existing analysis results here
      // const result = await getAnalysisResult(project.project_id, analysisId);
      // setAnalysisResult(result);
    } catch (error) {
      console.error('Failed to visualize project:', error);
      toast.error('Failed to load analysis results');
    }
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    setShowResults(false);
    setAnalysisResult(null);
    setAnalysisProgress(null);
    setAnalysisId(null);
    setAnalyzingProject(null);
    initializeAnalysisSteps();

    // Clear all storage
    clearStorage(STORAGE_KEYS.SELECTED_PROJECT);
    clearStorage(STORAGE_KEYS.ANALYSIS_STATE);
    clearStorage(STORAGE_KEYS.ANALYSIS_RESULT);
  };

  const getProjectIcon = (project: Project) => {
    switch (project.source_config.type) {
      case 'github':
        return <GithubIcon className='h-5 w-5' />;
      case 'local':
      default:
        return <HardDriveIcon className='h-5 w-5' />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircleIcon className='h-4 w-4 text-green-500' />;
      case 'analyzing':
        return <ClockIcon className='h-4 w-4 animate-spin text-blue-500' />;
      case 'completed':
        return <CheckCircleIcon className='h-4 w-4 text-green-500' />;
      case 'error':
        return <XCircleIcon className='h-4 w-4 text-red-500' />;
      case 'cloning':
        return <ClockIcon className='h-4 w-4 animate-spin text-yellow-500' />;
      default:
        return <AlertCircleIcon className='h-4 w-4 text-gray-500' />;
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loadingProjects) {
    return (
      <div className='flex min-h-[60vh] flex-col items-center justify-center'>
        <LoadingSpinner />
        <p className='text-muted-foreground mt-4'>Loading projects...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className='flex min-h-[60vh] flex-col items-center justify-center'>
        <div className='text-center'>
          <FolderIcon className='mx-auto mb-4 h-16 w-16 text-gray-400' />
          <h1 className='text-foreground mb-2 font-serif text-3xl font-bold tracking-tighter md:text-4xl'>
            No Projects Found
          </h1>
          <p className='text-muted-foreground mb-6 max-w-xl text-sm md:text-base'>
            Create a project first to start analyzing your code
          </p>
          <button
            onClick={() => router.push('/dashboard/projects')}
            className='bg-primary hover:bg-primary/80 text-primary-foreground flex min-h-[44px] items-center justify-center rounded-lg px-6 py-3 font-semibold transition'
          >
            Go to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='flex min-h-[60vh] flex-col'>
      {/* Header */}
      <div className='mb-8 text-center'>
        <h1 className='text-foreground mb-2 font-serif text-3xl font-bold tracking-tighter md:text-4xl'>
          Analyze Project
        </h1>
        <p className='text-muted-foreground max-w-xl text-sm md:text-base'>
          Select a project to analyze and explore its structure
        </p>
      </div>

      {/* Project Selection */}
      <div className='mb-8 w-full max-w-4xl'>
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {projects.map((project) => (
            <div
              key={project.project_id}
              className={`rounded-2xl border p-6 backdrop-blur-md transition ${
                selectedProject?.project_id === project.project_id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <div className='mb-4 flex items-start gap-3'>
                {getProjectIcon(project)}
                <div className='min-w-0 flex-1'>
                  <h3 className='text-foreground mb-1 truncate font-semibold'>
                    {project.name}
                  </h3>
                  <p className='text-muted-foreground truncate text-sm'>
                    {project.source_config.type === 'github'
                      ? project.source_config.github_url
                      : project.source_config.local_path}
                  </p>
                </div>
                {getStatusIcon(project.status)}
              </div>

              {project.description && (
                <p className='text-muted-foreground mb-4 text-sm'>
                  {project.description}
                </p>
              )}

              {/* Progress Display */}
              {analyzingProject === project.project_id && (
                <div className='mb-4 rounded-lg bg-blue-500/10 p-3'>
                  {analysisProgress ? (
                    <>
                      <div className='mb-2 flex items-center justify-between'>
                        <span className='text-sm font-medium text-blue-400'>
                          {analysisProgress.current_step}
                        </span>
                        <span className='text-sm text-blue-300'>
                          {Math.round(analysisProgress.progress_percentage)}%
                        </span>
                      </div>
                      <div className='mb-2 h-2 w-full rounded-full bg-blue-500/20'>
                        <div
                          className='h-2 rounded-full bg-blue-500 transition-all duration-300'
                          style={{
                            width: `${analysisProgress.progress_percentage}%`,
                          }}
                        />
                      </div>
                      <div className='text-xs text-blue-300'>
                        {analysisProgress.parsed_files}/
                        {analysisProgress.total_files} files parsed
                        {analysisProgress.total_functions > 0 && (
                          <span>
                            {' '}
                            • {analysisProgress.analyzed_functions}/
                            {analysisProgress.total_functions} functions
                            analyzed
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className='text-center text-blue-300'>
                      <div className='mb-2 flex items-center justify-center gap-2'>
                        <ClockIcon className='h-4 w-4 animate-spin' />
                        <span className='text-sm'>Starting analysis...</span>
                      </div>
                      <div className='text-xs'>
                        Waiting for progress updates...
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className='mb-4 space-y-2 text-xs text-gray-400'>
                <div className='flex justify-between'>
                  <span>Files: {project.file_count || 'Unknown'}</span>
                  <span>Size: {formatBytes(project.size_bytes)}</span>
                </div>
                <div className='flex justify-between'>
                  <span>Analyses: {project.analysis_count}</span>
                  <span>Created: {formatDate(project.created_at)}</span>
                </div>
                {project.last_analyzed && (
                  <div className='text-center'>
                    <span>
                      Last analyzed: {formatDate(project.last_analyzed)}
                    </span>
                  </div>
                )}
              </div>

              <div className='space-y-2'>
                {/* Select Project Button */}
                <button
                  onClick={() => handleSelectProject(project)}
                  className='flex min-h-[44px] w-full items-center justify-center rounded-lg border border-gray-600 bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-gray-700 hover:text-white'
                >
                  <div className='flex items-center justify-center gap-2'>
                    <PlayIcon className='h-4 w-4' />
                    Select Project
                  </div>
                </button>

                {/* Action Button */}
                <button
                  onClick={() =>
                    project.status === 'completed'
                      ? handleVisualizeProject(project)
                      : handleAnalyzeProject(project)
                  }
                  disabled={
                    project.status === 'analyzing' ||
                    project.status === 'cloning'
                  }
                  className={`flex min-h-[44px] w-full items-center justify-center rounded-lg px-4 py-2.5 font-semibold transition disabled:opacity-50 ${
                    project.status === 'completed'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-primary hover:bg-primary/80 text-primary-foreground'
                  }`}
                >
                  {project.status === 'analyzing' ||
                  project.status === 'cloning' ? (
                    <div className='flex items-center justify-center gap-2'>
                      <ClockIcon className='h-4 w-4 animate-spin' />
                      {project.status === 'analyzing'
                        ? 'Analyzing...'
                        : 'Cloning...'}
                    </div>
                  ) : project.status === 'completed' ? (
                    <div className='flex items-center justify-center gap-2'>
                      <EyeIcon className='h-4 w-4' />
                      Visualize Results
                    </div>
                  ) : (
                    <div className='flex items-center justify-center gap-2'>
                      <PlayIcon className='h-4 w-4' />
                      Analyze Project
                    </div>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Project Header */}
      {selectedProject && (
        <div className='mb-6 w-full max-w-6xl'>
          <div className='rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 backdrop-blur-md'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                {getProjectIcon(selectedProject)}
                <div>
                  <h2 className='text-foreground text-xl font-semibold'>
                    {selectedProject.name}
                  </h2>
                  <p className='text-muted-foreground text-sm'>
                    {selectedProject.source_config.type === 'github'
                      ? selectedProject.source_config.github_url
                      : selectedProject.source_config.local_path}
                  </p>
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <span className='text-muted-foreground text-sm'>
                  Status: {selectedProject.status}
                </span>
                <button
                  onClick={handleBackToProjects}
                  className='text-muted-foreground hover:text-foreground flex min-h-[44px] items-center justify-center rounded-lg px-3 py-2 text-sm transition sm:min-h-0'
                >
                  <span className='hidden sm:inline'>← Back to Projects</span>
                  <span className='sm:hidden'>← Back</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Progress */}
      {selectedProject && !showResults && (
        <div className='mb-8 w-full max-w-6xl'>
          <div className='rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md'>
            <div className='mb-6 text-center'>
              <h3 className='text-foreground mb-2 text-2xl font-semibold'>
                Analysis Progress
              </h3>
              <p className='text-muted-foreground'>
                {selectedProject.status === 'analyzing'
                  ? `Analyzing ${selectedProject.name} and creating AST relationships...`
                  : `Preparing ${selectedProject.name} for analysis...`}
              </p>
            </div>

            {/* Analysis Timeline */}
            <AnalysisTimeline
              steps={analysisSteps}
              currentStep={analysisProgress?.current_step}
              overallProgress={analysisProgress?.progress_percentage || 0}
            />

            {/* Analysis Info */}
            {analysisProgress && (
              <div className='bg-background mt-6 rounded-lg p-4'>
                <div className='text-muted-foreground text-xs'>
                  <div className='mb-2'>
                    Analysis ID: {analysisProgress.analysis_id}
                  </div>
                  <div className='mb-2'>
                    Current Step: {analysisProgress.current_step}
                  </div>
                  <div>
                    Progress: {Math.round(analysisProgress.progress_percentage)}
                    %
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {selectedProject && showResults && analysisResult && (
        <div className='mb-8 w-full max-w-6xl'>
          <div className='rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md'>
            <div className='mb-6 text-center'>
              <h3 className='text-foreground mb-2 text-2xl font-semibold'>
                Analysis Results - {selectedProject.name}
              </h3>
              <p className='text-muted-foreground'>
                Comprehensive analysis completed successfully
              </p>
            </div>

            <AnalysisResults
              result={analysisResult}
              onVisualize={handleVisualize}
            />
          </div>
        </div>
      )}

      {/* Loading State for Analysis */}
      {isLoading && (
        <div className='mb-8'>
          <LoadingSpinner />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className='mb-8 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center'>
          <p className='text-red-300'>{error}</p>
        </div>
      )}

      {/* Analysis Results */}
      {graph && selectedProject && (
        <div className='w-full max-w-6xl'>
          <div className='mb-4 rounded-lg border border-white/10 bg-white/5 p-4'>
            <div className='flex items-center gap-3'>
              {getProjectIcon(selectedProject)}
              <div>
                <h3 className='text-foreground font-semibold'>
                  {selectedProject.name}
                </h3>
                <p className='text-muted-foreground text-sm'>
                  Analysis completed successfully
                </p>
              </div>
            </div>
          </div>
          <div className='rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur-md sm:p-6'>
            <MainTabs />
          </div>
        </div>
      )}
    </div>
  );
}
