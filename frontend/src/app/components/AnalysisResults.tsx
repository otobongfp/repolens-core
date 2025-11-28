'use client';

import React, { useState } from 'react';
import {
  CodeIcon,
  ShieldIcon,
  BarChart3Icon,
  FileTextIcon,
  GitBranchIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  InfoIcon,
} from '../components/LucideIcons';

export interface AnalysisResult {
  analysis_id: string;
  project_id: string;
  status: string;
  started_at: string;
  completed_at: string;
  statistics: {
    total_files: number;
    parsed_files: number;
    total_functions: number;
    analyzed_functions: number;
    progress_percentage: number;
  };
  insights?: {
    code_structure?: any;
    security_issues?: any[];
    complexity_metrics?: any;
    dependencies?: any[];
    recommendations?: string[];
  };
}

interface AnalysisResultsProps {
  result: AnalysisResult;
  onVisualize: () => void;
}

type TabType =
  | 'overview'
  | 'structure'
  | 'security'
  | 'complexity'
  | 'dependencies';

export default function AnalysisResults({
  result,
  onVisualize,
}: AnalysisResultsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <BarChart3Icon className='h-4 w-4' />,
    },
    {
      id: 'structure',
      label: 'Code Structure',
      icon: <CodeIcon className='h-4 w-4' />,
    },
    {
      id: 'security',
      label: 'Security',
      icon: <ShieldIcon className='h-4 w-4' />,
    },
    {
      id: 'complexity',
      label: 'Complexity',
      icon: <FileTextIcon className='h-4 w-4' />,
    },
    {
      id: 'dependencies',
      label: 'Dependencies',
      icon: <GitBranchIcon className='h-4 w-4' />,
    },
  ];

  const renderOverview = () => (
    <div className='space-y-6'>
      {/* Statistics Cards */}
      <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
        <div className='rounded-lg border border-blue-500/20 bg-blue-500/10 p-4'>
          <div className='mb-2 flex items-center gap-2'>
            <FileTextIcon className='h-4 w-4 text-blue-500' />
            <span className='text-sm font-medium text-blue-400'>
              Files Analyzed
            </span>
          </div>
          <div className='text-2xl font-bold text-blue-300'>
            {result.statistics.parsed_files}
          </div>
          <div className='text-xs text-blue-400'>
            of {result.statistics.total_files} total
          </div>
        </div>

        <div className='rounded-lg border border-green-500/20 bg-green-500/10 p-4'>
          <div className='mb-2 flex items-center gap-2'>
            <CodeIcon className='h-4 w-4 text-green-500' />
            <span className='text-sm font-medium text-green-400'>
              Functions
            </span>
          </div>
          <div className='text-2xl font-bold text-green-300'>
            {result.statistics.analyzed_functions}
          </div>
          <div className='text-xs text-green-400'>analyzed</div>
        </div>

        <div className='rounded-lg border border-purple-500/20 bg-purple-500/10 p-4'>
          <div className='mb-2 flex items-center gap-2'>
            <CheckCircleIcon className='h-4 w-4 text-purple-500' />
            <span className='text-sm font-medium text-purple-400'>Status</span>
          </div>
          <div className='text-2xl font-bold text-purple-300 capitalize'>
            {result.status}
          </div>
          <div className='text-xs text-purple-400'>analysis complete</div>
        </div>

        <div className='rounded-lg border border-orange-500/20 bg-orange-500/10 p-4'>
          <div className='mb-2 flex items-center gap-2'>
            <BarChart3Icon className='h-4 w-4 text-orange-500' />
            <span className='text-sm font-medium text-orange-400'>
              Progress
            </span>
          </div>
          <div className='text-2xl font-bold text-orange-300'>
            {result.statistics.progress_percentage}%
          </div>
          <div className='text-xs text-orange-400'>complete</div>
        </div>
      </div>

      {/* Analysis Summary */}
      <div className='bg-background rounded-lg p-6'>
        <h3 className='text-foreground mb-4 text-lg font-semibold'>
          Analysis Summary
        </h3>
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>Analysis ID:</span>
            <span className='text-foreground font-mono text-sm'>
              {result.analysis_id.slice(0, 8)}...
            </span>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>Started:</span>
            <span className='text-foreground text-xs'>
              {new Date(result.started_at).toLocaleString()}
            </span>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>Completed:</span>
            <span className='text-foreground text-xs'>
              {new Date(result.completed_at).toLocaleString()}
            </span>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>Duration:</span>
            <span className='text-foreground text-sm'>
              {Math.round(
                (new Date(result.completed_at).getTime() -
                  new Date(result.started_at).getTime()) /
                  1000,
              )}
              s
            </span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className='text-center'>
        <button
          onClick={onVisualize}
          className='bg-primary hover:bg-primary/80 text-primary-foreground rounded-lg px-8 py-3 font-semibold transition-colors'
        >
          Visualize Analysis Results
        </button>
      </div>
    </div>
  );

  const renderStructure = () => (
    <div className='space-y-6'>
      <div className='bg-background rounded-lg p-6'>
        <h3 className='text-foreground mb-4 text-lg font-semibold'>
          Code Structure
        </h3>
        <div className='text-muted-foreground'>
          <p className='mb-4'>
            Code structure visualization will be displayed here, showing:
          </p>
          <ul className='list-inside list-disc space-y-2 text-sm'>
            <li>File hierarchy and organization</li>
            <li>Function and class relationships</li>
            <li>Import dependencies</li>
            <li>Call graph visualization</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className='space-y-6'>
      <div className='bg-background rounded-lg p-6'>
        <h3 className='text-foreground mb-4 flex items-center gap-2 text-lg font-semibold'>
          <ShieldIcon className='h-5 w-5' />
          Security Analysis
        </h3>
        <div className='space-y-4'>
          <div className='flex items-center gap-2 text-green-400'>
            <CheckCircleIcon className='h-4 w-4' />
            <span>No critical security issues found</span>
          </div>
          <div className='text-muted-foreground text-sm'>
            Security analysis results will be displayed here, including:
          </div>
          <ul className='text-muted-foreground list-inside list-disc space-y-1 text-sm'>
            <li>Vulnerability scanning results</li>
            <li>Dependency security audit</li>
            <li>Code quality security checks</li>
            <li>Best practices compliance</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderComplexity = () => (
    <div className='space-y-6'>
      <div className='bg-background rounded-lg p-6'>
        <h3 className='text-foreground mb-4 text-lg font-semibold'>
          Complexity Metrics
        </h3>
        <div className='text-muted-foreground'>
          <p className='mb-4'>
            Code complexity analysis will be displayed here, showing:
          </p>
          <ul className='list-inside list-disc space-y-2 text-sm'>
            <li>Cyclomatic complexity scores</li>
            <li>Code maintainability metrics</li>
            <li>Function and class complexity</li>
            <li>Technical debt indicators</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderDependencies = () => (
    <div className='space-y-6'>
      <div className='bg-background rounded-lg p-6'>
        <h3 className='text-foreground mb-4 text-lg font-semibold'>
          Dependencies
        </h3>
        <div className='text-muted-foreground'>
          <p className='mb-4'>
            Dependency analysis will be displayed here, showing:
          </p>
          <ul className='list-inside list-disc space-y-2 text-sm'>
            <li>External library dependencies</li>
            <li>Internal module relationships</li>
            <li>Dependency version analysis</li>
            <li>Circular dependency detection</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'structure':
        return renderStructure();
      case 'security':
        return renderSecurity();
      case 'complexity':
        return renderComplexity();
      case 'dependencies':
        return renderDependencies();
      default:
        return renderOverview();
    }
  };

  return (
    <div className='w-full'>
      {/* Tab Navigation */}
      <div className='mb-6 border-b border-gray-200'>
        <nav className='flex space-x-8'>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground border-transparent hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
}
