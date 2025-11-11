'use client';

import React from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  PlayIcon,
  CodeIcon,
  ShieldIcon,
  DatabaseIcon,
  BrainIcon,
} from '../components/LucideIcons';

export interface AnalysisStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress?: number;
  icon?: React.ReactNode;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

interface AnalysisTimelineProps {
  steps: AnalysisStep[];
  currentStep?: string;
  overallProgress?: number;
}

const stepIcons = {
  discovery: <CodeIcon className='h-4 w-4' />,
  parsing: <CodeIcon className='h-4 w-4' />,
  analyzing: <BrainIcon className='h-4 w-4' />,
  storing: <DatabaseIcon className='h-4 w-4' />,
  ai_analysis: <BrainIcon className='h-4 w-4' />,
  security: <ShieldIcon className='h-4 w-4' />,
  default: <PlayIcon className='h-4 w-4' />,
};

export default function AnalysisTimeline({
  steps,
  currentStep,
  overallProgress = 0,
}: AnalysisTimelineProps) {
  const getStepIcon = (stepId: string, status: string) => {
    if (status === 'completed') {
      return <CheckCircleIcon className='h-4 w-4 text-green-500' />;
    }
    if (status === 'error') {
      return <XCircleIcon className='h-4 w-4 text-red-500' />;
    }
    if (status === 'running') {
      return <ClockIcon className='h-4 w-4 animate-spin text-blue-500' />;
    }
    return stepIcons[stepId as keyof typeof stepIcons] || stepIcons.default;
  };

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-green-500 bg-green-500/10';
      case 'running':
        return 'border-blue-500 bg-blue-500/10';
      case 'error':
        return 'border-red-500 bg-red-500/10';
      default:
        return 'border-gray-500 bg-gray-500/10';
    }
  };

  return (
    <div className='w-full'>
      {/* Overall Progress */}
      <div className='mb-6'>
        <div className='mb-2 flex items-center justify-between'>
          <h3 className='text-foreground text-lg font-semibold'>
            Analysis Progress
          </h3>
          <span className='text-muted-foreground text-sm'>
            {Math.round(overallProgress)}%
          </span>
        </div>
        <div className='h-2 w-full overflow-hidden rounded-full bg-gray-200'>
          <div
            className='h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500'
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Timeline Steps */}
      <div className='space-y-4'>
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`relative flex items-start rounded-lg border-2 p-4 transition-all duration-300 ${getStepStatusColor(
              step.status,
            )}`}
          >
            {/* Timeline Line */}
            {index < steps.length - 1 && (
              <div
                className={`absolute top-12 left-6 h-8 w-0.5 ${
                  step.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
            )}

            {/* Step Icon */}
            <div className='mt-0.5 mr-4 flex-shrink-0'>
              {getStepIcon(step.id, step.status)}
            </div>

            {/* Step Content */}
            <div className='min-w-0 flex-1'>
              <div className='mb-1 flex items-center justify-between'>
                <h4 className='text-foreground text-sm font-medium'>
                  {step.name}
                </h4>
                {step.progress !== undefined && step.status === 'running' && (
                  <span className='text-muted-foreground text-xs'>
                    {Math.round(step.progress)}%
                  </span>
                )}
              </div>

              <p className='text-muted-foreground mb-2 text-xs'>
                {step.description}
              </p>

              {/* Progress Bar for Running Steps */}
              {step.status === 'running' && step.progress !== undefined && (
                <div className='mb-2 h-1 w-full overflow-hidden rounded-full bg-gray-200'>
                  <div
                    className='h-full bg-blue-500 transition-all duration-300'
                    style={{ width: `${step.progress}%` }}
                  />
                </div>
              )}

              {/* Error Message */}
              {step.status === 'error' && step.errorMessage && (
                <div className='rounded bg-red-500/10 p-2 text-xs text-red-400'>
                  {step.errorMessage}
                </div>
              )}

              {/* Timing Info */}
              <div className='text-muted-foreground flex items-center gap-4 text-xs'>
                {step.startedAt && (
                  <span>
                    Started: {new Date(step.startedAt).toLocaleTimeString()}
                  </span>
                )}
                {step.completedAt && (
                  <span>
                    Completed: {new Date(step.completedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
