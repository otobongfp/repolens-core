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
  FileIcon,
  DownloadIcon,
  HistoryIcon,
  TrendingDownIcon,
  TargetIcon,
  ShieldCheckIcon,
  GitBranchIcon,
  EyeIcon,
  AlertTriangleIcon,
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

type TabType = 'requirements' | 'traceability' | 'drift' | 'gaps' | 'compliance' | 'versioning';

export default function RequirementsPage() {
  const {
    getProjects,
    getProjectRequirements,
    extractRequirements,
    matchRequirements,
    acceptRequirement,
    rejectRequirement,
    verifyMatch,
    getTraceabilityMatrix,
    getRequirementTraceability,
    exportTraceabilityMatrix,
    detectDrift,
    checkRequirementDrift,
    getGaps,
    getHighPriorityGaps,
    getImplementationSuggestions,
    generateComplianceReport,
    validateCompliance,
    createRequirementVersion,
    getVersionHistory,
    apiBase,
  } = useRepolensApi();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('requirements');
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [documentContent, setDocumentContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  
  // Traceability state
  const [traceabilityMatrix, setTraceabilityMatrix] = useState<any>(null);
  const [requirementTraceability, setRequirementTraceability] = useState<any>(null);
  const [loadingTraceability, setLoadingTraceability] = useState(false);
  
  // Drift state
  const [driftResults, setDriftResults] = useState<any>(null);
  const [loadingDrift, setLoadingDrift] = useState(false);
  
  // Gap analysis state
  const [gaps, setGaps] = useState<any[]>([]);
  const [highPriorityGaps, setHighPriorityGaps] = useState<any[]>([]);
  const [loadingGaps, setLoadingGaps] = useState(false);
  const [selectedGap, setSelectedGap] = useState<string | null>(null);
  const [implementationSuggestions, setImplementationSuggestions] = useState<any>(null);
  
  // Compliance state
  const [complianceReport, setComplianceReport] = useState<any>(null);
  const [loadingCompliance, setLoadingCompliance] = useState(false);
  
  // Versioning state
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadRequirements();
      if (activeTab === 'traceability') {
        loadTraceabilityMatrix();
      } else if (activeTab === 'drift') {
        loadDrift();
      } else if (activeTab === 'gaps') {
        loadGaps();
      }
    }
  }, [selectedProject, activeTab]);

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
      setProjects([]);
    }
  };

  const loadRequirements = async () => {
    if (!selectedProject) return;
    try {
      const data = await getProjectRequirements(selectedProject.project_id);
      setRequirements(data.requirements || []);
      setCompletionPercentage(data.completionPercentage || 0);
    } catch (error) {
      console.error('Failed to load requirements:', error);
      toast.error('Failed to load requirements');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);

    // Read file content based on type
    if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setDocumentContent(content);
      };
      reader.readAsText(file);
    } else if (file.type === 'application/pdf') {
      // For PDF, we'll need to send the file to the backend
      toast('PDF files will be processed by the backend');
      setDocumentContent(`[PDF File: ${file.name}]`);
    } else if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.endsWith('.docx')
    ) {
      toast('DOCX files will be processed by the backend');
      setDocumentContent(`[DOCX File: ${file.name}]`);
    } else {
      toast.error('Unsupported file type. Please use TXT, MD, PDF, or DOCX files.');
      setUploadedFile(null);
    }
  };

  const handleExtractRequirements = async () => {
    if (!documentContent.trim() && !uploadedFile) {
      toast.error('Please upload a file or enter requirements document content');
      return;
    }

    if (!selectedProject) {
      toast.error('Please select a project first');
      return;
    }

    setLoading(true);
    try {
      let content = documentContent;
      
      // If we have a file, we might need to send it as FormData
      if (uploadedFile && (uploadedFile.type === 'application/pdf' || uploadedFile.name.endsWith('.docx'))) {
        // For now, extract text from file name as placeholder
        // In production, you'd send the file to backend for processing
        content = `[File: ${uploadedFile.name}]`;
        toast('File upload processing will be handled by backend');
      }

      const data = await extractRequirements(content, selectedProject.project_id);
      toast.success(`Extracted ${data.requirements?.length || 0} requirement(s)`);
      setDocumentContent('');
      setUploadedFile(null);
      setShowUpload(false);
      await loadRequirements();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to extract requirements',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMatchRequirements = async (requirementId: string) => {
    if (!selectedProject) return;

    setMatching(true);
    try {
      await matchRequirements(requirementId, selectedProject.project_id);
      toast.success('Requirements matched successfully');
      await loadRequirements();
      setSelectedRequirement(requirements.find((r) => r.id === requirementId) || null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to match requirements',
      );
    } finally {
      setMatching(false);
    }
  };

  const handleAcceptSuggestion = async (requirementId: string) => {
    setAccepting(requirementId);
    try {
      await acceptRequirement(requirementId);
      toast.success('Suggestion accepted');
      await loadRequirements();
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
      await rejectRequirement(requirementId);
      toast.success('Suggestion rejected');
      await loadRequirements();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to reject suggestion',
      );
    } finally {
      setRejecting(null);
    }
  };

  const handleVerifyMatch = async (matchId: string, status: 'verified' | 'rejected') => {
    try {
      await verifyMatch(matchId, status);
      toast.success(`Match ${status === 'verified' ? 'verified' : 'rejected'}`);
      await loadRequirements();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to verify match');
    }
  };

  // Traceability functions
  const loadTraceabilityMatrix = async () => {
    if (!selectedProject) return;
    setLoadingTraceability(true);
    try {
      const matrix = await getTraceabilityMatrix(selectedProject.project_id);
      setTraceabilityMatrix(matrix);
    } catch (error) {
      toast.error('Failed to load traceability matrix');
      console.error(error);
    } finally {
      setLoadingTraceability(false);
    }
  };

  const loadRequirementTraceability = async (requirementId: string) => {
    setLoadingTraceability(true);
    try {
      const traceability = await getRequirementTraceability(requirementId);
      setRequirementTraceability(traceability);
      setSelectedRequirement(requirements.find((r) => r.id === requirementId) || null);
    } catch (error) {
      toast.error('Failed to load requirement traceability');
      console.error(error);
    } finally {
      setLoadingTraceability(false);
    }
  };

  const handleExportTraceability = async (format: 'json' | 'csv' | 'markdown') => {
    if (!selectedProject) return;
    try {
      const data = await exportTraceabilityMatrix(selectedProject.project_id, format);
      const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], {
        type: format === 'json' ? 'application/json' : 'text/plain',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `traceability-matrix.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Traceability matrix exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export traceability matrix');
    }
  };

  // Drift detection functions
  const loadDrift = async () => {
    if (!selectedProject) return;
    setLoadingDrift(true);
    try {
      const drift = await detectDrift(selectedProject.project_id);
      setDriftResults(drift);
    } catch (error) {
      toast.error('Failed to detect drift');
      console.error(error);
    } finally {
      setLoadingDrift(false);
    }
  };

  const handleCheckRequirementDrift = async (requirementId: string) => {
    setLoadingDrift(true);
    try {
      const drift = await checkRequirementDrift(requirementId);
      setDriftResults(drift);
      toast.success('Drift check completed');
    } catch (error) {
      toast.error('Failed to check requirement drift');
    } finally {
      setLoadingDrift(false);
    }
  };

  // Gap analysis functions
  const loadGaps = async () => {
    if (!selectedProject) return;
    setLoadingGaps(true);
    try {
      const [allGaps, priorityGaps] = await Promise.all([
        getGaps(selectedProject.project_id),
        getHighPriorityGaps(selectedProject.project_id),
      ]);
      setGaps(allGaps.gaps || []);
      setHighPriorityGaps(priorityGaps.gaps || []);
    } catch (error) {
      toast.error('Failed to load gaps');
      console.error(error);
    } finally {
      setLoadingGaps(false);
    }
  };

  const handleGetSuggestions = async (requirementId: string) => {
    setSelectedGap(requirementId);
    try {
      const suggestions = await getImplementationSuggestions(requirementId);
      setImplementationSuggestions(suggestions);
    } catch (error) {
      toast.error('Failed to get implementation suggestions');
    }
  };

  // Compliance functions
  const loadComplianceReport = async (format: 'json' | 'pdf' | 'html' | 'markdown' = 'json') => {
    if (!selectedProject) return;
    setLoadingCompliance(true);
    try {
      const report = await generateComplianceReport(selectedProject.project_id, format, true);
      setComplianceReport(report);
    } catch (error) {
      toast.error('Failed to generate compliance report');
      console.error(error);
    } finally {
      setLoadingCompliance(false);
    }
  };

  const handleValidateCompliance = async (standards?: string[]) => {
    if (!selectedProject) return;
    try {
      const result = await validateCompliance(selectedProject.project_id, standards);
      toast.success('Compliance validation completed');
      setComplianceReport(result);
    } catch (error) {
      toast.error('Failed to validate compliance');
    }
  };

  // Versioning functions
  const loadVersionHistory = async (requirementId: string) => {
    setLoadingVersions(true);
    try {
      const history = await getVersionHistory(requirementId);
      setVersionHistory(history.versions || []);
      setSelectedRequirement(requirements.find((r) => r.id === requirementId) || null);
    } catch (error) {
      toast.error('Failed to load version history');
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleCreateVersion = async (
    requirementId: string,
    data: { title?: string; text?: string; type?: string; status?: string },
  ) => {
    try {
      await createRequirementVersion(requirementId, data);
      toast.success('New version created');
      await loadVersionHistory(requirementId);
      await loadRequirements();
    } catch (error) {
      toast.error('Failed to create version');
    }
  };

  // Separate requirements by type
  const features = (requirements || []).filter(
    (r) => r.type !== 'suggestion' || r.status === 'accepted',
  );
  const suggestions = (requirements || []).filter(
    (r) => r.type === 'suggestion' && r.status === 'pending',
  );

  const tabs = [
    { id: 'requirements' as TabType, label: 'Requirements', icon: FileTextIcon },
    { id: 'traceability' as TabType, label: 'Traceability', icon: GitBranchIcon },
    { id: 'drift' as TabType, label: 'Drift Detection', icon: TrendingDownIcon },
    { id: 'gaps' as TabType, label: 'Gap Analysis', icon: TargetIcon },
    { id: 'compliance' as TabType, label: 'Compliance', icon: ShieldCheckIcon },
    { id: 'versioning' as TabType, label: 'Versioning', icon: HistoryIcon },
  ];

  return (
    <div className='flex min-h-[60vh] flex-col'>
      {/* Header */}
      <div className='mb-6'>
        <h1 className='text-foreground mb-2 font-serif text-3xl font-bold tracking-tighter md:text-4xl'>
          Requirements Engineering
        </h1>
        <p className='text-muted-foreground max-w-xl text-sm md:text-base'>
          Upload requirements documents, match them to code, track traceability, detect drift, and ensure compliance
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
            const project = projects.find((p) => p.project_id === e.target.value);
            setSelectedProject(project || null);
          }}
          className='border-border bg-background text-card-foreground focus:ring-primary w-full max-w-md rounded-lg border px-3 py-2.5 text-base focus:ring-2 focus:outline-none sm:text-sm'
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

      {/* Tabs */}
      <div className='mb-6 border-b border-white/10'>
        <div className='flex gap-2 overflow-x-auto pb-2 sm:gap-4'>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-[44px] min-w-[44px] items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition sm:px-4 ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-card-foreground'
                }`}
              >
                <Icon className='h-4 w-4 flex-shrink-0' />
                <span className='hidden sm:inline'>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'requirements' && (
        <RequirementsTab
          selectedProject={selectedProject}
          requirements={requirements}
          features={features}
          suggestions={suggestions}
          completionPercentage={completionPercentage}
          loading={loading}
          matching={matching}
          documentContent={documentContent}
          uploadedFile={uploadedFile}
          showUpload={showUpload}
          accepting={accepting}
          rejecting={rejecting}
          onFileUpload={handleFileUpload}
          onDocumentContentChange={setDocumentContent}
          onExtractRequirements={handleExtractRequirements}
          onMatchRequirements={handleMatchRequirements}
          onAcceptSuggestion={handleAcceptSuggestion}
          onRejectSuggestion={handleRejectSuggestion}
          onVerifyMatch={handleVerifyMatch}
          onShowUpload={() => setShowUpload(true)}
          onHideUpload={() => {
            setShowUpload(false);
            setDocumentContent('');
            setUploadedFile(null);
          }}
        />
      )}

      {activeTab === 'traceability' && (
        <TraceabilityTab
          selectedProject={selectedProject}
          requirements={requirements}
          traceabilityMatrix={traceabilityMatrix}
          requirementTraceability={requirementTraceability}
          loading={loadingTraceability}
          onLoadMatrix={loadTraceabilityMatrix}
          onLoadRequirementTraceability={loadRequirementTraceability}
          onExport={handleExportTraceability}
        />
      )}

      {activeTab === 'drift' && (
        <DriftTab
          selectedProject={selectedProject}
          requirements={requirements}
          driftResults={driftResults}
          loading={loadingDrift}
          onLoadDrift={loadDrift}
          onCheckRequirementDrift={handleCheckRequirementDrift}
        />
      )}

      {activeTab === 'gaps' && (
        <GapAnalysisTab
          selectedProject={selectedProject}
          gaps={gaps}
          highPriorityGaps={highPriorityGaps}
          loading={loadingGaps}
          selectedGap={selectedGap}
          implementationSuggestions={implementationSuggestions}
          onLoadGaps={loadGaps}
          onGetSuggestions={handleGetSuggestions}
        />
      )}

      {activeTab === 'compliance' && (
        <ComplianceTab
          selectedProject={selectedProject}
          complianceReport={complianceReport}
          loading={loadingCompliance}
          onLoadReport={loadComplianceReport}
          onValidate={handleValidateCompliance}
        />
      )}

      {activeTab === 'versioning' && (
        <VersioningTab
          selectedProject={selectedProject}
          requirements={requirements}
          versionHistory={versionHistory}
          loading={loadingVersions}
          selectedRequirement={selectedRequirement}
          onLoadHistory={loadVersionHistory}
          onCreateVersion={handleCreateVersion}
        />
      )}
    </div>
  );
}

// Requirements Tab Component
function RequirementsTab({
  selectedProject,
  requirements,
  features,
  suggestions,
  completionPercentage,
  loading,
  matching,
  documentContent,
  uploadedFile,
  showUpload,
  accepting,
  rejecting,
  onFileUpload,
  onDocumentContentChange,
  onExtractRequirements,
  onMatchRequirements,
  onAcceptSuggestion,
  onRejectSuggestion,
  onVerifyMatch,
  onShowUpload,
  onHideUpload,
}: any) {
  return (
    <div className='space-y-6'>
      {/* Upload Section */}
      {selectedProject && (
        <div className='rounded-lg border border-white/10 bg-white/5 p-6'>
          {!showUpload ? (
            <button
              onClick={onShowUpload}
              className='bg-primary hover:bg-primary/80 text-primary-foreground flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium transition'
            >
              <UploadIcon className='h-4 w-4' />
              <span className='hidden sm:inline'>Upload Requirements Document</span>
              <span className='sm:hidden'>Upload Document</span>
            </button>
          ) : (
            <div className='space-y-4'>
              <div>
                <label className='text-card-foreground mb-2 block text-sm font-medium'>
                  Document Content
                </label>
                <textarea
                  value={documentContent}
                  onChange={(e) => onDocumentContentChange(e.target.value)}
                  placeholder='Paste requirements document content or upload a file...'
                  rows={10}
                  className='border-border bg-background text-card-foreground focus:ring-primary w-full resize-none rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none'
                />
                <div className='mt-2 flex items-center gap-4'>
                  <label className='text-card-foreground text-primary hover:text-primary/80 flex cursor-pointer items-center gap-2 text-sm'>
                    <UploadIcon className='h-4 w-4' />
                    <span>Upload File (TXT, MD, PDF, DOCX)</span>
                    <input
                      type='file'
                      accept='.txt,.md,.pdf,.docx'
                      onChange={onFileUpload}
                      className='hidden'
                    />
                  </label>
                  {uploadedFile && (
                    <span className='text-muted-foreground text-sm'>
                      {uploadedFile.name}
                    </span>
                  )}
                </div>
              </div>
              <div className='flex gap-2'>
                <button
                  onClick={onExtractRequirements}
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
                  onClick={onHideUpload}
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
        <div className='rounded-lg border border-white/10 bg-white/5 p-6'>
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
            {requirements.filter((r:any) => (r.requirementMatches?.length || 0) > 0).length} matched
            to code
          </p>
        </div>
      )}

      {/* Suggestions */}
      {selectedProject && suggestions.length > 0 && (
        <div className='mb-6 space-y-4'>
          <div className='flex items-center gap-2'>
            <LightbulbIcon className='h-5 w-5 text-yellow-500' />
            <h2 className='text-card-foreground text-xl font-semibold'>
              Suggestions ({suggestions.length})
            </h2>
          </div>
          {suggestions.map((requirement: Requirement) => (
            <div
              key={requirement.id}
              className='rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4'
            >
              <div className='mb-3 flex items-start justify-between'>
                <div className='flex-1'>
                  <div className='mb-2 flex items-center gap-2'>
                    <LightbulbIcon className='h-4 w-4 text-yellow-500' />
                    <h3 className='text-card-foreground font-medium'>{requirement.title}</h3>
                    <span className='text-muted-foreground rounded bg-yellow-500/20 px-2 py-0.5 text-xs'>
                      Suggestion
                    </span>
                  </div>
                  <p className='text-muted-foreground text-sm'>{requirement.text}</p>
                </div>
                <div className='ml-4 flex gap-2'>
                  <button
                    onClick={() => onAcceptSuggestion(requirement.id)}
                    disabled={accepting === requirement.id || rejecting === requirement.id}
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
                    onClick={() => onRejectSuggestion(requirement.id)}
                    disabled={accepting === requirement.id || rejecting === requirement.id}
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

      {/* Features */}
      {selectedProject && features.length > 0 && (
        <div className='space-y-4'>
          <h2 className='text-card-foreground text-xl font-semibold'>
            Requirements ({features.length})
          </h2>
          {features.map((requirement: Requirement) => (
            <div
              key={requirement.id}
              className='rounded-lg border border-white/10 bg-white/5 p-4'
            >
              <div className='mb-3 flex items-start justify-between'>
                <div className='flex-1'>
                  <h3 className='text-card-foreground mb-2 font-medium'>{requirement.title}</h3>
                  <p className='text-muted-foreground text-sm'>{requirement.text}</p>
                </div>
                <button
                  onClick={() => onMatchRequirements(requirement.id)}
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
              {requirement.requirementMatches && requirement.requirementMatches.length > 0 && (
                <div className='mt-4 border-t border-white/10 pt-4'>
                  <h4 className='text-card-foreground mb-2 text-sm font-medium'>
                    Matched Code ({requirement.requirementMatches.length})
                  </h4>
                  <div className='space-y-2'>
                    {requirement.requirementMatches.map((match: RequirementMatch) => (
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
                              {match.node?.nodeType} • Score: {match.matchScore.toFixed(2)} •{' '}
                              {match.confidence}
                            </div>
                          </div>
                          <div className='ml-4 flex items-center gap-2'>
                            {match.confidence === 'high' ? (
                              <CheckCircleIcon className='h-5 w-5 text-green-500' />
                            ) : match.confidence === 'medium' ? (
                              <ClockIcon className='h-5 w-5 text-yellow-500' />
                            ) : (
                              <AlertCircleIcon className='h-5 w-5 text-orange-500' />
                            )}
                            {!match.matchTypes.includes('verified') && (
                              <button
                                onClick={() => onVerifyMatch(match.id, 'verified')}
                                className='text-primary hover:text-primary/80 text-xs'
                              >
                                Verify
                              </button>
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
            Upload a requirements document to get started with matching requirements to your
            codebase.
          </p>
          <button
            onClick={onShowUpload}
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

// Traceability Tab Component
function TraceabilityTab({
  selectedProject,
  requirements,
  traceabilityMatrix,
  requirementTraceability,
  loading,
  onLoadMatrix,
  onLoadRequirementTraceability,
  onExport,
}: any) {
  return (
    <div className='space-y-6'>
      {!selectedProject ? (
        <div className='text-muted-foreground text-center'>Please select a project</div>
      ) : (
        <>
          <div className='flex items-center justify-between'>
            <h2 className='text-card-foreground text-xl font-semibold'>Traceability Matrix</h2>
            <div className='flex gap-2'>
              <button
                onClick={onLoadMatrix}
                disabled={loading}
                className='bg-primary hover:bg-primary/80 text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
              >
                {loading ? (
                  <LoaderIcon className='h-4 w-4 animate-spin' />
                ) : (
                  <RefreshCwIcon className='h-4 w-4' />
                )}
                Refresh
              </button>
              <button
                onClick={() => onExport('json')}
                className='text-muted-foreground hover:text-card-foreground flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm transition'
              >
                <DownloadIcon className='h-4 w-4' />
                Export JSON
              </button>
              <button
                onClick={() => onExport('csv')}
                className='text-muted-foreground hover:text-card-foreground flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm transition'
              >
                <DownloadIcon className='h-4 w-4' />
                Export CSV
              </button>
            </div>
          </div>

          {loading ? (
            <div className='text-muted-foreground text-center'>Loading traceability matrix...</div>
          ) : traceabilityMatrix ? (
            <div className='rounded-lg border border-white/10 bg-white/5 p-6'>
              <pre className='text-muted-foreground overflow-auto text-xs'>
                {JSON.stringify(traceabilityMatrix, null, 2)}
              </pre>
            </div>
          ) : (
            <div className='text-muted-foreground text-center'>
              Click Refresh to generate traceability matrix
            </div>
          )}

          <div className='mt-6'>
            <h3 className='text-card-foreground mb-4 text-lg font-semibold'>
              Requirement Traceability
            </h3>
            <div className='space-y-2'>
              {requirements.map((req: Requirement) => (
                <button
                  key={req.id}
                  onClick={() => onLoadRequirementTraceability(req.id)}
                  className='text-card-foreground hover:bg-white/5 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left transition'
                >
                  <div className='font-medium'>{req.title}</div>
                  <div className='text-muted-foreground text-sm'>{req.text.substring(0, 100)}...</div>
                </button>
              ))}
            </div>
          </div>

          {requirementTraceability && (
            <div className='rounded-lg border border-white/10 bg-white/5 p-6'>
              <h4 className='text-card-foreground mb-4 font-semibold'>Traceability Chain</h4>
              <pre className='text-muted-foreground overflow-auto text-xs'>
                {JSON.stringify(requirementTraceability, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Drift Detection Tab Component
function DriftTab({
  selectedProject,
  requirements,
  driftResults,
  loading,
  onLoadDrift,
  onCheckRequirementDrift,
}: any) {
  return (
    <div className='space-y-6'>
      {!selectedProject ? (
        <div className='text-muted-foreground text-center'>Please select a project</div>
      ) : (
        <>
          <div className='flex items-center justify-between'>
            <h2 className='text-card-foreground text-xl font-semibold'>Drift Detection</h2>
            <button
              onClick={onLoadDrift}
              disabled={loading}
              className='bg-primary hover:bg-primary/80 text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
            >
              {loading ? (
                <LoaderIcon className='h-4 w-4 animate-spin' />
              ) : (
                <RefreshCwIcon className='h-4 w-4' />
              )}
              Check for Drift
            </button>
          </div>

          {loading ? (
            <div className='text-muted-foreground text-center'>Checking for drift...</div>
          ) : driftResults ? (
            <div className='rounded-lg border border-white/10 bg-white/5 p-6'>
              <pre className='text-muted-foreground overflow-auto text-xs'>
                {JSON.stringify(driftResults, null, 2)}
              </pre>
            </div>
          ) : (
            <div className='text-muted-foreground text-center'>
              Click "Check for Drift" to detect requirements drift
            </div>
          )}

          <div className='mt-6'>
            <h3 className='text-card-foreground mb-4 text-lg font-semibold'>
              Check Individual Requirements
            </h3>
            <div className='space-y-2'>
              {requirements.map((req: Requirement) => (
                <button
                  key={req.id}
                  onClick={() => onCheckRequirementDrift(req.id)}
                  className='text-card-foreground hover:bg-white/5 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left transition'
                >
                  <div className='font-medium'>{req.title}</div>
                  <div className='text-muted-foreground text-sm'>{req.text.substring(0, 100)}...</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Gap Analysis Tab Component
function GapAnalysisTab({
  selectedProject,
  gaps,
  highPriorityGaps,
  loading,
  selectedGap,
  implementationSuggestions,
  onLoadGaps,
  onGetSuggestions,
}: any) {
  return (
    <div className='space-y-6'>
      {!selectedProject ? (
        <div className='text-muted-foreground text-center'>Please select a project</div>
      ) : (
        <>
          <div className='flex items-center justify-between'>
            <h2 className='text-card-foreground text-xl font-semibold'>Gap Analysis</h2>
            <button
              onClick={onLoadGaps}
              disabled={loading}
              className='bg-primary hover:bg-primary/80 text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
            >
              {loading ? (
                <LoaderIcon className='h-4 w-4 animate-spin' />
              ) : (
                <RefreshCwIcon className='h-4 w-4' />
              )}
              Refresh Gaps
            </button>
          </div>

          {highPriorityGaps.length > 0 && (
            <div className='rounded-lg border border-red-500/20 bg-red-500/5 p-6'>
              <div className='mb-4 flex items-center gap-2'>
                <AlertTriangleIcon className='h-5 w-5 text-red-500' />
                <h3 className='text-card-foreground text-lg font-semibold'>
                  High Priority Gaps ({highPriorityGaps.length})
                </h3>
              </div>
              <div className='space-y-2'>
                {highPriorityGaps.map((gap: any) => (
                  <div
                    key={gap.id}
                    className='rounded border border-red-500/20 bg-white/5 p-3'
                  >
                    <div className='font-medium'>{gap.title}</div>
                    <div className='text-muted-foreground text-sm'>{gap.text}</div>
                    <button
                      onClick={() => onGetSuggestions(gap.id)}
                      className='text-primary hover:text-primary/80 mt-2 text-sm'
                    >
                      Get Implementation Suggestions
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className='text-card-foreground mb-4 text-lg font-semibold'>
              All Gaps ({gaps.length})
            </h3>
            {gaps.length === 0 ? (
              <div className='text-muted-foreground text-center'>No gaps found</div>
            ) : (
              <div className='space-y-2'>
                {gaps.map((gap: any) => (
                  <div
                    key={gap.id}
                    className='rounded-lg border border-white/10 bg-white/5 p-4'
                  >
                    <div className='font-medium'>{gap.title}</div>
                    <div className='text-muted-foreground text-sm'>{gap.text}</div>
                    <button
                      onClick={() => onGetSuggestions(gap.id)}
                      className='text-primary hover:text-primary/80 mt-2 text-sm'
                    >
                      Get Implementation Suggestions
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {implementationSuggestions && (
            <div className='rounded-lg border border-white/10 bg-white/5 p-6'>
              <h4 className='text-card-foreground mb-4 font-semibold'>
                Implementation Suggestions
              </h4>
              <pre className='text-muted-foreground overflow-auto text-xs'>
                {JSON.stringify(implementationSuggestions, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Compliance Tab Component
function ComplianceTab({
  selectedProject,
  complianceReport,
  loading,
  onLoadReport,
  onValidate,
}: any) {
  return (
    <div className='space-y-6'>
      {!selectedProject ? (
        <div className='text-muted-foreground text-center'>Please select a project</div>
      ) : (
        <>
          <div className='flex items-center justify-between'>
            <h2 className='text-card-foreground text-xl font-semibold'>Compliance Reports</h2>
            <div className='flex gap-2'>
              <button
                onClick={() => onLoadReport('json')}
                disabled={loading}
                className='bg-primary hover:bg-primary/80 text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
              >
                {loading ? (
                  <LoaderIcon className='h-4 w-4 animate-spin' />
                ) : (
                  <FileIcon className='h-4 w-4' />
                )}
                Generate Report
              </button>
              <button
                onClick={() => onValidate()}
                className='text-muted-foreground hover:text-card-foreground flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm transition'
              >
                <ShieldCheckIcon className='h-4 w-4' />
                Validate Compliance
              </button>
            </div>
          </div>

          {loading ? (
            <div className='text-muted-foreground text-center'>Generating compliance report...</div>
          ) : complianceReport ? (
            <div className='rounded-lg border border-white/10 bg-white/5 p-6'>
              <pre className='text-muted-foreground overflow-auto text-xs'>
                {JSON.stringify(complianceReport, null, 2)}
              </pre>
            </div>
          ) : (
            <div className='text-muted-foreground text-center'>
              Click "Generate Report" to create a compliance report
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Versioning Tab Component
function VersioningTab({
  selectedProject,
  requirements,
  versionHistory,
  loading,
  selectedRequirement,
  onLoadHistory,
  onCreateVersion,
}: any) {
  const [showCreateVersion, setShowCreateVersion] = useState(false);
  const [versionData, setVersionData] = useState({ title: '', text: '', type: '', status: '' });

  return (
    <div className='space-y-6'>
      {!selectedProject ? (
        <div className='text-muted-foreground text-center'>Please select a project</div>
      ) : (
        <>
          <div className='flex items-center justify-between'>
            <h2 className='text-card-foreground text-xl font-semibold'>Requirement Versioning</h2>
          </div>

          <div>
            <h3 className='text-card-foreground mb-4 text-lg font-semibold'>
              Select Requirement to View History
            </h3>
            <div className='space-y-2'>
              {requirements.map((req: Requirement) => (
                <div
                  key={req.id}
                  className='flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3'
                >
                  <div className='flex-1'>
                    <div className='font-medium'>{req.title}</div>
                    <div className='text-muted-foreground text-sm'>{req.text.substring(0, 100)}...</div>
                  </div>
                  <button
                    onClick={() => onLoadHistory(req.id)}
                    className='text-primary hover:text-primary/80 flex items-center gap-2 text-sm'
                  >
                    <HistoryIcon className='h-4 w-4' />
                    View History
                  </button>
                </div>
              ))}
            </div>
          </div>

          {selectedRequirement && (
            <div className='rounded-lg border border-white/10 bg-white/5 p-6'>
              <div className='mb-4 flex items-center justify-between'>
                <h4 className='text-card-foreground font-semibold'>
                  Version History: {selectedRequirement.title}
                </h4>
                <button
                  onClick={() => setShowCreateVersion(!showCreateVersion)}
                  className='bg-primary hover:bg-primary/80 text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium transition'
                >
                  Create New Version
                </button>
              </div>

              {showCreateVersion && (
                <div className='mb-4 space-y-2 rounded-lg border border-white/10 bg-white/5 p-4'>
                  <input
                    type='text'
                    placeholder='Title'
                    value={versionData.title}
                    onChange={(e) => setVersionData({ ...versionData, title: e.target.value })}
                    className='border-border bg-background text-card-foreground w-full rounded-lg border px-3 py-2'
                  />
                  <textarea
                    placeholder='Text'
                    value={versionData.text}
                    onChange={(e) => setVersionData({ ...versionData, text: e.target.value })}
                    rows={4}
                    className='border-border bg-background text-card-foreground w-full rounded-lg border px-3 py-2'
                  />
                  <div className='flex gap-2'>
                    <button
                      onClick={() => {
                        onCreateVersion(selectedRequirement.id, versionData);
                        setShowCreateVersion(false);
                        setVersionData({ title: '', text: '', type: '', status: '' });
                      }}
                      className='bg-primary hover:bg-primary/80 text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium transition'
                    >
                      Create Version
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateVersion(false);
                        setVersionData({ title: '', text: '', type: '', status: '' });
                      }}
                      className='text-muted-foreground hover:text-card-foreground px-4 py-2 text-sm'
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {loading ? (
                <div className='text-muted-foreground text-center'>Loading version history...</div>
              ) : versionHistory.length > 0 ? (
                <div className='space-y-2'>
                  {versionHistory.map((version: any, index: number) => (
                    <div
                      key={version.id || index}
                      className='rounded border border-white/10 bg-white/5 p-3'
                    >
                      <div className='font-medium'>{version.title || 'Version ' + (index + 1)}</div>
                      <div className='text-muted-foreground text-sm'>{version.text}</div>
                      <div className='text-muted-foreground mt-1 text-xs'>
                        {version.createdAt && new Date(version.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='text-muted-foreground text-center'>No version history found</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
