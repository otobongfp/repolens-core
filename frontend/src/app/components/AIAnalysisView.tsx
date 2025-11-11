import React, { useState, useEffect } from 'react';
import { useGraphData } from '../context/GraphDataProvider';
import { useRepolensApi } from '../utils/api';

interface AIAnalysisData {
  enabled: boolean;
  scores: {
    complexity: number;
    security: number;
    maintainability: number;
    architecture: number;
    quality: number;
    overall: number;
  };
  analysis: Record<string, string>;
  summary: string;
  error?: string;
}

export default function AIAnalysisView() {
  const { currentFolder } = useGraphData();
  const { fetchEnhancedGraph, apiBase } = useRepolensApi();
  const [analysisData, setAnalysisData] = useState<AIAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const analyzeCodebase = async () => {
    if (!currentFolder) return;

    setLoading(true);
    setError(null);

    try {
      const enhancedGraph = await fetchEnhancedGraph(currentFolder);
      console.log(enhancedGraph);
      console.log('Enhanced graph:', enhancedGraph);
      const response = await fetch(`${apiBase}/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ graph_data: enhancedGraph }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('AI backend error:', errorData);
        throw new Error(errorData.detail || 'AI analysis failed');
      }

      const data = await response.json();
      console.log('AI analysis data:', data);
      setAnalysisData(data);
    } catch (err) {
      console.error('AI analysis error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentFolder) {
      analyzeCodebase();
    }
  }, [currentFolder]);

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    if (score >= 4) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreBackground = (score: number) => {
    if (score >= 8) return 'bg-green-500/20 border-green-500/30';
    if (score >= 6) return 'bg-yellow-500/20 border-yellow-500/30';
    if (score >= 4) return 'bg-orange-500/20 border-orange-500/30';
    return 'bg-red-500/20 border-red-500/30';
  };

  const getScoreStatus = (score: number) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Poor';
  };

  const renderOverview = () => {
    if (!analysisData) return null;

    return (
      <div className='space-y-6'>
        {/* Overall Summary */}
        <div className='rounded-lg border border-gray-700 bg-gray-800/50 p-6'>
          <h3 className='mb-4 text-xl font-bold text-white'>
            Overall Assessment
          </h3>
          <div className='grid grid-cols-2 gap-4 md:grid-cols-3'>
            {Object.entries(analysisData.scores).map(([key, score]) => (
              <div
                key={key}
                className={`rounded-lg border p-4 ${getScoreBackground(score)}`}
              >
                <div className='mb-1 text-sm text-gray-300 capitalize'>
                  {key === 'overall' ? 'Overall' : key}
                </div>
                <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
                  {score.toFixed(1)}
                </div>
                <div className='text-xs text-gray-400'>
                  {getScoreStatus(score)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className='rounded-lg border border-gray-700 bg-gray-800/50 p-6'>
          <h3 className='mb-3 text-lg font-semibold text-white'>AI Summary</h3>
          <p className='text-gray-300'>{analysisData.summary}</p>
        </div>
      </div>
    );
  };

  const renderDetailedAnalysis = () => {
    if (!analysisData?.analysis) return null;

    return (
      <div className='space-y-6'>
        {Object.entries(analysisData.analysis).map(([category, content]) => (
          <div
            key={category}
            className='rounded-lg border border-gray-700 bg-gray-800/50 p-6'
          >
            <h3 className='mb-3 text-lg font-semibold text-white capitalize'>
              {category} Analysis
            </h3>
            <div className='rounded-sm bg-gray-900/50 p-4'>
              <pre className='font-mono text-sm whitespace-pre-wrap text-gray-300'>
                {content}
              </pre>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderVulnerabilities = () => {
    if (!analysisData?.analysis?.security) return null;

    // Extract security information from the analysis
    const securityContent = analysisData.analysis.security;

    return (
      <div className='space-y-6'>
        <div className='rounded-lg border border-gray-700 bg-gray-800/50 p-6'>
          <h3 className='mb-3 text-lg font-semibold text-white'>
            Security Analysis
          </h3>
          <div className='rounded-sm bg-gray-900/50 p-4'>
            <pre className='font-mono text-sm whitespace-pre-wrap text-gray-300'>
              {securityContent}
            </pre>
          </div>
        </div>
      </div>
    );
  };

  const renderIssues = () => {
    if (!analysisData?.analysis) return null;

    // Extract issues from all analyses
    const allIssues: string[] = [];

    Object.entries(analysisData.analysis).forEach(([category, content]) => {
      // Simple extraction of issues (in a real implementation, parse JSON properly)
      const lines = content.split('\n');
      lines.forEach((line) => {
        if (
          line.toLowerCase().includes('issue') ||
          line.toLowerCase().includes('problem') ||
          line.toLowerCase().includes('vulnerability') ||
          line.toLowerCase().includes('smell') ||
          line.toLowerCase().includes('anti-pattern')
        ) {
          allIssues.push(`${category}: ${line.trim()}`);
        }
      });
    });

    return (
      <div className='space-y-4'>
        <h3 className='text-lg font-semibold text-white'>Identified Issues</h3>
        {allIssues.length > 0 ? (
          <div className='space-y-3'>
            {allIssues.map((issue, index) => (
              <div
                key={index}
                className='rounded-lg border border-red-500/30 bg-red-500/10 p-4'
              >
                <p className='text-sm text-red-300'>{issue}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className='rounded-lg border border-green-500/30 bg-green-500/10 p-4'>
            <p className='text-sm text-green-300'>
              No major issues identified!
            </p>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center py-16'>
        <div className='text-center'>
          <div className='border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2'></div>
          <p className='text-gray-400'>AI is analyzing your codebase...</p>
          <p className='mt-2 text-sm text-gray-500'>
            This should take 10-30 seconds (optimized from 2-3 minutes!)
          </p>
          <div className='mt-4 text-xs text-gray-600'>
            <p>• Analyzing complexity and architecture</p>
            <p>• Checking security vulnerabilities</p>
            <p>• Assessing maintainability and code quality</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='py-16 text-center'>
        <div className='mx-auto max-w-md rounded-lg border border-red-500/30 bg-red-500/10 p-6'>
          <h3 className='mb-2 font-semibold text-red-300'>Analysis Failed</h3>
          <p className='mb-4 text-sm text-red-200'>{error}</p>
          <button
            onClick={analyzeCodebase}
            className='bg-primary hover:bg-primary/80 rounded-sm px-4 py-2 text-white transition'
          >
            Retry Analysis
          </button>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className='py-16 text-center'>
        <p className='text-gray-400'>No analysis data available</p>
      </div>
    );
  }

  if (!analysisData.enabled) {
    return (
      <div className='py-16 text-center'>
        <div className='mx-auto max-w-md rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-6'>
          <h3 className='mb-2 font-semibold text-yellow-300'>
            AI Analysis Disabled
          </h3>
          <p className='mb-4 text-sm text-yellow-200'>
            {analysisData.error || 'OpenAI API key not configured'}
          </p>
          <p className='text-xs text-gray-400'>
            Please configure your OpenAI API key to enable AI analysis
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='py-4'>
      <div className='mb-6 flex items-center justify-between'>
        <h2 className='text-primary text-xl font-bold'>AI Code Analysis</h2>
        <button
          onClick={analyzeCodebase}
          className='bg-primary hover:bg-primary/80 rounded-sm px-4 py-2 text-white transition'
        >
          Refresh Analysis
        </button>
      </div>

      {/* Tabs */}
      <div className='mb-6 flex gap-2 border-b border-white/10'>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'detailed', label: 'Detailed Analysis' },
          { key: 'vulnerabilities', label: 'Security & Vulnerabilities' },
          { key: 'issues', label: 'Issues & Recommendations' },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`rounded-t px-4 py-2 font-semibold transition focus:outline-hidden ${
              activeTab === tab.key
                ? 'border-primary text-primary border-b-4 bg-white/5'
                : 'text-white/80 hover:bg-white/10'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className='transition-opacity duration-300'>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'detailed' && renderDetailedAnalysis()}
        {activeTab === 'vulnerabilities' && renderVulnerabilities()}
        {activeTab === 'issues' && renderIssues()}
      </div>
    </div>
  );
}
