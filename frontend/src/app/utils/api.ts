import { useApi } from '../context/ApiProvider';
import { repositoryCache } from './storage';

// Helper function to get auth headers
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  const useLocalBackend = JSON.parse(
    localStorage.getItem('useLocalBackend') || 'true',
  );

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Only add auth token if not in local mode
  if (token && !useLocalBackend) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

// Project Management Types
export interface SourceConfig {
  type: 'local' | 'github';
  local_path?: string;
  github_url?: string;
  branch?: string;
}

export interface StorageConfig {
  use_s3: boolean;
  s3_bucket?: string;
  s3_prefix?: string;
  local_cache_path?: string;
}

export interface Project {
  project_id: string;
  name: string;
  description?: string;
  source_config: SourceConfig;
  storage_config?: StorageConfig;
  status: 'created' | 'cloning' | 'ready' | 'analyzing' | 'completed' | 'error';
  tenant_id: string;
  created_at: string;
  updated_at: string;
  last_analyzed?: string;
  analysis_count: number;
  file_count?: number;
  size_bytes?: number;
}

export interface ProjectCreateRequest {
  name: string;
  description?: string;
  source_config?: SourceConfig;
}

export interface EnvironmentConfig {
  openai_api_key?: string;
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  aws_region?: string;
  s3_bucket?: string;
  neo4j_uri?: string;
  neo4j_user?: string;
  neo4j_password?: string;
  use_local_backend: boolean;
  backend_url?: string;
}

export interface UserSettings {
  environment_config: EnvironmentConfig;
  tenant_id: string;
  updated_at: string;
}

export function useRepolensApi() {
  const { apiBase } = useApi();

  // Legacy function - these endpoints may not exist in the current API
  // TODO: Update to use /api/repositories flow: create repo first, then analyze
  async function analyzeRepo(
    url: string,
    folderPath?: string,
    forceFresh = false,
  ) {
    // Check cache first if we have a folder path and not forcing fresh
    if (folderPath && !forceFresh) {
      const cached = await repositoryCache.get(folderPath);
      if (cached) {
        return { data: cached, fromCache: true };
      }
    }

    // Legacy endpoints - may not exist in current API
    // New flow: Create repository via POST /api/repositories, then analyze via POST /api/repositories/:id/analyze
    const endpoint = folderPath
      ? `${apiBase}/repository/analyze/project`
      : `${apiBase}/repository/analyze`;

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(
          folderPath ? { folder_path: folderPath } : { url },
        ),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to analyze repo: ${res.status} ${errorText}`);
      }

      const data = await res.json();

      // Cache the result if we have a folder path
      if (folderPath) {
        try {
          await repositoryCache.set(folderPath, data);
        } catch (error) {
          console.warn('Failed to cache repository analysis:', error);
        }
      }

      return { data, fromCache: false };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Analysis request timed out. Please try again.');
      }
      throw error;
    }
  }

  // Legacy function - endpoint may not exist in current API
  async function getFiles() {
    const res = await fetch(`${apiBase}/repository/files`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to get files');
    return await res.json();
  }

  // Legacy function - endpoint may not exist in current API
  async function getFile(path: string) {
    const res = await fetch(
      `${apiBase}/repository/file?path=${encodeURIComponent(path)}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to get file');
    return await res.json();
  }

  async function askRepoQuestion(
    graph: any,
    question: string,
    repoId?: string,
  ) {
    const res = await fetch(`${apiBase}/api/ai/ask`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ graphData: graph, question, repoId }),
    });
    if (!res.ok) throw new Error('Failed to get answer from AI');
    return await res.json();
  }

  async function fetchEnhancedGraph(folderPath: string) {
    // Note: This endpoint may not exist in the API yet
    // Using repositories endpoint as fallback
    const res = await fetch(`${apiBase}/api/repositories`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch repositories');
    return await res.json();
  }

  // Cache management functions
  async function clearCache() {
    await repositoryCache.clear();
  }

  async function getCacheStats() {
    return await repositoryCache.getStats();
  }

  async function deleteCachedRepo(folderPath: string) {
    await repositoryCache.delete(folderPath);
  }

  async function analyzeRepoFresh(url: string, folderPath?: string) {
    // Clear cache for this folder first, then analyze
    if (folderPath) {
      await repositoryCache.delete(folderPath);
    }
    return analyzeRepo(url, folderPath, true);
  }

  // Project Management API functions
  async function createProject(
    projectData: ProjectCreateRequest,
  ): Promise<Project> {
    const res = await fetch(`${apiBase}/api/projects`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(projectData),
    });
    if (!res.ok) throw new Error('Failed to create project');
    return await res.json();
  }

  async function getProjects(
    page = 1,
    pageSize = 20,
  ): Promise<{
    projects: Project[];
    total: number;
    page: number;
    page_size: number;
  }> {
    const res = await fetch(
      `${apiBase}/api/projects?page=${page}&page_size=${pageSize}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to get projects');
    return await res.json();
  }

  async function getProject(projectId: string): Promise<Project> {
    const res = await fetch(`${apiBase}/api/projects/${projectId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to get project');
    return await res.json();
  }

  async function updateProject(
    projectId: string,
    projectData: Partial<ProjectCreateRequest>,
  ): Promise<Project> {
    const res = await fetch(`${apiBase}/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(projectData),
    });
    if (!res.ok) throw new Error('Failed to update project');
    return await res.json();
  }

  async function deleteProject(projectId: string): Promise<void> {
    const res = await fetch(`${apiBase}/api/projects/${projectId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete project');
  }

  async function analyzeProject(
    projectId: string,
    analysisType = 'full',
    forceRefresh = false,
  ): Promise<{
    analysis_id: string;
    project_id: string;
    status: string;
    started_at: string;
    progress: any;
  }> {
    const res = await fetch(`${apiBase}/api/projects/${projectId}/analyze`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        project_id: projectId,
        analysis_type: analysisType,
        force_refresh: forceRefresh,
      }),
    });
    if (!res.ok) throw new Error('Failed to start project analysis');
    return await res.json();
  }

  async function getAnalysisProgress(
    projectId: string,
    analysisId: string,
  ): Promise<{
    analysis_id: string;
    project_id: string;
    status: string;
    progress_percentage: number;
    current_step: string;
    total_files: number;
    parsed_files: number;
    total_functions: number;
    analyzed_functions: number;
    error_message?: string;
    started_at?: string;
    completed_at?: string;
  }> {
    const res = await fetch(
      `${apiBase}/api/projects/${projectId}/analysis/${analysisId}/progress`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to get analysis progress');
    return await res.json();
  }

  async function getAnalysisResult(
    projectId: string,
    analysisId: string,
  ): Promise<any> {
    const res = await fetch(
      `${apiBase}/api/projects/${projectId}/analysis/${analysisId}/result`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to get analysis result');
    return await res.json();
  }

  async function getProjectAnalyses(
    projectId: string,
  ): Promise<{ analyses: any[]; total: number }> {
    const res = await fetch(`${apiBase}/api/projects/${projectId}/analyses`);
    if (!res.ok) throw new Error('Failed to get project analyses');
    return await res.json();
  }

  // Settings API functions
  async function getSettings(): Promise<UserSettings> {
    const res = await fetch(`${apiBase}/settings`);
    if (!res.ok) throw new Error('Failed to get settings');
    return await res.json();
  }

  async function updateSettings(
    settings: Partial<UserSettings>,
  ): Promise<UserSettings> {
    const res = await fetch(`${apiBase}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return await res.json();
  }

  async function testConnection(): Promise<{
    results: any;
    overall_status: string;
  }> {
    const res = await fetch(`${apiBase}/settings/test-connection`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to test connection');
    return await res.json();
  }

  async function getEnvironmentInfo(): Promise<any> {
    const res = await fetch(`${apiBase}/settings/environment-info`);
    if (!res.ok) throw new Error('Failed to get environment info');
    return await res.json();
  }

  // Requirements API functions
  async function extractRequirements(
    documentContent: string,
    projectId?: string,
  ): Promise<any> {
    const res = await fetch(`${apiBase}/api/requirements/extract`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ documentContent, projectId }),
    });
    if (!res.ok) throw new Error('Failed to extract requirements');
    return await res.json();
  }

  async function matchRequirements(
    requirementId: string,
    projectId?: string,
  ): Promise<any> {
    const res = await fetch(`${apiBase}/api/requirements/match`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ requirementId, projectId }),
    });
    if (!res.ok) throw new Error('Failed to match requirements');
    return await res.json();
  }

  async function getProjectRequirements(projectId: string): Promise<any> {
    const res = await fetch(
      `${apiBase}/api/requirements/project/${projectId}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to get project requirements');
    return await res.json();
  }

  // Traceability API functions
  async function getTraceabilityMatrix(projectId: string): Promise<any> {
    const res = await fetch(
      `${apiBase}/api/requirements/traceability/matrix/${projectId}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to get traceability matrix');
    return await res.json();
  }

  async function getRequirementTraceability(
    requirementId: string,
  ): Promise<any> {
    const res = await fetch(
      `${apiBase}/api/requirements/traceability/requirement/${requirementId}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to get requirement traceability');
    return await res.json();
  }

  async function analyzeImpact(
    nodeId: string,
    projectId?: string,
  ): Promise<any> {
    const url = projectId
      ? `${apiBase}/api/requirements/traceability/impact/${nodeId}?projectId=${projectId}`
      : `${apiBase}/api/requirements/traceability/impact/${nodeId}`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to analyze impact');
    return await res.json();
  }

  async function exportTraceabilityMatrix(
    projectId: string,
    format: 'json' | 'csv' | 'markdown' = 'json',
  ): Promise<any> {
    const res = await fetch(
      `${apiBase}/api/requirements/traceability/export/${projectId}?format=${format}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to export traceability matrix');
    if (format === 'json') {
      return await res.json();
    }
    return await res.text();
  }

  // Drift detection API functions
  async function detectDrift(projectId: string): Promise<any> {
    const res = await fetch(`${apiBase}/api/requirements/drift/${projectId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to detect drift');
    return await res.json();
  }

  async function checkRequirementDrift(requirementId: string): Promise<any> {
    const res = await fetch(
      `${apiBase}/api/requirements/drift/requirement/${requirementId}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to check requirement drift');
    return await res.json();
  }

  // Gap analysis API functions
  async function getGaps(projectId: string): Promise<any> {
    const res = await fetch(`${apiBase}/api/requirements/gaps/${projectId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to get gaps');
    return await res.json();
  }

  async function getHighPriorityGaps(projectId: string): Promise<any> {
    const res = await fetch(
      `${apiBase}/api/requirements/gaps/${projectId}/priority`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to get high priority gaps');
    return await res.json();
  }

  async function getImplementationSuggestions(
    requirementId: string,
  ): Promise<any> {
    const res = await fetch(
      `${apiBase}/api/requirements/gaps/suggestions/${requirementId}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to get implementation suggestions');
    return await res.json();
  }

  // Compliance API functions
  async function generateComplianceReport(
    projectId: string,
    format: 'json' | 'pdf' | 'html' | 'markdown' = 'json',
    includeDetails = false,
  ): Promise<any> {
    const res = await fetch(
      `${apiBase}/api/requirements/compliance/report/${projectId}?format=${format}&includeDetails=${includeDetails}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to generate compliance report');
    if (format === 'json') {
      return await res.json();
    }
    return await res.text();
  }

  async function validateCompliance(
    projectId: string,
    standards?: string[],
  ): Promise<any> {
    const standardsParam = standards ? standards.join(',') : '';
    const url = standardsParam
      ? `${apiBase}/api/requirements/compliance/validate/${projectId}?standards=${standardsParam}`
      : `${apiBase}/api/requirements/compliance/validate/${projectId}`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to validate compliance');
    return await res.json();
  }

  // Versioning API functions
  async function createRequirementVersion(
    requirementId: string,
    data: {
      title?: string;
      text?: string;
      type?: string;
      status?: string;
      userId?: string;
    },
  ): Promise<any> {
    const res = await fetch(
      `${apiBase}/api/requirements/version/${requirementId}`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      },
    );
    if (!res.ok) throw new Error('Failed to create requirement version');
    return await res.json();
  }

  async function getVersionHistory(requirementId: string): Promise<any> {
    const res = await fetch(
      `${apiBase}/api/requirements/version/history/${requirementId}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to get version history');
    return await res.json();
  }

  // Verify match
  async function verifyMatch(matchId: string, status: string): Promise<any> {
    const res = await fetch(`${apiBase}/api/requirements/verify`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ matchId, status }),
    });
    if (!res.ok) throw new Error('Failed to verify match');
    return await res.json();
  }

  // Accept/Reject requirements
  async function acceptRequirement(requirementId: string): Promise<any> {
    const res = await fetch(`${apiBase}/api/requirements/${requirementId}/accept`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to accept requirement');
    return await res.json();
  }

  async function rejectRequirement(requirementId: string): Promise<any> {
    const res = await fetch(`${apiBase}/api/requirements/${requirementId}/reject`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to reject requirement');
    return await res.json();
  }

  // Search API functions
  async function search(
    query: string,
    repoId?: string,
    limit?: number,
  ): Promise<any> {
    const res = await fetch(`${apiBase}/api/search`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ query, repoId, limit }),
    });
    if (!res.ok) throw new Error('Failed to search');
    return await res.json();
  }

  async function searchWithRAG(
    query: string,
    repoId?: string,
    useVectorSearch = true,
  ): Promise<any> {
    const res = await fetch(`${apiBase}/api/search/rag`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ query, repoId, useVectorSearch }),
    });
    if (!res.ok) throw new Error('Failed to search with RAG');
    return await res.json();
  }

  async function validateResponse(
    response: string,
    repoId?: string,
    query?: string,
  ): Promise<any> {
    const res = await fetch(`${apiBase}/api/search/validate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ response, repoId, query }),
    });
    if (!res.ok) throw new Error('Failed to validate response');
    return await res.json();
  }

  // Repository API functions
  async function createRepository(repoData: {
    projectId?: string;
    name: string;
    url?: string;
    [key: string]: any;
  }): Promise<any> {
    const res = await fetch(`${apiBase}/api/repositories`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(repoData),
    });
    if (!res.ok) throw new Error('Failed to create repository');
    return await res.json();
  }

  async function getRepositories(): Promise<any[]> {
    const res = await fetch(`${apiBase}/api/repositories`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to get repositories');
    return await res.json();
  }

  async function getRepository(repoId: string): Promise<any> {
    const res = await fetch(`${apiBase}/api/repositories/${repoId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to get repository');
    return await res.json();
  }

  async function analyzeRepository(repoId: string): Promise<any> {
    const res = await fetch(`${apiBase}/api/repositories/${repoId}/analyze`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to analyze repository');
    return await res.json();
  }

  async function syncRepository(repoId: string): Promise<any> {
    const res = await fetch(`${apiBase}/api/repositories/${repoId}/sync`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to sync repository');
    return await res.json();
  }

  return {
    analyzeRepo,
    analyzeRepoFresh,
    getFiles,
    getFile,
    askRepoQuestion,
    fetchEnhancedGraph,
    clearCache,
    getCacheStats,
    deleteCachedRepo,
    // Project Management
    createProject,
    getProjects,
    getProject,
    updateProject,
    deleteProject,
    analyzeProject,
    getAnalysisProgress,
    getAnalysisResult,
    getProjectAnalyses,
    // Settings
    getSettings,
    updateSettings,
    testConnection,
    getEnvironmentInfo,
    // Requirements
    extractRequirements,
    matchRequirements,
    getProjectRequirements,
    verifyMatch,
    acceptRequirement,
    rejectRequirement,
    // Traceability
    getTraceabilityMatrix,
    getRequirementTraceability,
    analyzeImpact,
    exportTraceabilityMatrix,
    // Drift Detection
    detectDrift,
    checkRequirementDrift,
    // Gap Analysis
    getGaps,
    getHighPriorityGaps,
    getImplementationSuggestions,
    // Compliance
    generateComplianceReport,
    validateCompliance,
    // Versioning
    createRequirementVersion,
    getVersionHistory,
    // Search
    search,
    searchWithRAG,
    validateResponse,
    // Repositories
    createRepository,
    getRepositories,
    getRepository,
    analyzeRepository,
    syncRepository,
    apiBase,
  };
}
