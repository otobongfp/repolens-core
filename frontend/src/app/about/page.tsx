'use client';

export const runtime = 'edge';

import Link from 'next/link';
import {
  ArrowLeft,
  Github,
  BookOpen,
  Users,
  Target,
  Lightbulb,
  Code,
  Zap,
} from 'lucide-react';
import { Reveal } from '@/components/Reveal';

export default function AboutPage() {
  return (
    <div className='bg-background min-h-screen select-text'>
      <main className='relative mx-auto mt-4 max-w-6xl px-4 py-16 sm:px-6 lg:px-8'>
        {/* Back Button */}
        <div className='mt-4 mb-8'>
          <Reveal>
            <Link
              href='/'
              className='border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition'
            >
              <ArrowLeft className='h-4 w-4' />
              Back to Home
            </Link>
          </Reveal>
        </div>

        {/* Hero Section */}
        <div className='mb-16'>
          <div className='text-center'>
            <Reveal>
              <h1 className='text-foreground mb-6 text-3xl font-bold sm:text-4xl lg:text-5xl'>
                About <span className='text-primary'>RepoLens</span>
              </h1>
            </Reveal>
          </div>

          <Reveal delay={0.2}>
            <p className='text-muted-foreground text-left text-base sm:text-lg leading-relaxed'>
              RepoLens is the <strong>open-source, AI-powered requirements engineering and codebase analysis platform</strong> that ensures what you build perfectly aligns with what you need. It analyzes repositories to provide clear, actionable insights for developers, product leaders, and teams. By combining precise code analysis with intelligent requirement matching, RepoLens helps teams achieve full requirements traceability, real-time completeness tracking, and compliance across all projects.
            </p>
          </Reveal>

          <Reveal delay={0.3}>
            <p className='text-muted-foreground mt-4 text-left text-base sm:text-lg leading-relaxed'>
              <strong>Here's how it works:</strong> Stop spending weeks manually exploring complex codebases. Simply connect your repository and upload your requirements document. Within minutes, RepoLens instantly generates an auditable traceability matrix showing how every requirement maps to the exact code components, down to the function level. You can immediately identify implementation gaps, detect specification drift as code changes, and leverage AI to ask complex questions, receiving precise answers with direct code citations.
            </p>
          </Reveal>
        </div>

        {/* Vision Section */}
        <div className='mb-16'>
          <Reveal>
            <div className='border-border bg-card rounded-2xl border p-8 shadow-lg'>
              <div className='mb-6 flex items-center gap-4'>
                <div className='bg-primary/10 rounded-lg p-3'>
                  <Target className='text-primary h-8 w-8' />
                </div>
                <h2 className='text-card-foreground text-2xl font-bold sm:text-3xl'>
                  Our Vision
                </h2>
              </div>
              <p className='text-muted-foreground text-lg leading-relaxed'>
                To bridge the gap between requirements and implementation, making every codebase instantly understandable and maintainable. RepoLens empowers developers, product leaders, and teams to make informed decisions through AI-powered analysis, ensuring that what's built aligns with what's needed.
              </p>
            </div>
          </Reveal>
        </div>

        {/* Who Can Use Section */}
        <div className='mb-16'>
          <Reveal>
            <h2 className='text-foreground mb-8 text-center text-2xl font-bold sm:text-3xl'>
              Who Can Use RepoLens & Why?
            </h2>
          </Reveal>

          {/* Desktop: Table View */}
          <div className='hidden overflow-x-auto md:block'>
            <table className='border-border bg-card w-full rounded-xl border shadow-sm'>
              <thead>
                <tr className='border-border border-b'>
                  <th className='text-card-foreground px-6 py-4 text-left text-sm font-semibold sm:text-base'>
                    User Role
                  </th>
                  <th className='text-card-foreground px-6 py-4 text-left text-sm font-semibold sm:text-base'>
                    Why RepoLens is Essential
                  </th>
                  <th className='text-card-foreground px-6 py-4 text-left text-sm font-semibold sm:text-base'>
                    Core Benefit
                  </th>
                </tr>
              </thead>
              <tbody className='divide-border divide-y'>
                <tr className='hover:bg-accent/50 transition-colors'>
                  <td className='text-card-foreground px-6 py-4 font-medium'>
                    Software Developers
                  </td>
                  <td className='text-muted-foreground px-6 py-4'>
                    <strong>Code Understanding & Refactoring:</strong> Instantly understand large, legacy, or unfamiliar codebases through AI-guided exploration. Easily trace how a function relates to a requirement, accelerating onboarding and streamlining code reviews.
                  </td>
                  <td className='text-primary px-6 py-4 font-semibold'>
                    Accelerated Code Understanding
                  </td>
                </tr>
                <tr className='hover:bg-accent/50 transition-colors'>
                  <td className='text-card-foreground px-6 py-4 font-medium'>
                    Product Leaders & Managers
                  </td>
                  <td className='text-muted-foreground px-6 py-4'>
                    <strong>Completeness & Gap Tracking:</strong> Get objective, real-time metrics on implementation progress. Automatically identify features that have been missed or partially implemented, ensuring every requirement is fully covered before release.
                  </td>
                  <td className='text-primary px-6 py-4 font-semibold'>
                    Verifiable Implementation Completeness
                  </td>
                </tr>
                <tr className='hover:bg-accent/50 transition-colors'>
                  <td className='text-card-foreground px-6 py-4 font-medium'>
                    Engineering Teams
                  </td>
                  <td className='text-muted-foreground px-6 py-4'>
                    <strong>Audit & Compliance:</strong> Maintain a verifiable, auditable trail from requirements through to code. Automatically flag technical debt or implementation drift whenever code changes, ensuring continuous compliance with specifications.
                  </td>
                  <td className='text-primary px-6 py-4 font-semibold'>
                    Automated Traceability & Compliance
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile: Card Layout */}
          <div className='space-y-4 md:hidden'>
            <div className='border-border bg-card rounded-xl border p-4 shadow-sm'>
              <h3 className='text-card-foreground mb-2 text-base font-semibold'>
                Software Developers
              </h3>
              <p className='text-muted-foreground mb-3 text-sm leading-relaxed'>
                <strong>Code Understanding & Refactoring:</strong> Instantly understand large, legacy, or unfamiliar codebases through AI-guided exploration. Easily trace how a function relates to a requirement, accelerating onboarding and streamlining code reviews.
              </p>
              <div className='text-primary text-sm font-semibold'>
                Accelerated Code Understanding
              </div>
            </div>

            <div className='border-border bg-card rounded-xl border p-4 shadow-sm'>
              <h3 className='text-card-foreground mb-2 text-base font-semibold'>
                Product Leaders & Managers
              </h3>
              <p className='text-muted-foreground mb-3 text-sm leading-relaxed'>
                <strong>Completeness & Gap Tracking:</strong> Get objective, real-time metrics on implementation progress. Automatically identify features that have been missed or partially implemented, ensuring every requirement is fully covered before release.
              </p>
              <div className='text-primary text-sm font-semibold'>
                Verifiable Implementation Completeness
              </div>
            </div>

            <div className='border-border bg-card rounded-xl border p-4 shadow-sm'>
              <h3 className='text-card-foreground mb-2 text-base font-semibold'>
                Engineering Teams
              </h3>
              <p className='text-muted-foreground mb-3 text-sm leading-relaxed'>
                <strong>Audit & Compliance:</strong> Maintain a verifiable, auditable trail from requirements through to code. Automatically flag technical debt or implementation drift whenever code changes, ensuring continuous compliance with specifications.
              </p>
              <div className='text-primary text-sm font-semibold'>
                Automated Traceability & Compliance
              </div>
            </div>
          </div>
        </div>

        {/* Why Use RepoLens Section */}
        <div className='mb-16'>
          <Reveal>
            <h2 className='text-foreground mb-12 text-center text-2xl font-bold sm:text-3xl'>
              Why Use RepoLens?
            </h2>
          </Reveal>

          <div className='grid items-stretch gap-6 md:grid-cols-2'>
            <Reveal delay={0.1}>
              <div className='border-border bg-card flex flex-col rounded-xl border p-6 shadow-sm transition hover:shadow-md'>
                <div className='bg-primary/10 mb-4 w-fit rounded-lg p-3'>
                  <Code className='text-primary h-6 w-6' />
                </div>
                <h3 className='text-card-foreground mb-3 text-lg font-semibold sm:text-xl'>
                  Intelligent Code Analysis
                </h3>
                <p className='text-muted-foreground flex-1 leading-relaxed'>
                  RepoLens provides comprehensive analysis by meticulously breaking down the codebase's structure. Our powerful AI engine uses this structure to identify patterns, technical debt, and provide deep, actionable insights for code improvement and maintenance.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div className='border-border bg-card flex flex-col rounded-xl border p-6 shadow-sm transition hover:shadow-md'>
                <div className='bg-primary/10 mb-4 w-fit rounded-lg p-3'>
                  <Target className='text-primary h-6 w-6' />
                </div>
                <h3 className='text-card-foreground mb-3 text-lg font-semibold sm:text-xl'>
                  Real-time Traceability & Completeness
                </h3>
                <p className='text-muted-foreground flex-1 leading-relaxed'>
                  Connect business requirements to specific code implementations with our intelligent matching system. RepoLens tracks requirement coverage in real-time, calculating completeness scores and automatically flagging drift and implementation gaps to keep teams aligned.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.3}>
              <div className='border-border bg-card flex flex-col rounded-xl border p-6 shadow-sm transition hover:shadow-md md:col-span-2'>
                <div className='bg-primary/10 mb-4 w-fit rounded-lg p-3'>
                  <Zap className='text-primary h-6 w-6' />
                </div>
                <h3 className='text-card-foreground mb-3 text-lg font-semibold sm:text-xl'>
                  Scalable Project Management
                </h3>
                <p className='text-muted-foreground flex-1 leading-relaxed'>
                  Manage multiple projects across your organization with our robust, scalable architecture. Easily create, analyze, and track projects from GitHub, GitLab, or local sources with comprehensive project lifecycle management features.
                </p>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Presentation Section */}
        <div className='mb-16'>
          <Reveal>
            <div className='border-border bg-card rounded-2xl border p-8 shadow-lg'>
              <div className='mb-6 flex items-center gap-4'>
                <div className='bg-primary/10 rounded-lg p-3'>
                  <Users className='text-primary h-8 w-8' />
                </div>
                <h2 className='text-card-foreground text-2xl font-bold sm:text-3xl'>
                  RepoLens at OSCAFEST 2025
                </h2>
              </div>

              <div className='grid gap-8 lg:grid-cols-2 lg:items-center'>
                <div>
                  <div className='mb-4 overflow-hidden rounded-xl shadow-lg'>
                    <img
                      src='/Presentation_OSCAFEST.jpg'
                      alt='Otobong Peter presenting RepoLens at OSCAFEST 2025'
                      className='h-auto w-full object-cover'
                    />
                  </div>
                </div>

                <div>
                  <h3 className='text-card-foreground mb-4 text-xl font-semibold sm:text-2xl'>
                    Otobong Peter
                  </h3>
                  <p className='text-muted-foreground mb-4 text-base leading-relaxed sm:text-lg'>
                    Presenting RepoLens at Open Source Conference Africa
                    Festival 2025
                  </p>
                  <p className='text-muted-foreground mb-6 leading-relaxed'>
                    RepoLens was showcased at OSCAFEST 2025, demonstrating how
                    AI-powered codebase analysis can revolutionize how
                    developers understand and maintain complex codebases. The
                    presentation highlighted our mission to make code analysis
                    more accessible and provide actionable insights for
                    developers and teams worldwide.
                  </p>
                  <div className='flex flex-wrap gap-4'>
                    <Link
                      href='https://github.com/otobongfp/repolens'
                      target='_blank'
                      rel='noopener noreferrer'
                      className='border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition'
                    >
                      <Github className='h-4 w-4' />
                      View on GitHub
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* CTA Section */}
        <div className='flex flex-col items-center justify-center text-center'>
          <Reveal>
            <h2 className='text-foreground mb-4 text-2xl font-bold sm:text-3xl'>
              Ready to Explore?
            </h2>
            <p className='text-muted-foreground mb-6 text-base sm:text-lg'>
              Start analyzing your first repository and experience the power of
              AI-driven codebase analysis with RepoLens.
            </p>
            <div className='flex flex-col items-center gap-4'>
              <Link
                href='/select'
                className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-3 text-lg font-semibold transition'
              >
                Get Started
                <ArrowLeft className='h-5 w-5 rotate-180' />
              </Link>

              <Link
                href='https://github.com/otobongfp/repolens'
                target='_blank'
                rel='noopener noreferrer'
                className='border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition'
              >
                <Github className='h-4 w-4' />
                View Source Code on GitHub
              </Link>
            </div>
          </Reveal>
        </div>
      </main>
    </div>
  );
}
