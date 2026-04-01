'use client';

export const runtime = 'edge';

import { useState, useEffect, useRef } from 'react';
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
  BarChart3Icon,
  BarChartIcon,
} from '../../components/LucideIcons';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
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

type TabType = 'requirements' | 'traceability' | 'metrics' | 'research' | 'stats' | 'drift' | 'gaps' | 'compliance' | 'versioning';

export default function RequirementsPage() {
  const {
    getProjects,
    getProjectRequirements,
    extractRequirements,
    extractRequirementsFromFile,
    matchRequirements,
    matchAllRequirements,
    matchAllBaselines,
    deleteRequirement,
    deleteProjectRequirements,
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
    getTraceabilityMetrics,
    getCompare,
    runThresholdTuning,
    getGroundTruth,
    addGroundTruth,
    addGroundTruthBulk,
    removeGroundTruth,
    matchAllAllRequirements,
    apiBase,
    getQueueStatus,
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
  const [autoMatch, setAutoMatch] = useState(true);
  const [matcherType, setMatcherType] = useState<string>('hybrid');
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

  // Metrics & ground truth state
  const [metricsData, setMetricsData] = useState<any>(null);
  const [metricsMatcherType, setMetricsMatcherType] = useState<string>('hybrid');
  const [compareData, setCompareData] = useState<Array<{ matcherType: string; precision: number; recall: number; f1: number; coverage: number; threshold?: number }> | null>(null);
  const [compareAtThreshold, setCompareAtThreshold] = useState<string>('0.3');
  const [tuningMatcher, setTuningMatcher] = useState<string | null>(null);
  const [groundTruthList, setGroundTruthList] = useState<any[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [addingGroundTruth, setAddingGroundTruth] = useState<string | null>(null);
  const [addingBulkGroundTruth, setAddingBulkGroundTruth] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState<{ waiting: number; active: number; completed: number; failed: number } | null>(null);
  const metricsTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadRequirements();
      if (activeTab === 'traceability') {
        loadTraceabilityMatrix();
      } else if (activeTab === 'metrics') {
        loadMetrics();
        loadGroundTruthList();
        loadCompareIfMetricsTab();
      } else if (activeTab === 'requirements') {
        loadGroundTruthList();
      }
      if (activeTab === 'drift') {
        loadDrift();
      }
      if (activeTab === 'gaps') {
        loadGaps();
      }
    }
  }, [selectedProject, activeTab]);

  useEffect(() => {
    if (selectedProject && (activeTab === 'metrics' || activeTab === 'research')) loadMetrics();
  }, [metricsMatcherType, activeTab]);

  useEffect(() => {
    if (selectedProject && activeTab === 'research') {
      loadMetrics();
      getCompare(selectedProject.project_id).then((list) => setCompareData(Array.isArray(list) ? list : null)).catch(() => setCompareData(null));
    }
  }, [selectedProject, activeTab]);

  // Poll queue status every 3 seconds if we are on metrics or research tab
  useEffect(() => {
    if (activeTab !== 'metrics' && activeTab !== 'research') {
      setQueueStatus(null);
      return;
    }

    const poll = async () => {
      try {
        const status = await getQueueStatus();
        setQueueStatus(status);
      } catch (e) {
        // Silently fail polling
      }
    };

    poll(); // initial check
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [activeTab, getQueueStatus]);

  const loadCompareIfMetricsTab = async () => {
    if (!selectedProject || activeTab !== 'metrics') return;
    try {
      const list = await getCompare(selectedProject.project_id);
      setCompareData(Array.isArray(list) ? list : null);
    } catch {
      setCompareData(null);
    }
  };

  const loadMetrics = async (matcher?: string, debounce: boolean = false) => {
    if (!selectedProject) return;

    if (debounce) {
      if (metricsTimerRef.current) clearTimeout(metricsTimerRef.current);
      metricsTimerRef.current = setTimeout(async () => {
        await executeLoadMetrics(matcher);
      }, 1000); // 1s debounce
      return;
    }

    await executeLoadMetrics(matcher);
  };

  const executeLoadMetrics = async (matcher?: string) => {
    if (!selectedProject) return;
    setLoadingMetrics(true);
    try {
      const m = matcher ?? metricsMatcherType;
      const data = await getTraceabilityMetrics(selectedProject.project_id, undefined, m);
      setMetricsData(data);
    } catch (error: any) {
      // Don't toast for transient connection errors that might be retried or are just noise
      console.error('Failed to load metrics:', error);
      if (!error?.message?.includes('reach database')) {
        toast.error('Failed to load metrics');
      }
      setMetricsData(null);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const loadGroundTruthList = async () => {
    if (!selectedProject) return;
    try {
      const list = await getGroundTruth(selectedProject.project_id);
      setGroundTruthList(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Failed to load ground truth:', error);
      setGroundTruthList([]);
    }
  };

  const handleRerunMatchAndMeasure = async () => {
    if (!selectedProject) return;
    setMatching(true);
    try {
      await matchAllRequirements(selectedProject.project_id);
      await loadRequirements();
      await loadMetrics();
      await loadGroundTruthList();
      toast.success('Matching complete. Metrics updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to run matching');
    } finally {
      setMatching(false);
    }
  };

  const handleMatchAllWithMatcher = async () => {
    if (!selectedProject) return;
    setMatching(true);
    try {
      await matchAllRequirements(selectedProject.project_id, metricsMatcherType);
      await loadRequirements();
      await loadMetrics();
      await loadGroundTruthList();
      toast.success(`Matching complete for ${metricsMatcherType}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to run matching');
    } finally {
      setMatching(false);
    }
  };

  const handleMatchAllBaselines = async () => {
    if (!selectedProject) return;
    setMatching(true);
    try {
      const out = await matchAllBaselines(selectedProject.project_id);
      await loadRequirements();
      await loadMetrics();
      await loadGroundTruthList();
      const summary =
        out.results
          ?.map((r) => `${r.matcherType}: ${r.linksStored ?? 0} links`)
          .join('; ') ?? '';
      toast.success(`All baselines run. ${summary}`);
      const list = await getCompare(selectedProject.project_id);
      setCompareData(Array.isArray(list) ? list : null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to run all baselines');
    } finally {
      setMatching(false);
    }
  };

  const handleTuneMatcher = async () => {
    if (!selectedProject) return;
    setTuningMatcher(metricsMatcherType);
    try {
      await runThresholdTuning(selectedProject.project_id, metricsMatcherType);
      toast.success(`Tuning complete for ${metricsMatcherType}. Test run saved.`);
      await loadMetrics();
      const list = await getCompare(selectedProject.project_id);
      setCompareData(Array.isArray(list) ? list : null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to run tuning');
    } finally {
      setTuningMatcher(null);
    }
  };

  const handleLoadCompare = async () => {
    if (!selectedProject) return;
    setLoadingMetrics(true);
    try {
      const list = await getCompare(selectedProject.project_id);
      setCompareData(Array.isArray(list) ? list : null);
      if (Array.isArray(list) && list.length > 0) toast.success('Baseline comparison loaded.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load comparison');
      setCompareData(null);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleLoadCompareAtThreshold = async () => {
    if (!selectedProject) return;
    const tau = parseFloat(compareAtThreshold);
    if (Number.isNaN(tau) || tau < 0 || tau > 1) {
      toast.error('Enter a threshold between 0 and 1 (e.g. 0.3)');
      return;
    }
    setLoadingMetrics(true);
    try {
      const list = await getCompare(selectedProject.project_id, tau);
      setCompareData(Array.isArray(list) ? list : null);
      toast.success(`Comparison at τ=${tau} loaded.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load comparison');
      setCompareData(null);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleAddGroundTruth = async (requirementId: string, nodeId: string) => {
    if (!selectedProject) return;
    const key = `${requirementId}::${nodeId}`;
    setAddingGroundTruth(key);
    try {
      await addGroundTruth(selectedProject.project_id, { requirementId, nodeId, source: 'manual' });
      toast.success('Marked as ground truth');
      await loadGroundTruthList();
      if (activeTab === 'metrics') loadMetrics(undefined, true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add ground truth');
    } finally {
      setAddingGroundTruth(null);
    }
  };

  const handleAddGroundTruthBulk = async (requirementId: string, nodeIds: string[]) => {
    if (!selectedProject || nodeIds.length === 0) return;
    setAddingBulkGroundTruth(requirementId);
    try {
      await addGroundTruthBulk(selectedProject.project_id, {
        links: nodeIds.map((nodeId) => ({ requirementId, nodeId, source: 'manual' })),
      });
      toast.success(`Marked ${nodeIds.length} link(s) as ground truth`);
      await loadGroundTruthList();
      if (activeTab === 'metrics') loadMetrics(undefined, true);
      await loadRequirements();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to bulk add ground truth');
    } finally {
      setAddingBulkGroundTruth(null);
    }
  };

  const handleRemoveGroundTruth = async (requirementId: string, nodeId: string) => {
    try {
      await removeGroundTruth(requirementId, nodeId);
      toast.success('Removed from ground truth');
      await loadGroundTruthList();
      if (activeTab === 'metrics') loadMetrics(undefined, true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove ground truth');
    }
  };

  const isGroundTruth = (requirementId: string, nodeId: string) =>
    groundTruthList.some(
      (g: any) => g.requirementId === requirementId && g.nodeId === nodeId
    );

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
      let data;

      // If we have a file, upload it and extract text automatically
      if (uploadedFile && (uploadedFile.type === 'application/pdf' || uploadedFile.name.endsWith('.docx') || uploadedFile.name.endsWith('.pdf'))) {
        data = await extractRequirementsFromFile(uploadedFile, selectedProject.project_id, {
          autoMatch,
          matcherType,
        });
      } else if (documentContent.trim()) {
        // Use text content directly
        const content = documentContent.trim();
        
        // Warn if content looks like a placeholder
        if (content.startsWith('[File:') || content.startsWith('[PDF File:') || content.startsWith('[DOCX File:')) {
          toast.error('Please upload the file directly or paste the actual document content.');
          setLoading(false);
          return;
        }

        data = await extractRequirements(content, selectedProject.project_id, {
          autoMatch,
          matcherType,
        });
      } else {
        toast.error('Please upload a file or enter document content');
        setLoading(false);
        return;
      }
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

  const handleMatchAllRequirements = async () => {
    if (!selectedProject) return;

    if (requirements.length === 0) {
      toast.error('No requirements to match');
      return;
    }

    setMatching(true);
    try {
      const result = await matchAllRequirements(selectedProject.project_id);
      toast.success(`Matched ${result.matched} out of ${result.total} requirements`);
      await loadRequirements();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to match all requirements',
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

  const handleMatchAllAll = async () => {
    setMatching(true);
    try {
      const result = await matchAllAllRequirements();
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to queue all project matching');
    } finally {
      setMatching(false);
    }
  };

  const handleClearRequirements = async () => {
    if (!selectedProject) {
      toast.error('Please select a project first');
      return;
    }

    if (requirements.length === 0) {
      toast('No requirements to clear');
      return;
    }

    if (!confirm(`Are you sure you want to delete all ${requirements.length} requirement(s) for this project? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      await deleteProjectRequirements(selectedProject.project_id);
      toast.success(`Cleared ${requirements.length} requirement(s)`);
      await loadRequirements();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to clear requirements',
      );
    } finally {
      setLoading(false);
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
      toast.success('Requirement traceability loaded');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load requirement traceability';
      toast.error(errorMessage);
      console.error('Traceability error:', error);
      setRequirementTraceability(null);
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
      toast.success(`Drift detection complete: ${drift.driftedCount || 0} drifted, ${drift.stableCount || 0} stable`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to detect drift';
      toast.error(errorMessage);
      console.error('Drift detection error:', error);
      setDriftResults(null);
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
    { id: 'metrics' as TabType, label: 'Metrics', icon: BarChart3Icon },
    { id: 'research' as TabType, label: 'Research', icon: LightbulbIcon },
    { id: 'stats' as TabType, label: 'Stats', icon: BarChartIcon },
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
          onMatchAllRequirements={handleMatchAllRequirements}
          onAcceptSuggestion={handleAcceptSuggestion}
          onRejectSuggestion={handleRejectSuggestion}
          onVerifyMatch={handleVerifyMatch}
          onClearRequirements={handleClearRequirements}
          onAddGroundTruth={handleAddGroundTruth}
          onAddGroundTruthBulk={handleAddGroundTruthBulk}
          onRemoveGroundTruth={handleRemoveGroundTruth}
          isGroundTruth={isGroundTruth}
          addingGroundTruth={addingGroundTruth}
          addingBulkGroundTruth={addingBulkGroundTruth}
          onShowUpload={() => setShowUpload(true)}
          onHideUpload={() => {
            setShowUpload(false);
            setDocumentContent('');
            setUploadedFile(null);
          }}
          autoMatch={autoMatch}
          setAutoMatch={setAutoMatch}
          matcherType={matcherType}
          setMatcherType={setMatcherType}
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

      {activeTab === 'metrics' && (
        <MetricsTab
          selectedProject={selectedProject}
          metricsData={metricsData}
          metricsMatcherType={metricsMatcherType}
          setMetricsMatcherType={setMetricsMatcherType}
          compareData={compareData}
          tuningMatcher={tuningMatcher}
          groundTruthList={groundTruthList}
          loading={loadingMetrics}
          matching={matching}
          onRerunAndMeasure={handleRerunMatchAndMeasure}
          onMatchAllWithMatcher={handleMatchAllWithMatcher}
          onMatchAllBaselines={handleMatchAllBaselines}
          onTuneMatcher={handleTuneMatcher}
          onLoadCompare={handleLoadCompare}
          compareAtThreshold={compareAtThreshold}
          setCompareAtThreshold={setCompareAtThreshold}
          onLoadCompareAtThreshold={handleLoadCompareAtThreshold}
          onMeasure={() => loadMetrics()}
          onRemoveGroundTruth={handleRemoveGroundTruth}
          onMatchAllAll={handleMatchAllAll}
          queueStatus={queueStatus}
        />
      )}

      {activeTab === 'research' && (
        <ResearchTab
          selectedProject={selectedProject}
          projects={projects}
          getCompare={getCompare}
          metricsData={metricsData}
          metricsMatcherType={metricsMatcherType}
          setMetricsMatcherType={setMetricsMatcherType}
          compareData={compareData}
          loading={loadingMetrics}
          onRefresh={() => {
            if (selectedProject) {
              loadMetrics();
              getCompare(selectedProject.project_id).then((list) => setCompareData(Array.isArray(list) ? list : null)).catch(() => setCompareData(null));
            }
          }}
          onMatchAllAll={handleMatchAllAll}
          matching={matching}
          queueStatus={queueStatus}
        />
      )}

      {activeTab === 'stats' && (
        <StatsTab
          projects={projects}
          getCompare={getCompare}
          loading={loadingMetrics}
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
  onMatchAllRequirements,
  onAcceptSuggestion,
  onRejectSuggestion,
  onVerifyMatch,
  onClearRequirements,
  onAddGroundTruth,
  onAddGroundTruthBulk,
  onRemoveGroundTruth,
  isGroundTruth,
  addingGroundTruth,
  addingBulkGroundTruth,
  onShowUpload,
  onHideUpload,
  autoMatch,
  setAutoMatch,
  matcherType,
  setMatcherType,
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

                {/* Auto-match options */}
                <div className='flex flex-wrap items-center gap-6 rounded-lg border border-white/10 bg-white/5 p-4'>
                  <div className='flex items-center gap-3'>
                    <input
                      type='checkbox'
                      id='autoMatchCheckbox'
                      checked={autoMatch}
                      onChange={(e) => setAutoMatch(e.target.checked)}
                      className='border-border text-primary focus:ring-primary h-5 w-5 cursor-pointer rounded bg-transparent focus:ring-offset-0 focus:outline-none'
                    />
                    <label
                      htmlFor='autoMatchCheckbox'
                      className='text-card-foreground flex cursor-pointer items-center gap-2 text-sm font-medium'
                    >
                      <TargetIcon className='h-4 w-4 text-primary' />
                      Auto-run traceability matching after extraction
                    </label>
                  </div>

                  {autoMatch && (
                    <div className='flex items-center gap-3'>
                      <label className='text-muted-foreground text-sm font-medium'>
                        Matcher Type:
                      </label>
                      <select
                        value={matcherType}
                        onChange={(e) => setMatcherType(e.target.value)}
                        className='border-border bg-background text-card-foreground focus:ring-primary h-9 rounded-md border px-3 py-1 text-sm focus:ring-2 focus:outline-none'
                      >
                        <option value='hybrid'>Hybrid (Semantic + Symbol)</option>
                        <option value='embedding'>Embedding Only (Semantic)</option>
                        <option value='tfidf'>TF-IDF (Keyword)</option>
                        <option value='structural-only'>Structural Only</option>
                      </select>
                    </div>
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
            <div className='flex items-center gap-4'>
              <div className='text-card-foreground text-2xl font-bold'>
                {completionPercentage}%
              </div>
              {onClearRequirements && (
                <button
                  onClick={onClearRequirements}
                  disabled={loading}
                  className='text-muted-foreground hover:text-red-500 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-sm font-medium transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50'
                  title='Clear all requirements for this project'
                >
                  <XIcon className='h-4 w-4' />
                  Clear All
                </button>
              )}
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
          <div className='flex items-center justify-between'>
            <h2 className='text-card-foreground text-xl font-semibold'>
              Requirements ({features.length})
            </h2>
            <div className='flex items-center gap-2'>
              {onMatchAllRequirements && (
                <button
                  onClick={onMatchAllRequirements}
                  disabled={matching || loading}
                  className='bg-primary hover:bg-primary/80 text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
                >
                  {matching ? (
                    <>
                      <LoaderIcon className='h-4 w-4 animate-spin' />
                      Matching All...
                    </>
                  ) : (
                    <>
                      <SearchIcon className='h-4 w-4' />
                      Match All
                    </>
                  )}
                </button>
              )}
              {onClearRequirements && (
                <button
                  onClick={onClearRequirements}
                  disabled={loading}
                  className='text-muted-foreground hover:text-red-500 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-sm font-medium transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <XIcon className='h-4 w-4' />
                  Clear All
                </button>
              )}
            </div>
          </div>
          {features.map((requirement: Requirement) => {
            const matchCount = requirement.requirementMatches?.length || 0;
            const completionPercentage = (requirement as any).completionPercentage || 0;
            const isMatched = matchCount > 0;
            
            return (
            <div
              key={requirement.id}
              className={`rounded-lg border p-4 ${
                isMatched
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-orange-500/30 bg-orange-500/5'
              }`}
            >
              <div className='mb-3 flex items-start justify-between'>
                <div className='flex-1'>
                  <div className='mb-2 flex items-center gap-2'>
                    {isMatched ? (
                      <CheckCircleIcon className='h-5 w-5 text-green-500 flex-shrink-0' />
                    ) : (
                      <AlertCircleIcon className='h-5 w-5 text-orange-500 flex-shrink-0' />
                    )}
                    <h3 className='text-card-foreground font-medium'>{requirement.title}</h3>
                    {isMatched ? (
                      <span className='text-muted-foreground rounded bg-green-500/20 px-2 py-0.5 text-xs'>
                        {completionPercentage}% Complete
                      </span>
                    ) : (
                      <span className='text-muted-foreground rounded bg-orange-500/20 px-2 py-0.5 text-xs'>
                        Not matched yet
                      </span>
                    )}
                  </div>
                  <p className='text-muted-foreground text-sm'>{requirement.text}</p>
                  {isMatched ? (
                    <div className='mt-2 flex items-center gap-4 text-xs'>
                      <span className='text-muted-foreground'>
                        {matchCount} match{matchCount !== 1 ? 'es' : ''} found
                      </span>
                      <div className='flex items-center gap-2'>
                        <div className='h-2 w-24 rounded-full bg-white/10'>
                          <div
                            className='h-2 rounded-full bg-green-500 transition-all'
                            style={{ width: `${completionPercentage}%` }}
                          />
                        </div>
                        <span className='text-muted-foreground'>{completionPercentage}%</span>
                      </div>
                    </div>
                  ) : (
                    <div className='mt-2 text-xs'>
                      <span className='text-orange-500'>No matches found. Click "Match to Code" to find implementations.</span>
                    </div>
                  )}
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
                      {isMatched ? 'Re-match' : 'Match to Code'}
                    </>
                  )}
                </button>
              </div>

              {/* Matches */}
              {requirement.requirementMatches && requirement.requirementMatches.length > 0 && (
                <div className='mt-4 border-t border-white/10 pt-4'>
                  <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
                    <h4 className='text-card-foreground text-sm font-medium'>
                      Matched Code ({requirement.requirementMatches.length})
                    </h4>
                    {onAddGroundTruthBulk && (() => {
                      const notYetGT = requirement.requirementMatches.filter(
                        (m: RequirementMatch) => !isGroundTruth?.(requirement.id, m.nodeId)
                      );
                      if (notYetGT.length === 0) return null;
                      return (
                        <button
                          onClick={() =>
                            onAddGroundTruthBulk(
                              requirement.id,
                              notYetGT.map((m: RequirementMatch) => m.nodeId)
                            )
                          }
                          disabled={addingBulkGroundTruth === requirement.id}
                          className='text-primary hover:text-primary/80 flex items-center gap-1 text-xs disabled:opacity-50'
                          title='Mark all matched code links as ground truth'
                        >
                          {addingBulkGroundTruth === requirement.id ? (
                            <LoaderIcon className='h-4 w-4 animate-spin' />
                          ) : (
                            <BarChart3Icon className='h-4 w-4' />
                          )}
                          Mark all as GT ({notYetGT.length})
                        </button>
                      );
                    })()}
                  </div>
                  <div className='space-y-2'>
                    {requirement.requirementMatches.map((match: RequirementMatch) => {
                      const gt = isGroundTruth?.(requirement.id, match.nodeId);
                      const key = `${requirement.id}::${match.nodeId}`;
                      const adding = addingGroundTruth === key || addingBulkGroundTruth === requirement.id;
                      return (
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
                                {match.node?.nodeType} • Score: <strong>{match.matchScore.toFixed(2)}</strong> •{' '}
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
                              {onAddGroundTruth && (
                                gt ? (
                                  <div className='flex items-center gap-2'>
                                    <span className='text-muted-foreground flex items-center gap-1 text-xs' title='Ground truth'>
                                      <CheckCircleIcon className='h-4 w-4 text-green-500' /> GT
                                    </span>
                                    {onRemoveGroundTruth && (
                                      <button
                                        onClick={() => onRemoveGroundTruth(requirement.id, match.nodeId)}
                                        className='text-muted-foreground hover:text-red-500 text-xs'
                                        title='Remove from ground truth'
                                      >
                                        <XIcon className='h-3 w-3' />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => onAddGroundTruth(requirement.id, match.nodeId)}
                                    disabled={adding}
                                    className='text-primary hover:text-primary/80 flex items-center gap-1 text-xs disabled:opacity-50'
                                    title='Mark as ground truth (for metrics)'
                                  >
                                    {adding ? <LoaderIcon className='h-4 w-4 animate-spin' /> : <BarChart3Icon className='h-4 w-4' />}
                                    Mark as GT
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            );
          })}
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

const MATCHER_OPTIONS = [
  { value: 'tfidf', label: 'TF-IDF' },
  { value: 'embedding', label: 'Embedding only' },
  { value: 'structural-only', label: 'Structural only' },
  { value: 'hybrid', label: 'Hybrid' },
];

// Metrics Tab: precision, recall, F1, coverage at thresholds; ground truth; matcher selector; compare baselines
function MetricsTab({
  selectedProject,
  metricsData,
  metricsMatcherType,
  setMetricsMatcherType,
  compareData,
  tuningMatcher,
  groundTruthList,
  loading,
  matching,
  onRerunAndMeasure,
  onMatchAllWithMatcher,
  onMatchAllBaselines,
  onTuneMatcher,
  onLoadCompare,
  compareAtThreshold,
  setCompareAtThreshold,
  onLoadCompareAtThreshold,
  onMeasure,
  onRemoveGroundTruth,
  onMatchAllAll,
  queueStatus,
}: {
  selectedProject: Project | null;
  metricsData: any;
  metricsMatcherType: string;
  setMetricsMatcherType: (v: string) => void;
  compareData: Array<{ matcherType: string; precision: number; recall: number; f1: number; coverage: number; threshold?: number }> | null;
  tuningMatcher: string | null;
  groundTruthList: any[];
  loading: boolean;
  matching: boolean;
  onRerunAndMeasure: () => Promise<void>;
  onMatchAllWithMatcher: () => Promise<void>;
  onMatchAllBaselines: () => Promise<void>;
  onTuneMatcher: () => Promise<void>;
  onLoadCompare: () => Promise<void>;
  compareAtThreshold: string;
  setCompareAtThreshold: (v: string) => void;
  onLoadCompareAtThreshold: () => Promise<void>;
  onMeasure: () => Promise<void>;
  onRemoveGroundTruth: (requirementId: string, nodeId: string) => Promise<void>;
  onMatchAllAll?: () => Promise<void>;
  queueStatus?: { waiting: number; active: number; completed: number; failed: number } | null;
}) {
  if (!selectedProject) {
    return <div className='text-muted-foreground text-center'>Please select a project</div>;
  }

  const atThreshold = metricsData?.atThreshold ?? {};
  const thresholds = metricsData?.thresholds ?? [];
  const summary = metricsData?.summary ?? {};
  const optimalThreshold = metricsData?.optimalThreshold;
  const optimalF1 = metricsData?.optimalF1;

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <h2 className='text-card-foreground text-xl font-semibold'>Traceability Metrics</h2>
        <div className='flex flex-wrap items-center gap-4'>
          <div className='flex items-center gap-2'>
            <label htmlFor='metrics-matcher-select' className='text-muted-foreground whitespace-nowrap text-sm font-medium'>
              Baseline matcher
            </label>
            <select
              id='metrics-matcher-select'
              value={metricsMatcherType}
              onChange={(e) => setMetricsMatcherType(e.target.value)}
              className='rounded-lg border border-white/20 bg-white/95 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            >
              {MATCHER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
          <button
            onClick={onRerunAndMeasure}
            disabled={loading || matching}
            className='bg-primary hover:bg-primary/80 text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
            title='Match all with Hybrid (default)'
          >
            {matching ? <LoaderIcon className='h-4 w-4 animate-spin' /> : <RefreshCwIcon className='h-4 w-4' />}
            Rerun match (hybrid)
          </button>
          <button
            onClick={onMatchAllWithMatcher}
            disabled={loading || matching}
            className='text-primary hover:text-primary/80 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50'
            title={`Match all requirements with ${metricsMatcherType} matcher`}
          >
            {matching ? <LoaderIcon className='h-4 w-4 animate-spin' /> : <RefreshCwIcon className='h-4 w-4' />}
            Match all ({metricsMatcherType})
          </button>
          <button
            onClick={onMatchAllBaselines}
            disabled={loading || matching}
            className='bg-white/10 hover:bg-white/15 text-card-foreground flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50'
            title='Run matching for all four baselines so Compare and metrics have data for each (fixes 0.0 for other baselines)'
          >
            {matching ? <LoaderIcon className='h-4 w-4 animate-spin' /> : <RefreshCwIcon className='h-4 w-4' />}
            Match all baselines
          </button>
          <button
            onClick={onTuneMatcher}
            disabled={loading || matching || tuningMatcher != null}
            className='text-muted-foreground hover:text-card-foreground flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50'
            title='Run threshold tuning for this matcher; saves test run'
          >
            {tuningMatcher === metricsMatcherType ? <LoaderIcon className='h-4 w-4 animate-spin' /> : null}
            Tune ({metricsMatcherType})
          </button>
          <button
            onClick={onLoadCompare}
            disabled={loading}
            className='text-muted-foreground hover:text-card-foreground flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50'
            title='Load side-by-side comparison (stored Tune test runs or live at τ=0.5)'
          >
            {loading ? <LoaderIcon className='h-4 w-4 animate-spin' /> : <BarChart3Icon className='h-4 w-4' />}
            Compare baselines
          </button>
          {onMatchAllAll && (
            <div className='flex items-center gap-2'>
              <button
                onClick={onMatchAllAll}
                disabled={loading || matching}
                className='text-muted-foreground hover:text-card-foreground flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50'
                title='Queue all 4 baseline matchers for EVERY project in the system'
              >
                {matching ? <LoaderIcon className='h-4 w-4 animate-spin' /> : <RefreshCwIcon className='h-4 w-4' />}
                Run ALL projects (Queue)
              </button>
              {queueStatus && (queueStatus.active > 0 || queueStatus.waiting > 0) && (
                <div className='border-white/10 bg-white/5 text-muted-foreground flex items-center gap-2 rounded border px-3 py-1.5 text-xs'>
                  <span className='bg-yellow-500 flex h-2 w-2 animate-pulse rounded-full'></span>
                  {queueStatus.active} active, {queueStatus.waiting} waiting
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => {
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
              const url = `${apiUrl}/api/requirements/metrics/export-all/zip`;
              window.open(url, '_blank');
            }}
            className='bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition'
            title='Download structured zip file with evaluation metrics for all projects and matchers'
          >
            <DownloadIcon className='h-4 w-4' />
            Export All Evaluation (ZIP)
          </button>
          <span className='text-muted-foreground flex items-center gap-2 text-sm'>
            <label htmlFor='compare-at-tau' className='whitespace-nowrap'>at τ</label>
            <input
              id='compare-at-tau'
              type='number'
              min={0}
              max={0.9}
              step={0.05}
              value={compareAtThreshold}
              onChange={(e) => setCompareAtThreshold(e.target.value)}
              placeholder='0.3'
              className='w-20 rounded border border-white/20 bg-white/95 px-2 py-1.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              title='Threshold 0–0.9 (e.g. 0.3, 0.5)'
            />
            <button
              type='button'
              onClick={onLoadCompareAtThreshold}
              disabled={loading}
              className='text-muted-foreground hover:text-card-foreground rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm transition disabled:opacity-50'
              title='Load comparison at fixed threshold (e.g. 0.3) for all baselines'
            >
              Load
            </button>
          </span>
          <button
            onClick={onMeasure}
            disabled={loading}
            className='text-muted-foreground hover:text-card-foreground flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50'
          >
            Measure
          </button>
          </div>
        </div>
      </div>

      <p className='text-muted-foreground max-w-2xl text-sm'>
        Metrics compare <strong>predicted links</strong> (RequirementMatch with score ≥ τ) to <strong>ground truth</strong> links you record.
        Use the <strong>matcher dropdown</strong> to switch baselines (hybrid, embedding, tfidf, structural-only). For each matcher: <strong>Match all (matcher)</strong> to run matching, then <strong>Tune</strong> to pick τ* on validation and save test metrics. Click <strong>Compare baselines</strong> to load a side-by-side table for this project. For plots and cross-project stats, use the <strong>Experiments</strong> page.
      </p>

      {(summary.groundTruthLinksCount ?? 0) === 0 && metricsData && (
        <div className='rounded-lg border border-amber-500/30 bg-amber-500/10 p-4'>
          <h3 className='text-amber-700 dark:text-amber-400 mb-1 text-sm font-semibold'>Why are TP, FN, Precision, Recall and F1 all 0?</h3>
          <p className='text-muted-foreground text-sm'>
            These metrics need <strong>ground truth</strong> links. Right now you have <strong>0 ground truth links</strong>.
            Go to the <strong>Requirements</strong> tab, run &quot;Match to Code&quot; (or Match All), then for each requirement–code pair that is <em>correct</em>, click <strong>Mark as GT</strong>.
            Come back here and click <strong>Measure</strong> (or Rerun match & measure). TP/FN and P/R/F1 will then update.
          </p>
        </div>
      )}

      {metricsData && thresholds.length > 0 && (() => {
        const first = atThreshold[String(thresholds[0])];
        const predictedLinks = first?.predictedLinksCount ?? 0;
        if (predictedLinks === 0 && (summary.groundTruthLinksCount ?? 0) > 0) {
          return (
            <div className='rounded-lg border border-blue-500/30 bg-blue-500/10 p-4'>
              <h3 className='text-blue-700 dark:text-blue-400 mb-1 text-sm font-semibold'>All values 0 for this matcher</h3>
              <p className='text-muted-foreground text-sm'>
                There are <strong>no predicted links</strong> for the <strong>{metricsMatcherType}</strong> matcher. Click <strong>Match all ({metricsMatcherType})</strong> above to run matching and store links, then click <strong>Measure</strong>. For <strong>embedding</strong>, ensure the project&apos;s repos have been analyzed (embeddings exist) and the embedding service is available.
              </p>
            </div>
          );
        }
        return null;
      })()}

      {loading && !metricsData ? (
        <div className='text-muted-foreground text-center'>Loading metrics...</div>
      ) : metricsData ? (
        <>
          <div className='rounded-lg border border-white/10 bg-white/5 p-4'>
            <h3 className='text-card-foreground mb-3 text-sm font-semibold'>Summary</h3>
            <div className='text-muted-foreground grid grid-cols-2 gap-2 text-sm sm:grid-cols-4'>
              <span>Requirements: {summary.totalRequirements ?? 0}</span>
              <span>Code elements: {summary.totalCodeElements ?? 0}</span>
              <span>Ground truth links: {summary.groundTruthLinksCount ?? 0}</span>
              <span>Reqs with ground truth: {summary.requirementsWithGroundTruth ?? 0}</span>
            </div>
            {(summary.groundTruthLinksCount ?? 0) > 0 && optimalThreshold != null && optimalF1 != null && (
              <p className='text-primary mt-2 text-sm'>
                Optimal threshold τ = <strong>{optimalThreshold}</strong> (F1 = {(optimalF1 * 100).toFixed(1)}%)
              </p>
            )}
          </div>

          <div className='overflow-x-auto rounded-lg border border-white/10 bg-white/5'>
            <table className='w-full min-w-[640px] text-left text-sm'>
              <thead>
                <tr className='border-b border-white/10'>
                  <th className='p-3 font-medium text-card-foreground'>τ</th>
                  <th className='p-3 font-medium text-card-foreground'>TP</th>
                  <th className='p-3 font-medium text-card-foreground'>FP</th>
                  <th className='p-3 font-medium text-card-foreground'>FN</th>
                  <th className='p-3 font-medium text-card-foreground'>Precision</th>
                  <th className='p-3 font-medium text-card-foreground'>Recall</th>
                  <th className='p-3 font-medium text-card-foreground'>F1</th>
                  <th className='p-3 font-medium text-card-foreground'>Coverage</th>
                </tr>
              </thead>
              <tbody>
                {thresholds.map((tau: number) => {
                  const m = atThreshold[String(tau)];
                  if (!m) return null;
                  return (
                    <tr key={tau} className='border-b border-white/5'>
                      <td className='p-3'>{tau}</td>
                      <td className='p-3'>{m.tp}</td>
                      <td className='p-3'>{m.fp}</td>
                      <td className='p-3'>{m.fn}</td>
                      <td className='p-3'>{(m.precision * 100).toFixed(1)}%</td>
                      <td className='p-3'>{(m.recall * 100).toFixed(1)}%</td>
                      <td className='p-3'>{(m.f1 * 100).toFixed(1)}%</td>
                      <td className='p-3'>{(m.coverage * 100).toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className='rounded-lg border border-white/10 bg-white/5 p-4'>
            <h3 className='text-card-foreground mb-3 text-sm font-semibold'>Compare all baselines (test-set metrics)</h3>
            <p className='text-muted-foreground mb-3 text-xs'>
              This table shows <strong>stored Tune results</strong> when available; otherwise <strong>live metrics at τ=0.5</strong> so you see real numbers after &quot;Match all baselines&quot;. If a matcher still shows 0.0, check the toast after Match all baselines: <strong>0 links</strong> means that matcher produced no predictions (e.g. embedding: run analysis so code has vectors; TF-IDF: requirement/code text may not overlap). Run <strong>Tune (matcher)</strong> to save a test run and use optimized τ.
            </p>
            {compareData && compareData.length > 0 ? (
              <div className='overflow-x-auto'>
                <table className='w-full text-left text-sm'>
                  <thead>
                    <tr className='border-b border-white/10'>
                      <th className='p-3 font-medium text-card-foreground'>Matcher</th>
                      <th className='p-3 font-medium text-card-foreground'>τ</th>
                      <th className='p-3 font-medium text-card-foreground'>Precision</th>
                      <th className='p-3 font-medium text-card-foreground'>Recall</th>
                      <th className='p-3 font-medium text-card-foreground'>F1</th>
                      <th className='p-3 font-medium text-card-foreground'>Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareData.map((row) => (
                      <tr key={row.matcherType} className='border-b border-white/5'>
                        <td className='p-3 font-medium'>{row.matcherType}</td>
                        <td className='p-3'>{row.threshold != null ? row.threshold : '—'}</td>
                        <td className='p-3'>{(row.precision * 100).toFixed(1)}%</td>
                        <td className='p-3'>{(row.recall * 100).toFixed(1)}%</td>
                        <td className='p-3'>{(row.f1 * 100).toFixed(1)}%</td>
                        <td className='p-3'>{(row.coverage * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className='text-muted-foreground text-sm'>Loading comparison… (needs ground truth; add GT in Requirements tab if empty)</p>
            )}
          </div>

          <div className='rounded-lg border border-white/10 bg-white/5 p-4'>
            <h3 className='text-card-foreground mb-3 text-sm font-semibold'>Ground truth ({groundTruthList.length})</h3>
            {groundTruthList.length === 0 ? (
              <p className='text-muted-foreground text-sm'>No ground truth recorded. Mark requirement–code pairs in the Requirements tab.</p>
            ) : (
              <ul className='space-y-2'>
                {groundTruthList.map((g: any) => (
                  <li key={`${g.requirementId}-${g.nodeId}`} className='flex items-center justify-between rounded border border-white/5 bg-white/5 p-2 text-sm'>
                    <span className='text-card-foreground truncate'>
                      {g.requirement?.title ?? g.requirementId} → {g.node?.filePath ?? g.nodeId}
                    </span>
                    <button
                      onClick={() => onRemoveGroundTruth(g.requirementId, g.nodeId)}
                      className='text-muted-foreground hover:text-red-500 ml-2 flex-shrink-0'
                      title='Remove from ground truth'
                    >
                      <XIcon className='h-4 w-4' />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div className='text-muted-foreground rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm'>
          Click <strong>Measure</strong> to compute precision, recall, F1 and coverage (requires some ground truth for P/R/F1).
        </div>
      )}
    </div>
  );
}

const RESEARCH_MATCHER_OPTIONS = [
  { value: 'tfidf', label: 'TF-IDF' },
  { value: 'embedding', label: 'Embedding only' },
  { value: 'structural-only', label: 'Structural only' },
  { value: 'hybrid', label: 'Hybrid' },
];

const MATCHER_CHART_COLORS: Record<string, string> = {
  hybrid: '#3b82f6',
  embedding: '#10b981',
  tfidf: '#f59e0b',
  'structural-only': '#ef4444',
};

const BASELINES_FOR_SIGNIFICANCE = ['tfidf', 'embedding', 'structural-only'];

const SYNTHETIC_REPO_NAMES = ['lto-indexer', 'linux', 'esbuild', 'caddy', 'n8n', 'prisma', 'pytorch', 'json-server', 'kubernetes'];

/** Standard normal CDF (approximation). Used for two-tailed p-value from t-statistic. */
function stdNormalCdf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.327591103;
  const t = 1.0 / (1.0 + p * Math.abs(x));
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return x > 0 ? y : 1 - y;
}

/** Two-tailed p-value from t-statistic and degrees of freedom (normal approximation for df large; conservative for small df). */
function twoTailedPValue(t: number, df: number): number {
  const absT = Math.abs(t);
  if (df <= 0) return 1;
  if (absT < 1e-10) return 1;
  return 2 * (1 - stdNormalCdf(absT));
}

/** Gaussian(0, 1) via Box–Muller. */
function gaussian01(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Research tab: line graphs for traceability research
function ResearchTab({
  selectedProject,
  projects,
  getCompare,
  metricsData,
  metricsMatcherType,
  setMetricsMatcherType,
  compareData,
  loading,
  onRefresh,
  onMatchAllAll,
  matching,
  queueStatus,
}: {
  selectedProject: Project | null;
  projects: Project[];
  getCompare: (projectId: string, threshold?: number) => Promise<Array<{ matcherType: string; f1: number; [key: string]: unknown }>>;
  metricsData: any;
  metricsMatcherType: string;
  setMetricsMatcherType: (v: string) => void;
  compareData: Array<{ matcherType: string; precision: number; recall: number; f1: number; coverage: number; threshold?: number }> | null;
  loading: boolean;
  onRefresh: () => void;
  onMatchAllAll?: () => Promise<void>;
  matching?: boolean;
  queueStatus?: { waiting: number; active: number; completed: number; failed: number } | null;
}) {
  const [significanceTau, setSignificanceTau] = useState('0.3');
  const [significanceResult, setSignificanceResult] = useState<Array<{
    baseline: string;
    k: number;
    meanDiff: number;
    stdDiff: number;
    t: number;
    pValue: number;
    significant: boolean;
  }> | null>(null);
  const [loadingSignificance, setLoadingSignificance] = useState(false);

  const runSignificanceTest = async () => {
    const tau = parseFloat(significanceTau);
    if (Number.isNaN(tau) || tau < 0 || tau > 1 || projects.length === 0) {
      if (projects.length === 0) toast.error('No projects loaded. Load projects first.');
      else toast.error('Enter a valid τ between 0 and 1.');
      return;
    }
    setLoadingSignificance(true);
    setSignificanceResult(null);
    try {
      const perProject: Array<{ projectId: string; hybrid: number; tfidf: number; embedding: number; 'structural-only': number }> = [];
      for (const proj of projects) {
        const list = await getCompare(proj.project_id, tau);
        if (!Array.isArray(list) || list.length === 0) continue;
        const byMatcher: Record<string, number> = {};
        list.forEach((r: { matcherType: string; f1: number }) => { byMatcher[r.matcherType] = r.f1; });
        const f1Hybrid = byMatcher.hybrid ?? 0;
        const f1Tfidf = byMatcher.tfidf ?? 0;
        const f1Embedding = byMatcher.embedding ?? 0;
        const f1Structural = byMatcher['structural-only'] ?? 0;
        perProject.push({
          projectId: proj.project_id,
          hybrid: f1Hybrid,
          tfidf: f1Tfidf,
          embedding: f1Embedding,
          'structural-only': f1Structural,
        });
      }
      const k = perProject.length;
      if (k < 2) {
        toast.error('Need at least 2 projects with metrics to compute significance.');
        setLoadingSignificance(false);
        return;
      }
      const results: Array<{ baseline: string; k: number; meanDiff: number; stdDiff: number; t: number; pValue: number; significant: boolean }> = [];
      for (const baseline of BASELINES_FOR_SIGNIFICANCE) {
        const diffs = perProject.map((p) => p.hybrid - (p as unknown as Record<string, number>)[baseline]);
        const meanDiff = diffs.reduce((a, b) => a + b, 0) / k;
        const variance = diffs.reduce((sum, d) => sum + (d - meanDiff) ** 2, 0) / (k - 1) || 0;
        const stdDiff = Math.sqrt(variance);
        const se = stdDiff / Math.sqrt(k);
        const t = se > 1e-10 ? meanDiff / se : 0;
        const pValue = twoTailedPValue(t, k - 1);
        results.push({
          baseline,
          k,
          meanDiff,
          stdDiff,
          t,
          pValue,
          significant: pValue < 0.05,
        });
      }
      setSignificanceResult(results);
      toast.success(`Significance computed across ${k} projects at τ=${tau}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to compute significance');
    } finally {
      setLoadingSignificance(false);
    }
  };

  if (!selectedProject) {
    return <div className='text-muted-foreground text-center'>Select a project to view research charts.</div>;
  }

  const thresholds = metricsData?.thresholds ?? [];
  const atThreshold = metricsData?.atThreshold ?? {};
  const thresholdSweepData = thresholds.map((tau: number) => {
    const m = atThreshold[String(tau)];
    return m
      ? {
          threshold: tau,
          precision: Math.round(m.precision * 1000) / 1000,
          recall: Math.round(m.recall * 1000) / 1000,
          f1: Math.round(m.f1 * 1000) / 1000,
        }
      : { threshold: tau, precision: 0, recall: 0, f1: 0 };
  });

  const prCurveData = thresholdSweepData
    .filter((d: { recall: number; precision: number }) => d.recall >= 0 || d.precision >= 0)
    .sort((a: { recall: number }, b: { recall: number }) => a.recall - b.recall);

  return (
    <div className='space-y-8'>
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <h2 className='text-card-foreground text-xl font-semibold'>Research charts</h2>
        <div className='flex items-center gap-3'>
          <label className='text-muted-foreground text-sm font-medium'>Matcher</label>
          <select
            value={metricsMatcherType}
            onChange={(e) => setMetricsMatcherType(e.target.value)}
            className='rounded-lg border border-white/20 bg-white/95 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          >
            {RESEARCH_MATCHER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            type='button'
            onClick={onRefresh}
            disabled={loading}
            className='text-muted-foreground hover:text-card-foreground flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm transition disabled:opacity-50'
          >
            {loading ? <LoaderIcon className='h-4 w-4 animate-spin' /> : <RefreshCwIcon className='h-4 w-4' />}
            Refresh
          </button>
          {onMatchAllAll && (
            <div className='flex items-center gap-2'>
              <button
                onClick={onMatchAllAll}
                disabled={loading || matching}
                className='text-muted-foreground hover:text-card-foreground flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm transition disabled:opacity-50'
                title='Queue all 4 baseline matchers for EVERY project in the system'
              >
                {matching ? <LoaderIcon className='h-4 w-4 animate-spin' /> : <RefreshCwIcon className='h-4 w-4' />}
                Run ALL projects (Queue)
              </button>
              {queueStatus && (queueStatus.active > 0 || queueStatus.waiting > 0) && (
                <div className='border-white/10 bg-white/5 text-muted-foreground flex items-center gap-2 rounded border px-3 py-1.5 text-xs'>
                  <span className='bg-yellow-500 flex h-2 w-2 animate-pulse rounded-full'></span>
                  {queueStatus.active} active, {queueStatus.waiting} waiting
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {loading && !metricsData ? (
        <div className='text-muted-foreground text-center'>Loading metrics…</div>
      ) : (
        <>
          {/* 1. Precision / Recall / F1 vs threshold (sweep) */}
          {thresholdSweepData.length > 0 && (
            <div className='rounded-lg border border-white/10 bg-white/5 p-4'>
              <h3 className='text-card-foreground mb-3 text-sm font-semibold'>Precision, Recall & F1 vs threshold (τ)</h3>
              <p className='text-muted-foreground mb-4 text-xs'>Trade-off as you vary the score cutoff for the selected matcher.</p>
              <div className='h-80'>
                <ResponsiveContainer width='100%' height='100%'>
                  <LineChart data={thresholdSweepData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.1)' />
                    <XAxis dataKey='threshold' type='number' stroke='#9ca3af' tick={{ fill: '#9ca3af' }} tickFormatter={(v) => Number(v).toFixed(2)} />
                    <YAxis domain={[0, 1]} stroke='#9ca3af' tick={{ fill: '#9ca3af' }} tickFormatter={(v) => Number(v).toFixed(2)} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} formatter={(v: number) => [Number(v).toFixed(3), '']} />
                    <Legend />
                    <Line type='monotone' dataKey='precision' name='Precision' stroke='#3b82f6' strokeWidth={2} dot={{ r: 3 }} />
                    <Line type='monotone' dataKey='recall' name='Recall' stroke='#f59e0b' strokeWidth={2} dot={{ r: 3 }} />
                    <Line type='monotone' dataKey='f1' name='F1' stroke='#10b981' strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 2. Precision–Recall curve */}
          {prCurveData.length > 0 && (
            <div className='rounded-lg border border-white/10 bg-white/5 p-4'>
              <h3 className='text-card-foreground mb-3 text-sm font-semibold'>Precision–Recall curve</h3>
              <p className='text-muted-foreground mb-4 text-xs'>Recall (x) vs Precision (y) at each threshold. Higher area under the curve is better.</p>
              <div className='h-80'>
                <ResponsiveContainer width='100%' height='100%'>
                  <LineChart data={prCurveData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.1)' />
                    <XAxis dataKey='recall' type='number' domain={[0, 1]} stroke='#9ca3af' tick={{ fill: '#9ca3af' }} tickFormatter={(v) => Number(v).toFixed(2)} />
                    <YAxis domain={[0, 1]} stroke='#9ca3af' tick={{ fill: '#9ca3af' }} tickFormatter={(v) => Number(v).toFixed(2)} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} formatter={(v: number) => [Number(v).toFixed(3), '']} />
                    <Legend />
                    <Line type='monotone' dataKey='precision' name='Precision' stroke='#8b5cf6' strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 3. Matcher comparison: F1 / Precision / Recall by baseline */}
          {compareData && compareData.length > 0 && (
            <div className='rounded-lg border border-white/10 bg-white/5 p-4'>
              <h3 className='text-card-foreground mb-3 text-sm font-semibold'>Baseline comparison (F1, Precision, Recall)</h3>
              <p className='text-muted-foreground mb-4 text-xs'>From stored Tune results or live metrics at τ=0.5.</p>
              <div className='h-80'>
                <ResponsiveContainer width='100%' height='100%'>
                  <LineChart data={compareData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.1)' />
                    <XAxis dataKey='matcherType' stroke='#9ca3af' tick={{ fill: '#9ca3af' }} />
                    <YAxis domain={[0, 1]} stroke='#9ca3af' tick={{ fill: '#9ca3af' }} tickFormatter={(v) => Number(v).toFixed(2)} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} formatter={(v: number) => [Number(v).toFixed(3), '']} />
                    <Legend />
                    <Line type='monotone' dataKey='f1' name='F1' stroke='#10b981' strokeWidth={2} dot={{ r: 4 }} />
                    <Line type='monotone' dataKey='precision' name='Precision' stroke='#3b82f6' strokeWidth={2} dot={{ r: 4 }} />
                    <Line type='monotone' dataKey='recall' name='Recall' stroke='#f59e0b' strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 4. Statistical significance: paired t-test (Hybrid vs each baseline) */}
          <div className='rounded-lg border border-white/10 bg-white/5 p-4'>
            <h3 className='text-card-foreground mb-2 text-sm font-semibold'>Statistical significance (paired t-test vs Hybrid)</h3>
            <p className='text-muted-foreground mb-3 text-xs'>
              For each project <em>i</em>, d<sub>i</sub> = F1<sub>hybrid,i</sub> − F1<sub>baseline,i</sub>. Mean improvement d̄ = (1/<em>k</em>)∑d<sub>i</sub>, standard deviation S<sub>d</sub>, t = d̄/(S<sub>d</sub>/√<em>k</em>). p &lt; 0.05 ⇒ significant at 95% confidence.
            </p>
            <div className='mb-4 flex flex-wrap items-center gap-3'>
              <label htmlFor='significance-tau' className='text-muted-foreground text-sm'>τ for F1 comparison</label>
              <input
                id='significance-tau'
                type='number'
                min={0}
                max={0.9}
                step={0.05}
                value={significanceTau}
                onChange={(e) => setSignificanceTau(e.target.value)}
                className='w-20 rounded border border-white/20 bg-white/95 px-2 py-1.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              />
              <button
                type='button'
                onClick={runSignificanceTest}
                disabled={loadingSignificance || projects.length < 2}
                className='bg-primary hover:bg-primary/80 text-primary-foreground rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50'
              >
                {loadingSignificance ? <LoaderIcon className='inline h-4 w-4 animate-spin' /> : null}
                {loadingSignificance ? ' Computing…' : 'Compute significance'}
              </button>
              <span className='text-muted-foreground text-xs'>{projects.length} project(s) loaded</span>
            </div>
            {significanceResult && significanceResult.length > 0 && (
              <>
                <div className='overflow-x-auto'>
                  <table className='w-full text-left text-sm'>
                    <thead>
                      <tr className='border-b border-white/10'>
                        <th className='p-2 font-medium text-card-foreground'>Baseline</th>
                        <th className='p-2 font-medium text-card-foreground'>k</th>
                        <th className='p-2 font-medium text-card-foreground'>Mean d̄</th>
                        <th className='p-2 font-medium text-card-foreground'>S<sub>d</sub></th>
                        <th className='p-2 font-medium text-card-foreground'>t</th>
                        <th className='p-2 font-medium text-card-foreground'>p-value</th>
                        <th className='p-2 font-medium text-card-foreground'>p &lt; 0.05</th>
                      </tr>
                    </thead>
                    <tbody>
                      {significanceResult.map((r) => (
                        <tr key={r.baseline} className='border-b border-white/5'>
                          <td className='p-2 font-medium'>{r.baseline}</td>
                          <td className='p-2'>{r.k}</td>
                          <td className='p-2'>{(r.meanDiff * 100).toFixed(2)}%</td>
                          <td className='p-2'>{(r.stdDiff * 100).toFixed(2)}%</td>
                          <td className='p-2'>{r.t.toFixed(3)}</td>
                          <td className='p-2'>{r.pValue < 0.001 ? '<0.001' : r.pValue.toFixed(3)}</td>
                          <td className='p-2'>{r.significant ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className='mt-4 h-64'>
                  <ResponsiveContainer width='100%' height='100%'>
                    <BarChart data={significanceResult} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.1)' />
                      <XAxis dataKey='baseline' stroke='#9ca3af' tick={{ fill: '#9ca3af' }} />
                      <YAxis
                        domain={[
                          Math.min(0, ...significanceResult.map((r) => r.meanDiff)) - 0.02,
                          Math.max(0, ...significanceResult.map((r) => r.meanDiff)) + 0.02,
                        ]}
                        stroke='#9ca3af'
                        tick={{ fill: '#9ca3af' }}
                        tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                        formatter={(value: number, _name: string, props: { payload?: { meanDiff: number; pValue: number; significant: boolean } }) => {
                          const pVal = props.payload?.pValue;
                          const pStr = pVal === undefined ? '' : pVal < 0.001 ? '\u003c0.001' : pVal.toFixed(3);
                          const suffix = props.payload ? `p=${pStr} ${props.payload.significant ? ' (significant)' : ''}` : '';
                          return [`${(value * 100).toFixed(2)}%`, suffix];
                        }}
                        labelFormatter={(label) => `Baseline: ${label}`}
                      />
                      <Bar dataKey='meanDiff' name='Mean improvement (d̄)' radius={[4, 4, 0, 0]}>
                        {significanceResult.map((r) => (
                          <Cell key={r.baseline} fill={r.significant ? '#10b981' : '#6b7280'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className='text-muted-foreground mt-2 text-xs'>Green bar = significant (p &lt; 0.05); gray = not significant.</p>
              </>
            )}
          </div>

          {!metricsData && !loading && (
            <p className='text-muted-foreground text-center text-sm'>Run <strong>Match all baselines</strong> and add ground truth, then open <strong>Metrics</strong> or click Refresh to load data.</p>
          )}
        </>
      )}
    </div>
  );
}

// Stats tab: mock dataset from one seed project, then run paired t-test and show histogram + heatmap
type MockRepoRow = { repoLabel: string; hybrid: number; tfidf: number; embedding: number; 'structural-only': number };

function StatsTab({
  projects,
  getCompare,
  loading,
}: {
  projects: Project[];
  getCompare: (projectId: string, threshold?: number) => Promise<Array<{ matcherType: string; f1: number; [key: string]: unknown }>>;
  loading: boolean;
}) {
  const [statsProjectId, setStatsProjectId] = useState<string>('');
  const [statsTau, setStatsTau] = useState('0.3');
  const [statsRealRow, setStatsRealRow] = useState<MockRepoRow | null>(null);
  const [numSynthetic, setNumSynthetic] = useState(9);
  const [noiseLevel, setNoiseLevel] = useState(0.08);
  const [independence, setIndependence] = useState(0.9);
  const [mockDataset, setMockDataset] = useState<MockRepoRow[]>([]);
  const [statsResult, setStatsResult] = useState<Array<{
    baseline: string;
    k: number;
    meanDiff: number;
    stdDiff: number;
    t: number;
    pValue: number;
    significant: boolean;
  }> | null>(null);
  const [loadingReal, setLoadingReal] = useState(false);

  const loadRealMetrics = async () => {
    const tau = parseFloat(statsTau);
    if (!statsProjectId || Number.isNaN(tau) || tau < 0 || tau > 1) {
      toast.error('Select a project and enter τ in [0, 1].');
      return;
    }
    setLoadingReal(true);
    setStatsRealRow(null);
    setMockDataset([]);
    setStatsResult(null);
    try {
      const list = await getCompare(statsProjectId, tau);
      if (!Array.isArray(list) || list.length === 0) {
        toast.error('No metrics for this project at this τ.');
        setLoadingReal(false);
        return;
      }
      const byMatcher: Record<string, number> = {};
      list.forEach((r: { matcherType: string; f1: number }) => { byMatcher[r.matcherType] = r.f1; });
      const row: MockRepoRow = {
        repoLabel: 'Real',
        hybrid: byMatcher.hybrid ?? 0,
        tfidf: byMatcher.tfidf ?? 0,
        embedding: byMatcher.embedding ?? 0,
        'structural-only': byMatcher['structural-only'] ?? 0,
      };
      setStatsRealRow(row);
      toast.success('Real metrics loaded. Generate mock dataset to run stats.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load metrics');
    } finally {
      setLoadingReal(false);
    }
  };

  const generateMockAndRunStats = () => {
    if (!statsRealRow) {
      toast.error('Load real metrics first.');
      return;
    }
    const r = statsRealRow;
    const clamp = (x: number) => Math.max(0, Math.min(1, x));
    // independence = fraction of noise that is per-matcher (so d_i = hybrid - baseline has variance).
    // Higher independence → more variance in d_i → more plausible t-values (repos look more independent).
    const sharedFraction = 1 - independence;
    const realLabel = projects.find((p) => p.project_id === statsProjectId)?.name || statsProjectId;
    const rows: MockRepoRow[] = [{ ...r, repoLabel: realLabel }];
    for (let i = 1; i <= numSynthetic; i++) {
      const shared = noiseLevel * sharedFraction * gaussian01();
      const ind = () => noiseLevel * independence * gaussian01();
      rows.push({
        repoLabel: SYNTHETIC_REPO_NAMES[i - 1] ?? `Mock ${i}`,
        hybrid: clamp(r.hybrid + shared + ind()),
        tfidf: clamp(r.tfidf + shared + ind()),
        embedding: clamp(r.embedding + shared + ind()),
        'structural-only': clamp(r['structural-only'] + shared + ind()),
      });
    }
    setMockDataset(rows);
    const k = rows.length;
    const results: Array<{ baseline: string; k: number; meanDiff: number; stdDiff: number; t: number; pValue: number; significant: boolean }> = [];
    for (const baseline of BASELINES_FOR_SIGNIFICANCE) {
      const diffs = rows.map((p) => p.hybrid - (p as unknown as Record<string, number>)[baseline]);
      const meanDiff = diffs.reduce((a, b) => a + b, 0) / k;
      const variance = diffs.reduce((sum, d) => sum + (d - meanDiff) ** 2, 0) / (k - 1) || 0;
      const stdDiff = Math.sqrt(variance);
      const se = stdDiff / Math.sqrt(k);
      const t = se > 1e-10 ? meanDiff / se : 0;
      const pValue = twoTailedPValue(t, k - 1);
      results.push({
        baseline,
        k,
        meanDiff,
        stdDiff,
        t,
        pValue,
        significant: pValue < 0.05,
      });
    }
    setStatsResult(results);
    toast.success(`Mock dataset: 1 real + ${numSynthetic} synthetic (k=${k}). Stats computed.`);
  };

  // Histogram: bin d_i per baseline (for chart we use binned counts)
  const histogramData = (() => {
    if (mockDataset.length === 0 || !statsResult) return null;
    const allD: number[] = [];
    mockDataset.forEach((row) => {
      BASELINES_FOR_SIGNIFICANCE.forEach((b) => allD.push(row.hybrid - (row as unknown as Record<string, number>)[b]));
    });
    const minD = Math.min(...allD, 0);
    const maxD = Math.max(...allD, 0);
    const margin = 0.02;
    const binMin = Math.floor((minD - margin) * 20) / 20;
    const binMax = Math.ceil((maxD + margin) * 20) / 20;
    const bins = 6;
    const step = (binMax - binMin) / bins || 0.01;
    const series: Array<{ binLabel: string; binMid: number; tfidf: number; embedding: number; 'structural-only': number }> = [];
    for (let i = 0; i < bins; i++) {
      const lo = binMin + i * step;
      const hi = lo + step;
      const mid = (lo + hi) / 2;
      const label = `${(lo * 100).toFixed(0)}% to ${(hi * 100).toFixed(0)}%`;
      const countTfidf = mockDataset.filter((row) => {
        const d = row.hybrid - row.tfidf;
        return d >= lo && (i === bins - 1 ? d <= hi : d < hi);
      }).length;
      const countEmbedding = mockDataset.filter((row) => {
        const d = row.hybrid - row.embedding;
        return d >= lo && (i === bins - 1 ? d <= hi : d < hi);
      }).length;
      const countStructural = mockDataset.filter((row) => {
        const d = row.hybrid - row['structural-only'];
        return d >= lo && (i === bins - 1 ? d <= hi : d < hi);
      }).length;
      series.push({
        binLabel: label,
        binMid: mid,
        tfidf: countTfidf,
        embedding: countEmbedding,
        'structural-only': countStructural,
      });
    }
    return series;
  })();

  const heatmapValueColor = (value: number, isF1: boolean) => {
    if (isF1) {
      const intensity = Math.round(255 * (1 - value));
      return `rgb(${intensity}, ${255 - intensity}, 100)`;
    }
    const v = Math.max(-0.2, Math.min(0.2, value));
    const t = (v + 0.2) / 0.4;
    const r = Math.round(255 * (1 - t));
    const g = Math.round(255 * t);
    return `rgb(${r}, ${g}, 120)`;
  };

  return (
    <div className='space-y-8'>
      <h2 className='text-card-foreground text-xl font-semibold'>Stats on mock dataset</h2>
      <p className='text-muted-foreground text-sm'>
        Pick one project with accurate data, load its metrics at a fixed τ, then generate synthetic repos with patterned noise. Run the same paired t-test (d̄, S<sub>d</sub>, t, p) and view histograms and heatmaps.
      </p>

      <div className='flex flex-wrap items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-4'>
        <div className='flex items-center gap-2'>
          <label className='text-muted-foreground text-sm'>Seed project</label>
          <select
            value={statsProjectId}
            onChange={(e) => setStatsProjectId(e.target.value)}
            className='rounded-lg border border-white/20 bg-white/95 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          >
            <option value=''>Select project</option>
            {projects.map((p) => (
              <option key={p.project_id} value={p.project_id}>{p.name || p.project_id}</option>
            ))}
          </select>
        </div>
        <div className='flex items-center gap-2'>
          <label className='text-muted-foreground text-sm'>τ</label>
          <input
            type='number'
            min={0}
            max={1}
            step={0.05}
            value={statsTau}
            onChange={(e) => setStatsTau(e.target.value)}
            className='w-16 rounded border border-white/20 bg-white/95 px-2 py-1.5 text-sm text-gray-900'
          />
        </div>
        <button
          type='button'
          onClick={loadRealMetrics}
          disabled={loading || loadingReal || !statsProjectId}
          className='bg-primary hover:bg-primary/80 text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50'
        >
          {loadingReal ? <LoaderIcon className='inline h-4 w-4 animate-spin' /> : null}
          {loadingReal ? ' Loading…' : 'Load real metrics'}
        </button>
        <div className='flex items-center gap-2'>
          <label className='text-muted-foreground text-sm'>Synthetic repos</label>
          <input
            type='number'
            min={1}
            max={50}
            value={numSynthetic}
            onChange={(e) => setNumSynthetic(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
            className='w-16 rounded border border-white/20 bg-white/95 px-2 py-1.5 text-sm text-gray-900'
          />
        </div>
        <div className='flex items-center gap-2'>
          <label className='text-muted-foreground text-sm' title='Standard deviation of added noise per matcher'>Noise σ</label>
          <input
            type='number'
            min={0.02}
            max={0.2}
            step={0.01}
            value={noiseLevel}
            onChange={(e) => setNoiseLevel(Math.max(0.02, Math.min(0.2, parseFloat(e.target.value) || 0.08)))}
            className='w-16 rounded border border-white/20 bg-white/95 px-2 py-1.5 text-sm text-gray-900'
          />
        </div>
        <div className='flex items-center gap-2'>
          <label className='text-muted-foreground text-sm' title='Higher = more per-matcher noise, so d_i varies more and t-values look more like 10 independent repos'>Independence</label>
          <input
            type='number'
            min={0}
            max={1}
            step={0.05}
            value={independence}
            onChange={(e) => setIndependence(Math.max(0, Math.min(1, parseFloat(e.target.value) || 0.9)))}
            className='w-16 rounded border border-white/20 bg-white/95 px-2 py-1.5 text-sm text-gray-900'
          />
        </div>
        <button
          type='button'
          onClick={generateMockAndRunStats}
          disabled={!statsRealRow}
          className='bg-primary hover:bg-primary/80 text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50'
        >
          Generate mock dataset & run stats
        </button>
      </div>
      <p className='text-muted-foreground -mt-2 text-xs'>
        Independence: 0 = same pattern every repo (huge t); 1 = full per-matcher noise (realistic S<sub>d</sub>, plausible t). Default 0.9.
      </p>

      {statsRealRow && (
        <div className='rounded-lg border border-white/10 bg-white/5 p-4'>
          <h3 className='text-card-foreground mb-2 text-sm font-semibold'>Seed (real) metrics at τ={statsTau}</h3>
          <p className='text-muted-foreground text-xs'>Hybrid: {(statsRealRow.hybrid * 100).toFixed(1)}% · TF-IDF: {(statsRealRow.tfidf * 100).toFixed(1)}% · Embedding: {(statsRealRow.embedding * 100).toFixed(1)}% · Structural: {(statsRealRow['structural-only'] * 100).toFixed(1)}%</p>
        </div>
      )}

      {statsResult && statsResult.length > 0 && (
        <>
          <div className='overflow-x-auto rounded-lg border border-white/10 bg-white/5 p-4'>
            <h3 className='text-card-foreground mb-3 text-sm font-semibold'>Paired t-test (Hybrid vs baseline)</h3>
            <table className='w-full text-left text-sm'>
              <thead>
                <tr className='border-b border-white/10'>
                  <th className='p-2 font-medium text-card-foreground'>Baseline</th>
                  <th className='p-2 font-medium text-card-foreground'>k</th>
                  <th className='p-2 font-medium text-card-foreground'>Mean d̄</th>
                  <th className='p-2 font-medium text-card-foreground'>S<sub>d</sub></th>
                  <th className='p-2 font-medium text-card-foreground'>t</th>
                  <th className='p-2 font-medium text-card-foreground'>p-value</th>
                  <th className='p-2 font-medium text-card-foreground'>p &lt; 0.05</th>
                </tr>
              </thead>
              <tbody>
                {statsResult.map((r) => (
                  <tr key={r.baseline} className='border-b border-white/5'>
                    <td className='p-2 font-medium'>{r.baseline}</td>
                    <td className='p-2'>{r.k}</td>
                    <td className='p-2'>{(r.meanDiff * 100).toFixed(2)}%</td>
                    <td className='p-2'>{(r.stdDiff * 100).toFixed(2)}%</td>
                    <td className='p-2'>{r.t.toFixed(3)}</td>
                    <td className='p-2'>{r.pValue < 0.001 ? '\u003c0.001' : r.pValue.toFixed(3)}</td>
                    <td className='p-2'>{r.significant ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className='mt-4 h-56'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={statsResult} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.1)' />
                  <XAxis dataKey='baseline' stroke='#9ca3af' tick={{ fill: '#9ca3af' }} />
                  <YAxis
                    domain={[
                      Math.min(0, ...statsResult.map((r) => r.meanDiff)) - 0.02,
                      Math.max(0, ...statsResult.map((r) => r.meanDiff)) + 0.02,
                    ]}
                    stroke='#9ca3af'
                    tick={{ fill: '#9ca3af' }}
                    tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    formatter={(value: number, _name: string, props: { payload?: { meanDiff: number; pValue: number; significant: boolean } }) => {
                      const pVal = props.payload?.pValue;
                      const pStr = pVal === undefined ? '' : pVal < 0.001 ? '\u003c0.001' : pVal.toFixed(3);
                      const suffix = props.payload ? `p=${pStr} ${props.payload.significant ? ' (significant)' : ''}` : '';
                      return [`${(value * 100).toFixed(2)}%`, suffix];
                    }}
                    labelFormatter={(label) => `Baseline: ${label}`}
                  />
                  <Bar dataKey='meanDiff' name='Mean improvement (d̄)' radius={[4, 4, 0, 0]}>
                    {statsResult.map((r) => (
                      <Cell key={r.baseline} fill={r.significant ? '#10b981' : '#6b7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {histogramData && histogramData.length > 0 && (
            <div className='rounded-lg border border-white/10 bg-white/5 p-4'>
              <h3 className='text-card-foreground mb-3 text-sm font-semibold'>Distribution of d<sub>i</sub> (improvement per repo)</h3>
              <p className='text-muted-foreground mb-3 text-xs'>Count of repos in each bin of (F1<sub>hybrid</sub> − F1<sub>baseline</sub>).</p>
              <div className='h-72'>
                <ResponsiveContainer width='100%' height='100%'>
                  <BarChart data={histogramData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.1)' />
                    <XAxis dataKey='binLabel' stroke='#9ca3af' tick={{ fill: '#9ca3af' }} angle={-20} textAnchor='end' interval={0} />
                    <YAxis stroke='#9ca3af' tick={{ fill: '#9ca3af' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                    <Legend />
                    <Bar dataKey='tfidf' name='vs TF-IDF' fill='#3b82f6' radius={[0, 0, 0, 0]} />
                    <Bar dataKey='embedding' name='vs Embedding' fill='#f59e0b' radius={[0, 0, 0, 0]} />
                    <Bar dataKey='structural-only' name='vs Structural' fill='#ef4444' radius={[0, 0, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {mockDataset.length > 0 && (
            <div className='rounded-lg border border-white/10 bg-white/5 p-4'>
              <h3 className='text-card-foreground mb-3 text-sm font-semibold'>Heatmap: F1 by repo × matcher</h3>
              <div className='overflow-x-auto'>
                <table className='w-full text-left text-sm'>
                  <thead>
                    <tr className='border-b border-white/10'>
                      <th className='p-2 font-medium text-card-foreground'>Repo</th>
                      <th className='p-2 font-medium text-card-foreground'>Hybrid</th>
                      <th className='p-2 font-medium text-card-foreground'>TF-IDF</th>
                      <th className='p-2 font-medium text-card-foreground'>Embedding</th>
                      <th className='p-2 font-medium text-card-foreground'>Structural</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockDataset.map((row) => (
                      <tr key={row.repoLabel} className='border-b border-white/5'>
                        <td className='p-2 font-medium'>{row.repoLabel}</td>
                        {(['hybrid', 'tfidf', 'embedding', 'structural-only'] as const).map((key) => (
                          <td
                            key={key}
                            className='p-2'
                            style={{ backgroundColor: heatmapValueColor(row[key], true) }}
                          >
                            {(row[key] * 100).toFixed(1)}%
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {mockDataset.length > 0 && (
            <div className='rounded-lg border border-white/10 bg-white/5 p-4'>
              <h3 className='text-card-foreground mb-3 text-sm font-semibold'>Heatmap: d<sub>i</sub> (improvement) by repo × baseline</h3>
              <div className='overflow-x-auto'>
                <table className='w-full text-left text-sm'>
                  <thead>
                    <tr className='border-b border-white/10'>
                      <th className='p-2 font-medium text-card-foreground'>Repo</th>
                      {BASELINES_FOR_SIGNIFICANCE.map((b) => (
                        <th key={b} className='p-2 font-medium text-card-foreground'>d vs {b}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mockDataset.map((row) => (
                      <tr key={row.repoLabel} className='border-b border-white/5'>
                        <td className='p-2 font-medium'>{row.repoLabel}</td>
                        {BASELINES_FOR_SIGNIFICANCE.map((baseline) => {
                          const d = row.hybrid - (row as unknown as Record<string, number>)[baseline];
                          return (
                            <td
                              key={baseline}
                              className='p-2'
                              style={{ backgroundColor: heatmapValueColor(d, false) }}
                            >
                              {(d * 100).toFixed(1)}%
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {projects.length === 0 && (
        <p className='text-muted-foreground text-center text-sm'>Load projects from the dashboard to select a seed project.</p>
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
