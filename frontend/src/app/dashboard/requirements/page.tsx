'use client';

export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { useRepolensApi, Project } from '../../utils/api';
import {
  UploadIcon,
  FileTextIcon,
  CheckCircleIcon,
  ClockIcon,
  AlertCircleIcon,
  LoaderIcon,
  SearchIcon,
  XIcon,
  LightbulbIcon,
  RefreshCwIcon,
} from '../../components/LucideIcons';
import toast from 'react-hot-toast';

interface Requirement {
  id: string;
  title: string;
  text: string;
  type?: 'feature' | 'suggestion';
  status?: 'pending' | 'accepted' | 'rejected';
  requirementMatches?: RequirementMatch[];
  createdAt: string;
}

interface RequirementsResponse {
  requirements: Requirement[];
  count: number;
  completionPercentage: number;
}

interface RequirementMatch {
  id: string;
  nodeId: string;
  matchScore: number;
  matchTypes: string[];
  confidence: string;
  node?: {
    filePath: string;
    nodePath: string;
    nodeType: string;
  };
}

export default function RequirementsPage() {
  const { createProject, getProjects, apiBase } = useRepolensApi();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [selectedRequirement, setSelectedRequirement] =
    useState<Requirement | null>(null);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [documentContent, setDocumentContent] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
    if (selectedProject) {
      loadRequirements();
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    try {
      const result = await getProjects();
      const projectsList = result?.projects || [];
      setProjects(projectsList);
      if (projectsList.length > 0 && !selectedProject) {
        setSelectedProject(projectsList[0]);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      setProjects([]); // Set empty array on error
    }
  };

  const loadRequirements = async () => {
    if (!selectedProject) return;
    try {
      const response = await fetch(
        `${apiBase}/api/requirements/project/${selectedProject.project_id}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      if (response.ok) {
        const data: RequirementsResponse = await response.json();
        setRequirements(data.requirements || []);
        setCompletionPercentage(data.completionPercentage || 0);
      }
    } catch (error) {
      console.error('Failed to load requirements:', error);
    }
  };

  const handleExtractRequirements = async () => {
    if (!documentContent.trim()) {
      toast.error('Please enter or upload requirements document content');
      return;
    }

    if (!selectedProject) {
      toast.error('Please select a project first');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/requirements/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentContent,
          projectId: selectedProject.project_id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to extract requirements');
      }

      const data = await response.json();
      toast.success(`Extracted ${data.requirements.length} requirement(s)`);
      setDocumentContent('');
      setShowUpload(false);
      await loadRequirements();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to extract requirements',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMatchRequirements = async (requirementId: string) => {
    if (!selectedProject) return;

    setMatching(true);
    try {
      const response = await fetch(`${apiBase}/api/requirements/match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requirementId,
          projectId: selectedProject.project_id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to match requirements');
      }

      const data = await response.json();
      toast.success(
        `Found ${data.matches?.length || 0} matching code sections`,
      );
      await loadRequirements();
      setSelectedRequirement(
        requirements.find((r) => r.id === requirementId) || null,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to match requirements',
      );
    } finally {
      setMatching(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setDocumentContent(content);
    };
    reader.readAsText(file);
  };

  const handleAcceptSuggestion = async (requirementId: string) => {
    setAccepting(requirementId);
    try {
      const response = await fetch(
        `${apiBase}/api/requirements/${requirementId}/accept`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      if (response.ok) {
        toast.success('Suggestion accepted');
        await loadRequirements();
      } else {
        throw new Error('Failed to accept suggestion');
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to accept suggestion',
      );
    } finally {
      setAccepting(null);
    }
  };

  const handleRejectSuggestion = async (requirementId: string) => {
    setRejecting(requirementId);
    try {
      const response = await fetch(
        `${apiBase}/api/requirements/${requirementId}/reject`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      if (response.ok) {
        toast.success('Suggestion rejected');
        await loadRequirements();
      } else {
        throw new Error('Failed to reject suggestion');
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to reject suggestion',
      );
    } finally {
      setRejecting(null);
    }
  };

  // Separate requirements by type
  const features = (requirements || []).filter(
    (r) => r.type !== 'suggestion' || r.status === 'accepted',
  );
  const suggestions = (requirements || []).filter(
    (r) => r.type === 'suggestion' && r.status === 'pending',
  );

  return (
    <div className='flex min-h-[60vh] flex-col'>
      {/* Header */}
      <div className='mb-6'>
        <h1 className='text-foreground mb-2 font-serif text-3xl font-bold tracking-tighter md:text-4xl'>
          Match Requirements to Codebase
        </h1>
        <p className='text-muted-foreground max-w-xl text-sm md:text-base'>
          Upload requirements documents and match them to existing codebase
          components
        </p>
      </div>

      {/* Project Selector */}
      <div className='mb-6'>
        <label className='text-card-foreground mb-2 block text-sm font-medium'>
          Select Project
        </label>
        <select
          value={selectedProject?.project_id || ''}
          onChange={(e) => {
            const project = projects.find(
              (p) => p.project_id === e.target.value,
            );
            setSelectedProject(project || null);
          }}
          className='border-border bg-background text-card-foreground focus:ring-primary w-full max-w-md rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none'
        >
          <option value=''>Select a project...</option>
          {projects && projects.length > 0 ? (
            projects.map((project) => (
              <option key={project.project_id} value={project.project_id}>
                {project.name}
              </option>
            ))
          ) : (
            <option value='' disabled>
              No projects available
            </option>
          )}
        </select>
      </div>

      {/* Upload Section */}
      {selectedProject && (
        <div className='mb-6 rounded-lg border border-white/10 bg-white/5 p-6'>
          {!showUpload ? (
            <button
              onClick={() => setShowUpload(true)}
              className='bg-primary hover:bg-primary/80 text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition'
            >
              <UploadIcon className='h-4 w-4' />
              Upload Requirements Document
            </button>
          ) : (
            <div className='space-y-4'>
              <div>
                <label className='text-card-foreground mb-2 block text-sm font-medium'>
                  Document Content
                </label>
                <textarea
                  value={documentContent}
                  onChange={(e) => setDocumentContent(e.target.value)}
                  placeholder='Paste requirements document content or upload a file...'
                  rows={10}
                  className='border-border bg-background text-card-foreground focus:ring-primary w-full resize-none rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none'
                />
                <div className='mt-2'>
                  <label className='text-card-foreground text-primary hover:text-primary/80 flex cursor-pointer items-center gap-2 text-sm'>
                    <UploadIcon className='h-4 w-4' />
                    <span>Upload File</span>
                    <input
                      type='file'
                      accept='.txt,.md,.docx,.pdf'
                      onChange={handleFileUpload}
                      className='hidden'
                    />
                  </label>
                </div>
              </div>
              <div className='flex gap-2'>
                <button
                  onClick={handleExtractRequirements}
                  disabled={loading || !documentContent.trim()}
                  className='bg-primary hover:bg-primary/80 text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
                >
                  {loading ? (
                    <>
                      <LoaderIcon className='h-4 w-4 animate-spin' />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <SearchIcon className='h-4 w-4' />
                      Extract Requirements
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowUpload(false);
                    setDocumentContent('');
                  }}
                  className='text-muted-foreground hover:text-card-foreground px-4 py-2'
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completion Percentage */}
      {selectedProject && requirements.length > 0 && (
        <div className='mb-6 rounded-lg border border-white/10 bg-white/5 p-6'>
          <div className='mb-4 flex items-center justify-between'>
            <h2 className='text-card-foreground text-xl font-semibold'>
              Requirements Completion
            </h2>
            <div className='text-card-foreground text-2xl font-bold'>
              {completionPercentage}%
            </div>
          </div>
          <div className='mb-2 h-3 w-full rounded-full bg-white/10'>
            <div
              className='h-3 rounded-full bg-green-500 transition-all duration-500'
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <p className='text-muted-foreground text-sm'>
            {requirements.length} requirement(s) •{' '}
            {
              requirements.filter(
                (r) => (r.requirementMatches?.length || 0) > 0,
              ).length
            }{' '}
            matched to code
          </p>
        </div>
      )}

      {/* Suggestions (Pending Approval) */}
      {selectedProject && suggestions.length > 0 && (
        <div className='mb-6 space-y-4'>
          <div className='flex items-center gap-2'>
            <LightbulbIcon className='h-5 w-5 text-yellow-500' />
            <h2 className='text-card-foreground text-xl font-semibold'>
              Suggestions ({suggestions.length})
            </h2>
            <span className='text-muted-foreground text-sm'>
              Review and accept or reject
            </span>
          </div>
          {suggestions.map((requirement) => (
            <div
              key={requirement.id}
              className='rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4'
            >
              <div className='mb-3 flex items-start justify-between'>
                <div className='flex-1'>
                  <div className='mb-2 flex items-center gap-2'>
                    <LightbulbIcon className='h-4 w-4 text-yellow-500' />
                    <h3 className='text-card-foreground font-medium'>
                      {requirement.title}
                    </h3>
                    <span className='text-muted-foreground rounded bg-yellow-500/20 px-2 py-0.5 text-xs'>
                      Suggestion
                    </span>
                  </div>
                  <p className='text-muted-foreground text-sm'>
                    {requirement.text}
                  </p>
                </div>
                <div className='ml-4 flex gap-2'>
                  <button
                    onClick={() => handleAcceptSuggestion(requirement.id)}
                    disabled={
                      accepting === requirement.id ||
                      rejecting === requirement.id
                    }
                    className='flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    {accepting === requirement.id ? (
                      <LoaderIcon className='h-4 w-4 animate-spin' />
                    ) : (
                      <CheckCircleIcon className='h-4 w-4' />
                    )}
                    Accept
                  </button>
                  <button
                    onClick={() => handleRejectSuggestion(requirement.id)}
                    disabled={
                      accepting === requirement.id ||
                      rejecting === requirement.id
                    }
                    className='flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    {rejecting === requirement.id ? (
                      <LoaderIcon className='h-4 w-4 animate-spin' />
                    ) : (
                      <XIcon className='h-4 w-4' />
                    )}
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Features (Accepted Requirements) */}
      {selectedProject && features.length > 0 && (
        <div className='space-y-4'>
          <h2 className='text-card-foreground text-xl font-semibold'>
            Requirements ({features.length})
          </h2>
          {features.map((requirement) => (
            <div
              key={requirement.id}
              className='rounded-lg border border-white/10 bg-white/5 p-4'
            >
              <div className='mb-3 flex items-start justify-between'>
                <div className='flex-1'>
                  <h3 className='text-card-foreground mb-2 font-medium'>
                    {requirement.title}
                  </h3>
                  <p className='text-muted-foreground text-sm'>
                    {requirement.text}
                  </p>
                </div>
                <button
                  onClick={() => handleMatchRequirements(requirement.id)}
                  disabled={matching}
                  className='bg-accent text-accent-foreground hover:bg-accent/80 ml-4 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
                >
                  {matching ? (
                    <>
                      <LoaderIcon className='h-4 w-4 animate-spin' />
                      Matching...
                    </>
                  ) : (
                    <>
                      <SearchIcon className='h-4 w-4' />
                      Match to Code
                    </>
                  )}
                </button>
              </div>

              {/* Matches */}
              {requirement.requirementMatches &&
                requirement.requirementMatches.length > 0 && (
                  <div className='mt-4 border-t border-white/10 pt-4'>
                    <h4 className='text-card-foreground mb-2 text-sm font-medium'>
                      Matched Code ({requirement.requirementMatches.length})
                    </h4>
                    <div className='space-y-2'>
                      {requirement.requirementMatches.map((match) => (
                        <div
                          key={match.id}
                          className='rounded border border-white/5 bg-white/5 p-3'
                        >
                          <div className='flex items-center justify-between'>
                            <div className='flex-1'>
                              <div className='text-card-foreground text-sm font-medium'>
                                {match.node?.filePath}:{match.node?.nodePath}
                              </div>
                              <div className='text-muted-foreground mt-1 text-xs'>
                                {match.node?.nodeType} • Score:{' '}
                                {match.matchScore.toFixed(2)} •{' '}
                                {match.confidence}
                              </div>
                            </div>
                            <div className='ml-4'>
                              {match.confidence === 'high' ? (
                                <CheckCircleIcon className='h-5 w-5 text-green-500' />
                              ) : match.confidence === 'medium' ? (
                                <ClockIcon className='h-5 w-5 text-yellow-500' />
                              ) : (
                                <AlertCircleIcon className='h-5 w-5 text-orange-500' />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {selectedProject && requirements.length === 0 && !showUpload && (
        <div className='flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 p-12 text-center'>
          <FileTextIcon className='text-muted-foreground mb-4 h-12 w-12' />
          <h3 className='text-card-foreground mb-2 text-lg font-semibold'>
            No Requirements Yet
          </h3>
          <p className='text-muted-foreground mb-4 max-w-md text-sm'>
            Upload a requirements document to get started with matching
            requirements to your codebase.
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className='bg-primary hover:bg-primary/80 text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition'
          >
            <UploadIcon className='h-4 w-4' />
            Upload Requirements Document
          </button>
        </div>
      )}
    </div>
  );
}
