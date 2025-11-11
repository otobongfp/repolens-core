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

    // Use /repository/analyze/project for directory analysis
    const endpoint = folderPath
      ? `${apiBase}/repository/analyze/project`
      : `${apiBase}/repository/analyze`;

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  async function getFiles() {
    const res = await fetch(`${apiBase}/repository/files`);
    if (!res.ok) throw new Error('Failed to get files');
    return await res.json();
  }

  async function getFile(path: string) {
    const res = await fetch(
      `${apiBase}/repository/file?path=${encodeURIComponent(path)}`,
    );
    if (!res.ok) throw new Error('Failed to get file');
    return await res.json();
  }

  async function askRepoQuestion(graph: any, question: string) {
    const res = await fetch(`${apiBase}/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph_data: graph, question }),
    });
    if (!res.ok) throw new Error('Failed to get answer from AI');
    return await res.json();
  }

  async function fetchEnhancedGraph(folderPath: string) {
    const res = await fetch(`${apiBase}/repository/analyze/enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_path: folderPath }),
    });
    if (!res.ok) throw new Error('Failed to fetch enhanced graph');
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
      method: 'PUT',
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
    apiBase,
  };
}
