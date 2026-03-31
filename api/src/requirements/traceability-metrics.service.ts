import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { RequirementsService } from './requirements.service';
import type { MatcherType } from './matchers';
import type { TraceabilityExperimentConfig } from './matchers';
import { getProjectCodeScopeRepoIds } from './matchers/project-scope.util';

export interface LinkPair {
  requirementId: string;
  nodeId: string;
}

export type DatasetType = 'validation' | 'test';

export interface ProjectMetricsRow {
  projectId: string;
  projectName: string;
  matcherType: string;
  threshold: number;
  precision: number;
  recall: number;
  f1: number;
  coverage: number;
  tp: number;
  fp: number;
  fn: number;
  totalRequirements: number;
  groundTruthLinks: number;
}

export interface MetricsAtThreshold {
  threshold: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number | null;
  precision: number;
  recall: number;
  f1: number;
  coverage: number;
  totalRequirements: number;
  linkedRequirements: number;
  predictedLinksCount: number;
  groundTruthLinksCount: number;
}

export interface MetricsResponse {
  projectId: string;
  thresholds: number[];
  atThreshold: Record<string, MetricsAtThreshold>;
  optimalThreshold: number | null;
  optimalF1: number | null;
  summary: {
    totalRequirements: number;
    totalCodeElements: number;
    groundTruthLinksCount: number;
    requirementsWithGroundTruth: number;
  };
}

@Injectable()
export class TraceabilityMetricsService {
  private readonly logger = new Logger(TraceabilityMetricsService.name);
  // Include lower thresholds because dense/graph scores can cluster below 0.5.
  private readonly DEFAULT_THRESHOLD_GRID = [
    0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly requirementsService: RequirementsService,
  ) {}

  /**
   * Get ground truth set G for a project: (requirementId, nodeId) pairs.
   */
  async getGroundTruthSet(projectId: string): Promise<Set<string>> {
    const rows = await this.prisma.requirementGroundTruth.findMany({
      where: { projectId },
      select: { requirementId: true, nodeId: true },
    });
    const set = new Set<string>();
    for (const r of rows) {
      set.add(this.pairKey(r.requirementId, r.nodeId));
    }
    return set;
  }

  /**
   * Get predicted set P(τ) for a project: RequirementMatch with matchScore >= threshold and matcherType.
   * Only for requirements that belong to the project.
   * Predictions are independent of ground truth: no GT is read or used here. GT is only used later
   * during evaluation (e.g. in getMetricsAtThreshold when computing TP/FP/FN against a GT subset).
   * Pass requirementIds to skip the requirement lookup (e.g. when comparing multiple matchers).
   */
  async getPredictedSet(
    projectId: string,
    threshold: number,
    matcherType: MatcherType = 'hybrid',
    options?: { requirementIds?: string[] }
  ): Promise<{ set: Set<string>; requirementIds: Set<string> }> {
    let reqIds: Set<string>;
    if (options?.requirementIds?.length) {
      reqIds = new Set(options.requirementIds);
    } else {
      const requirements = await this.prisma.requirement.findMany({
        where: { projectId },
        select: { id: true },
      });
      reqIds = new Set(requirements.map((r) => r.id));
    }
    if (reqIds.size === 0) {
      return { set: new Set(), requirementIds: new Set() };
    }

    const matches = await this.prisma.requirementMatch.findMany({
      where: {
        requirementId: { in: Array.from(reqIds) },
        matchScore: { gte: threshold },
        matcherType,
      },
      select: { requirementId: true, nodeId: true },
    });

    const set = new Set<string>();
    const linkedReqs = new Set<string>();
    for (const m of matches) {
      set.add(this.pairKey(m.requirementId, m.nodeId));
      linkedReqs.add(m.requirementId);
    }
    return { set, requirementIds: linkedReqs };
  }

  /**
   * Compute TP, FP, FN (and optionally TN) from sets G and P.
   */
  computeConfusion(
    G: Set<string>,
    P: Set<string>,
    totalRequirements: number,
    totalCodeElements: number
  ): { tp: number; fp: number; fn: number; tn: number | null } {
    let tp = 0;
    for (const key of P) {
      if (G.has(key)) tp++;
    }
    const fp = P.size - tp;
    const fn = G.size - tp;
    const universeSize = totalRequirements * totalCodeElements;
    const tn =
      universeSize > 0 ? universeSize - tp - fp - fn : null;
    return { tp, fp, fn, tn };
  }

  /**
   * Precision = TP / (TP + FP)
   */
  precision(tp: number, fp: number): number {
    const denom = tp + fp;
    return denom === 0 ? 0 : tp / denom;
  }

  /**
   * Recall = TP / (TP + FN)
   */
  recall(tp: number, fn: number): number {
    const denom = tp + fn;
    return denom === 0 ? 0 : tp / denom;
  }

  /**
   * F1 = 2 * TP / (2*TP + FP + FN)
   */
  f1(tp: number, fp: number, fn: number): number {
    const denom = 2 * tp + fp + fn;
    return denom === 0 ? 0 : (2 * tp) / denom;
  }

  /**
   * Coverage = |R_linked| / |R|
   */
  coverage(linkedRequirements: number, totalRequirements: number): number {
    return totalRequirements === 0 ? 0 : linkedRequirements / totalRequirements;
  }

  /**
   * Compute metrics at a single threshold τ for a matcher type.
   * Predictions P come from getPredictedSet (RequirementMatch only); ground truth G is used only
   * here to compute TP/FP/FN (P ∩ G, P \ G, G \ P). No pre-filtering of P by G; GT is evaluation-only.
   * Optionally restrict G to a validation or test subset for tuning/eval.
   */
  async getMetricsAtThreshold(
    projectId: string,
    threshold: number,
    matcherType: MatcherType = 'hybrid',
    options?: { groundTruthSubset?: Set<string> }
  ): Promise<MetricsAtThreshold> {
    const tau = this.clampThreshold(threshold);
    const [fullG, requirements, codeElementCount] = await Promise.all([
      this.getGroundTruthSet(projectId),
      this.prisma.requirement.findMany({
        where: { projectId },
        select: { id: true },
      }),
      this.getProjectCodeElementCount(projectId),
    ]);

    const G = options?.groundTruthSubset ?? fullG;
    const totalRequirements = requirements.length;
    const { set: P, requirementIds: linkedReqs } = await this.getPredictedSet(
      projectId,
      tau,
      matcherType
    );

    const { tp, fp, fn, tn } = this.computeConfusion(
      G,
      P,
      totalRequirements,
      codeElementCount
    );

    const precisionVal = this.precision(tp, fp);
    const recallVal = this.recall(tp, fn);
    const f1Val = this.f1(tp, fp, fn);
    const coverageVal = this.coverage(linkedReqs.size, totalRequirements);

    return {
      threshold: tau,
      tp,
      fp,
      fn,
      tn,
      precision: Math.round(precisionVal * 10000) / 10000,
      recall: Math.round(recallVal * 10000) / 10000,
      f1: Math.round(f1Val * 10000) / 10000,
      coverage: Math.round(coverageVal * 10000) / 10000,
      totalRequirements,
      linkedRequirements: linkedReqs.size,
      predictedLinksCount: P.size,
      groundTruthLinksCount: G.size,
    };
  }

  /**
   * Get metrics at multiple thresholds and optimal τ (argmax F1) for a matcher type.
   * Fetches shared data once and reuses it for all thresholds to avoid redundant DB round-trips.
   */
  async getMetrics(
    projectId: string,
    thresholds: number[] = this.DEFAULT_THRESHOLD_GRID,
    matcherType: MatcherType = 'hybrid'
  ): Promise<MetricsResponse> {
    this.logger.log(`Computing traceability metrics for project ${projectId} (matcher: ${matcherType})`);

    const [gtRows, requirements, codeElementCount] = await Promise.all([
      this.prisma.withRetry(() => this.prisma.requirementGroundTruth.findMany({
        where: { projectId },
        select: { requirementId: true, nodeId: true },
      })),
      this.prisma.withRetry(() => this.prisma.requirement.findMany({
        where: { projectId },
        select: { id: true },
      })),
      this.getProjectCodeElementCount(projectId),
    ]);

    const fullG = new Set<string>(gtRows.map((r) => this.pairKey(r.requirementId, r.nodeId)));
    const totalRequirements = requirements.length;
    const requirementIds = requirements.map((r) => r.id);
    const requirementsWithGroundTruth = new Set(gtRows.map((g) => g.requirementId)).size;
    const groundTruthLinksCount = fullG.size;

    const atThreshold: Record<string, MetricsAtThreshold> = {};
    let optimalThreshold: number | null = null;
    let optimalF1: number | null = null;

    const normalizedThresholds = thresholds
      .map((t) => this.clampThreshold(t))
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .sort((a, b) => a - b);

    // Optimization: Fetch ALL matches above the lowest threshold once
    const minThreshold = normalizedThresholds[0];
    const allMatches = await this.prisma.requirementMatch.findMany({
      where: {
        requirementId: { in: requirementIds },
        matchScore: { gte: minThreshold },
        matcherType,
      },
      select: { requirementId: true, nodeId: true, matchScore: true },
    });

    for (const tau of normalizedThresholds) {
      const P = new Set<string>();
      const linkedReqs = new Set<string>();

      for (const m of allMatches) {
        if (m.matchScore >= tau) {
          P.add(this.pairKey(m.requirementId, m.nodeId));
          linkedReqs.add(m.requirementId);
        }
      }

      const { tp, fp, fn, tn } = this.computeConfusion(
        fullG,
        P,
        totalRequirements,
        codeElementCount
      );
      const m: MetricsAtThreshold = {
        threshold: tau,
        tp,
        fp,
        fn,
        tn,
        precision: Math.round(this.precision(tp, fp) * 10000) / 10000,
        recall: Math.round(this.recall(tp, fn) * 10000) / 10000,
        f1: Math.round(this.f1(tp, fp, fn) * 10000) / 10000,
        coverage: Math.round(this.coverage(linkedReqs.size, totalRequirements) * 10000) / 10000,
        totalRequirements,
        linkedRequirements: linkedReqs.size,
        predictedLinksCount: P.size,
        groundTruthLinksCount: fullG.size,
      };
      atThreshold[String(tau)] = m;
      if (
        optimalF1 === null ||
        (m.groundTruthLinksCount > 0 && m.f1 > optimalF1)
      ) {
        optimalF1 = m.f1;
        optimalThreshold = tau;
      }
    }

    return {
      projectId,
      thresholds: normalizedThresholds,
      atThreshold,
      optimalThreshold,
      optimalF1,
      summary: {
        totalRequirements,
        totalCodeElements: codeElementCount,
        groundTruthLinksCount,
        requirementsWithGroundTruth,
      },
    };
  }

  /** Seeded RNG for deterministic shuffle (mulberry32) */
  private seededRandom(seed: number): () => number {
    return () => {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Split ground truth **trace links** (requirementId, nodeId) into validation (70%) and test (30%).
   * Uses fixed seed (42) for reproducible, deterministic split. Validation and test are disjoint.
   * Threshold tuning uses validation only; final evaluation uses test only.
   */
  async splitGroundTruth(projectId: string): Promise<{
    validation: Set<string>;
    test: Set<string>;
  }> {
    const rows = await this.prisma.requirementGroundTruth.findMany({
      where: { projectId },
      select: { requirementId: true, nodeId: true },
    });
    const keys = rows.map((r) => this.pairKey(r.requirementId, r.nodeId));
    if (keys.length === 0) {
      return { validation: new Set(), test: new Set() };
    }

    const seed = 42;
    const rng = this.seededRandom(seed);
    const shuffled = [...keys];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const splitIdx = Math.ceil(shuffled.length * 0.7);
    const validation = new Set<string>(shuffled.slice(0, splitIdx));
    const test = new Set<string>(shuffled.slice(splitIdx));

    for (const k of validation) {
      if (test.has(k)) {
        throw new Error(`Data leakage: validation and test sets overlap (key ${k}). Split must be disjoint.`);
      }
    }
    this.logger.debug(`Split GT: ${validation.size} validation, ${test.size} test (disjoint)`);
    return { validation, test };
  }

  /**
   * Run threshold tuning for one matcher: sweep τ on validation only, select τ* (argmax validation F1),
   * then evaluate once on test at τ*. Persist validation run at τ* and test run at τ*. No reuse of
   * thresholds across matchers.
   */
  async runThresholdTuning(
    projectId: string,
    matcherType: MatcherType
  ): Promise<{ optimalThreshold: number; validationF1: number; testRun: MetricsAtThreshold }> {
    const { validation, test } = await this.splitGroundTruth(projectId);
    if (validation.size === 0 && test.size === 0) {
      throw new Error('No ground truth links for project');
    }

    for (const k of validation) {
      if (test.has(k)) {
        throw new Error(`Data leakage: validation and test must be disjoint (overlap key: ${k})`);
      }
    }

    const thresholds = this.DEFAULT_THRESHOLD_GRID;
    let optimalTau = 0.5;
    let bestValidationF1 = -1;
    let validationMetricsAtTauStar: MetricsAtThreshold | null = null;

    if (validation.size > 0) {
      for (const tau of thresholds) {
        const m = await this.getMetricsAtThreshold(projectId, tau, matcherType, {
          groundTruthSubset: validation,
        });
        if (m.f1 > bestValidationF1) {
          bestValidationF1 = m.f1;
          optimalTau = tau;
          validationMetricsAtTauStar = m;
        }
      }
    }

    const testMetrics = await this.getMetricsAtThreshold(
      projectId,
      optimalTau,
      matcherType,
      { groundTruthSubset: test }
    );

    if (validationMetricsAtTauStar) {
      await this.prisma.evaluationRun.create({
        data: {
          projectId,
          matcherType,
          threshold: optimalTau,
          tp: validationMetricsAtTauStar.tp,
          fp: validationMetricsAtTauStar.fp,
          fn: validationMetricsAtTauStar.fn,
          precision: validationMetricsAtTauStar.precision,
          recall: validationMetricsAtTauStar.recall,
          f1: validationMetricsAtTauStar.f1,
          coverage: validationMetricsAtTauStar.coverage,
          datasetType: 'validation',
        },
      });
    }

    await this.prisma.evaluationRun.create({
      data: {
        projectId,
        matcherType,
        threshold: optimalTau,
        tp: testMetrics.tp,
        fp: testMetrics.fp,
        fn: testMetrics.fn,
        precision: testMetrics.precision,
        recall: testMetrics.recall,
        f1: testMetrics.f1,
        coverage: testMetrics.coverage,
        datasetType: 'test',
      },
    });

    const testF1 = testMetrics.f1;
    if (testF1 > 0.95) {
      this.logger.warn(
        `Unusually high F1 detected (${(testF1 * 100).toFixed(1)}%) for ${matcherType}. Verify dataset density and leakage.`
      );
    }

    this.logger.log(
      `[${matcherType}] τ*=${optimalTau} | Validation F1=${(bestValidationF1 * 100).toFixed(2)}% | Test F1=${(testF1 * 100).toFixed(2)}% | ` +
        `Validation links=${validation.size} Test links=${test.size} | Test TP=${testMetrics.tp} FP=${testMetrics.fp} FN=${testMetrics.fn}`
    );

    return {
      optimalThreshold: optimalTau,
      validationF1: bestValidationF1,
      testRun: testMetrics,
    };
  }

  /**
   * Run threshold tuning for all matchers independently and return diagnostic table.
   * Use to confirm: each matcher has its own τ*, test F1 < validation F1 (slightly), no leakage.
   */
  async runAllMatchersTuning(projectId: string): Promise<
    Array<{
      matcherType: MatcherType;
      tauStar: number;
      validationF1: number;
      testF1: number;
      tp: number;
      fp: number;
      fn: number;
      nValidation: number;
      nTest: number;
    }>
  > {
    const { validation, test } = await this.splitGroundTruth(projectId);
    if (validation.size === 0 && test.size === 0) {
      throw new Error('No ground truth links for project');
    }
    const matcherTypes: MatcherType[] = ['tfidf', 'embedding', 'structural-only', 'hybrid'];
    const rows: Array<{
      matcherType: MatcherType;
      tauStar: number;
      validationF1: number;
      testF1: number;
      tp: number;
      fp: number;
      fn: number;
      nValidation: number;
      nTest: number;
    }> = [];

    for (const mt of matcherTypes) {
      const out = await this.runThresholdTuning(projectId, mt);
      rows.push({
        matcherType: mt,
        tauStar: out.optimalThreshold,
        validationF1: out.validationF1,
        testF1: out.testRun.f1,
        tp: out.testRun.tp,
        fp: out.testRun.fp,
        fn: out.testRun.fn,
        nValidation: validation.size,
        nTest: test.size,
      });
    }

    this.logger.log(
      'Diagnostic table: Matcher | τ* | Validation F1 | Test F1 | TP | FP | FN | nVal | nTest'
    );
    for (const r of rows) {
      this.logger.log(
        `${r.matcherType} | ${r.tauStar} | ${(r.validationF1 * 100).toFixed(2)}% | ${(r.testF1 * 100).toFixed(2)}% | ${r.tp} | ${r.fp} | ${r.fn} | ${r.nValidation} | ${r.nTest}`
      );
    }
    return rows;
  }

  /**
   * Aggregate metrics for all projects, all matchers, and multiple thresholds.
   * Useful for exporting a master evaluation table for all projects in one go.
   */
  async getAllProjectsMetrics(
    thresholds: number[] = this.DEFAULT_THRESHOLD_GRID
  ): Promise<ProjectMetricsRow[]> {
    const projects = await this.prisma.project.findMany({
      select: { id: true, name: true },
    });

    const matcherTypes: MatcherType[] = ['tfidf', 'embedding', 'structural-only', 'hybrid'];
    const allRows: ProjectMetricsRow[] = [];

    for (const project of projects) {
      this.logger.log(`Aggregating metrics for project ${project.name} (${project.id})`);
      for (const matcherType of matcherTypes) {
        try {
          const metrics = await this.getMetrics(project.id, thresholds, matcherType);
          
          for (const tau of metrics.thresholds) {
            const m = metrics.atThreshold[String(tau)];
            if (!m) continue;

            allRows.push({
              projectId: project.id,
              projectName: project.name,
              matcherType,
              threshold: tau,
              precision: m.precision,
              recall: m.recall,
              f1: m.f1,
              coverage: m.coverage,
              tp: m.tp,
              fp: m.fp,
              fn: m.fn,
              totalRequirements: m.totalRequirements,
              groundTruthLinks: m.groundTruthLinksCount,
            });
          }
        } catch (error) {
          this.logger.error(
            `Failed to get metrics for project ${project.id}, matcher ${matcherType}:`,
            error
          );
          // Continue with other projects/matchers
        }
      }
    }

    return allRows;
  }

  /**
   * Get baseline comparison. Prefer stored test run (EvaluationRun) per matcher when present.
   * When a matcher has no tuned test run, use live metrics at default τ=0.5 so Compare shows
   * real numbers after "Match all baselines" without requiring Tune per matcher.
   */
  async getCompare(projectId: string): Promise<
    Array<{
      matcherType: MatcherType;
      precision: number;
      recall: number;
      f1: number;
      coverage: number;
      threshold: number | null;
      tp?: number;
      fp?: number;
      fn?: number;
      fromTune?: boolean;
    }>
  > {
    const matcherTypes: MatcherType[] = ['tfidf', 'embedding', 'structural-only', 'hybrid'];
    const runs = await this.prisma.evaluationRun.findMany({
      where: { projectId, datasetType: 'test' },
      orderBy: { createdAt: 'desc' },
    });

    const result: Array<{
      matcherType: MatcherType;
      precision: number;
      recall: number;
      f1: number;
      coverage: number;
      threshold: number | null;
      tp?: number;
      fp?: number;
      fn?: number;
      fromTune?: boolean;
    }> = [];

    for (const mt of matcherTypes) {
      const defaultTau = this.getDefaultThresholdForMatcher(mt);
      const latest = runs.find((r) => r.matcherType === mt);
      if (latest) {
        if (latest.f1 > 0.95) {
          this.logger.warn(
            `[getCompare] Unusually high F1 (${(latest.f1 * 100).toFixed(1)}%) for ${mt}. Verify dataset density and leakage.`
          );
        }
        result.push({
          matcherType: mt as MatcherType,
          precision: latest.precision,
          recall: latest.recall,
          f1: latest.f1,
          coverage: latest.coverage,
          threshold: latest.threshold,
          tp: latest.tp,
          fp: latest.fp,
          fn: latest.fn,
          fromTune: true,
        });
      } else {
        this.logger.debug(`[getCompare] No tuned test run for ${mt}; using live metrics at τ=${defaultTau}.`);
        const live = await this.getMetricsAtThreshold(projectId, defaultTau, mt);
        result.push({
          matcherType: mt,
          precision: live.precision,
          recall: live.recall,
          f1: live.f1,
          coverage: live.coverage,
          threshold: defaultTau,
          tp: live.tp,
          fp: live.fp,
          fn: live.fn,
          fromTune: false,
        });
      }
    }

    return result;
  }

  /**
   * Compare all baselines at a fixed threshold τ (e.g. 0.3). Uses full ground truth for each matcher.
   * Fetches shared data (GT, requirements, code count) once to avoid connection pool exhaustion.
   */
  async getCompareAtThreshold(
    projectId: string,
    threshold: number
  ): Promise<
    Array<{
      matcherType: MatcherType;
      precision: number;
      recall: number;
      f1: number;
      coverage: number;
      threshold: number;
      tp?: number;
      fp?: number;
      fn?: number;
    }>
  > {
    const matcherTypes: MatcherType[] = ['tfidf', 'embedding', 'structural-only', 'hybrid'];
    const [fullG, requirements, codeElementCount] = await Promise.all([
      this.getGroundTruthSet(projectId),
      this.prisma.requirement.findMany({
        where: { projectId },
        select: { id: true },
      }),
      this.getProjectCodeElementCount(projectId),
    ]);
    const totalRequirements = requirements.length;
    const result: Array<{
      matcherType: MatcherType;
      precision: number;
      recall: number;
      f1: number;
      coverage: number;
      threshold: number;
      tp?: number;
      fp?: number;
      fn?: number;
    }> = [];
    const requirementIds = requirements.map((r) => r.id);
    for (const mt of matcherTypes) {
      const { set: P, requirementIds: linkedReqs } = await this.getPredictedSet(
        projectId,
        threshold,
        mt,
        { requirementIds }
      );
      const { tp, fp, fn, tn } = this.computeConfusion(
        fullG,
        P,
        totalRequirements,
        codeElementCount
      );
      const m = {
        threshold,
        tp,
        fp,
        fn,
        tn,
        precision: Math.round(this.precision(tp, fp) * 10000) / 10000,
        recall: Math.round(this.recall(tp, fn) * 10000) / 10000,
        f1: Math.round(this.f1(tp, fp, fn) * 10000) / 10000,
        coverage: Math.round(this.coverage(linkedReqs.size, totalRequirements) * 10000) / 10000,
        totalRequirements,
        linkedRequirements: linkedReqs.size,
        predictedLinksCount: P.size,
        groundTruthLinksCount: fullG.size,
      };
      result.push({
        matcherType: mt,
        precision: m.precision,
        recall: m.recall,
        f1: m.f1,
        coverage: m.coverage,
        threshold,
        tp: m.tp,
        fp: m.fp,
        fn: m.fn,
      });
    }
    return result;
  }

  /**
   * Side-by-side comparison of all matcher types for a given repository.
   * Uses latest TraceabilityExperimentResult per matcherType for that repo (experiment runs only).
   */
  async getCompareForRepo(repoId: string): Promise<
    Array<{
      matcherType: string;
      threshold: number;
      precision: number;
      recall: number;
      f1: number;
      coverage: number;
      tp: number;
      fp: number;
      fn: number;
    }>
  > {
    const runs = await this.prisma.traceabilityExperimentResult.findMany({
      where: { repositoryId: repoId },
      orderBy: { createdAt: 'desc' },
    });
    const byMatcher = new Map<string, (typeof runs)[0]>();
    for (const r of runs) {
      if (!byMatcher.has(r.matcherType)) byMatcher.set(r.matcherType, r);
    }
    const matcherOrder: MatcherType[] = ['tfidf', 'embedding', 'structural-only', 'hybrid'];
    const result: Array<{
      matcherType: string;
      threshold: number;
      precision: number;
      recall: number;
      f1: number;
      coverage: number;
      tp: number;
      fp: number;
      fn: number;
    }> = [];
    for (const mt of matcherOrder) {
      const row = byMatcher.get(mt);
      if (row) {
        result.push({
          matcherType: row.matcherType,
          threshold: row.threshold,
          precision: row.precision,
          recall: row.recall,
          f1: row.f1,
          coverage: row.coverage,
          tp: row.tp,
          fp: row.fp,
          fn: row.fn,
        });
      }
    }
    return result;
  }

  private pairKey(requirementId: string, nodeId: string): string {
    return `${requirementId}::${nodeId}`;
  }

  private clampThreshold(threshold: number): number {
    if (!Number.isFinite(threshold)) return 0;
    return Math.max(0, Math.min(1, threshold));
  }

  private getDefaultThresholdForMatcher(matcherType: MatcherType): number {
    // Dense matchers usually need lower default tau than lexical/structural.
    if (matcherType === 'embedding' || matcherType === 'hybrid') return 0.3;
    return 0.5;
  }

  /** Code elements = nodes in the project's code scope (same Repo ids as matchers use). */
  private async getProjectCodeElementCount(projectId: string): Promise<number> {
    const repoIds = await getProjectCodeScopeRepoIds(this.prisma, projectId);
    if (repoIds.length === 0) return 0;
    return this.prisma.node.count({
      where: { repoId: { in: repoIds } },
    });
  }

  // --- Ground truth CRUD ---

  async addGroundTruth(
    projectId: string,
    requirementId: string,
    nodeId: string,
    options?: { source?: string; notes?: string }
  ) {
    const requirement = await this.prisma.withRetry(() => this.prisma.requirement.findFirst({
      where: { id: requirementId, projectId },
    }));
    if (!requirement) {
      throw new Error('Requirement not found or does not belong to project');
    }
    const node = await this.prisma.withRetry(() => this.prisma.node.findUnique({
      where: { id: nodeId },
    }));
    if (!node) {
      throw new Error('Node not found');
    }

    return this.prisma.withRetry(() => this.prisma.requirementGroundTruth.upsert({
      where: {
        requirementId_nodeId: { requirementId, nodeId },
      },
      create: {
        projectId,
        requirementId,
        nodeId,
        source: options?.source ?? 'manual',
        notes: options?.notes ?? null,
      },
      update: {
        source: options?.source ?? undefined,
        notes: options?.notes ?? undefined,
      },
    }));
  }

  async removeGroundTruth(requirementId: string, nodeId: string) {
    this.logger.log(`Removing ground truth link: req=${requirementId}, node=${nodeId}`);
    return this.prisma.withRetry(() => this.prisma.requirementGroundTruth.deleteMany({
      where: { requirementId, nodeId },
    }));
  }

  async listGroundTruth(projectId: string) {
    return this.prisma.withRetry(() => this.prisma.requirementGroundTruth.findMany({
      where: { projectId },
      include: {
        requirement: { select: { id: true, title: true, projectId: true } },
        node: {
          select: {
            id: true,
            nodePath: true,
            filePath: true,
            nodeType: true,
            repoId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }));
  }

  /**
   * Ground truth set restricted to nodes in a given repo (for per-repo metrics).
   */
  async getGroundTruthSetForRepo(projectId: string, repoId: string): Promise<Set<string>> {
    const rows = await this.prisma.requirementGroundTruth.findMany({
      where: { projectId },
      select: { requirementId: true, nodeId: true, node: { select: { repoId: true } } },
    });
    const set = new Set<string>();
    for (const r of rows) {
      if (r.node?.repoId === repoId) {
        set.add(this.pairKey(r.requirementId, r.nodeId));
      }
    }
    return set;
  }

  /**
   * Predicted set restricted to nodes in a given repo.
   */
  async getPredictedSetForRepo(
    projectId: string,
    repoId: string,
    threshold: number,
    matcherType: MatcherType
  ): Promise<{ set: Set<string>; requirementIds: Set<string> }> {
    const requirements = await this.prisma.requirement.findMany({
      where: { projectId },
      select: { id: true },
    });
    const reqIds = new Set(requirements.map((r) => r.id));
    if (reqIds.size === 0) return { set: new Set(), requirementIds: new Set() };

    const nodeIdsInRepo = await this.prisma.node.findMany({
      where: { repoId },
      select: { id: true },
    });
    const nodeIdSet = new Set(nodeIdsInRepo.map((n) => n.id));

    const matches = await this.prisma.requirementMatch.findMany({
      where: {
        requirementId: { in: Array.from(reqIds) },
        nodeId: { in: Array.from(nodeIdSet) },
        matchScore: { gte: threshold },
        matcherType,
      },
      select: { requirementId: true, nodeId: true },
    });

    const set = new Set<string>();
    const linkedReqs = new Set<string>();
    for (const m of matches) {
      set.add(this.pairKey(m.requirementId, m.nodeId));
      linkedReqs.add(m.requirementId);
    }
    return { set, requirementIds: linkedReqs };
  }

  /**
   * Metrics at threshold for a single repository (for ablation / paired t-test).
   */
  async getMetricsAtThresholdForRepo(
    projectId: string,
    repoId: string,
    threshold: number,
    matcherType: MatcherType
  ): Promise<MetricsAtThreshold> {
    const [G, requirements, nodeCount] = await Promise.all([
      this.getGroundTruthSetForRepo(projectId, repoId),
      this.prisma.requirement.findMany({ where: { projectId }, select: { id: true } }),
      this.prisma.node.count({ where: { repoId } }),
    ]);

    const totalRequirements = requirements.length;
    const reqIds = new Set(requirements.map((r) => r.id));
    const { set: P, requirementIds: linkedReqs } = await this.getPredictedSetForRepo(
      projectId,
      repoId,
      threshold,
      matcherType
    );

    const { tp, fp, fn, tn } = this.computeConfusion(G, P, totalRequirements, nodeCount);
    const precisionVal = this.precision(tp, fp);
    const recallVal = this.recall(tp, fn);
    const f1Val = this.f1(tp, fp, fn);
    const coverageVal = this.coverage(linkedReqs.size, totalRequirements);

    return {
      threshold,
      tp,
      fp,
      fn,
      tn,
      precision: Math.round(precisionVal * 10000) / 10000,
      recall: Math.round(recallVal * 10000) / 10000,
      f1: Math.round(f1Val * 10000) / 10000,
      coverage: Math.round(coverageVal * 10000) / 10000,
      totalRequirements,
      linkedRequirements: linkedReqs.size,
      predictedLinksCount: P.size,
      groundTruthLinksCount: G.size,
    };
  }

  /**
   * Persist one experiment run to TraceabilityExperimentResult.
   */
  async persistExperimentResult(
    projectId: string,
    matcherType: string,
    threshold: number,
    metrics: MetricsAtThreshold,
    options: { repositoryId?: string | null; useGraphPropagation?: boolean; useSymbolMatching?: boolean }
  ) {
    return this.prisma.traceabilityExperimentResult.create({
      data: {
        projectId,
        repositoryId: options.repositoryId ?? null,
        matcherType,
        threshold,
        tp: metrics.tp,
        fp: metrics.fp,
        fn: metrics.fn,
        precision: metrics.precision,
        recall: metrics.recall,
        f1: metrics.f1,
        coverage: metrics.coverage,
        useGraphProp: options.useGraphPropagation ?? null,
        useSymbolMatch: options.useSymbolMatching ?? null,
      },
    });
  }

  /**
   * Run one experiment config: run matching, compute metrics, persist.
   */
  async runExperimentConfig(
    projectId: string,
    config: TraceabilityExperimentConfig
  ): Promise<{ projectMetrics: MetricsAtThreshold; persisted: unknown }> {
    this.logger.log(`Running experiment config for project ${projectId}: ${config.matcherType} @ τ=${config.threshold}`);

    await this.requirementsService.matchAllRequirements(projectId, config.matcherType, {
      useGraphPropagation: config.useGraphPropagation,
      useSymbolMatching: config.useSymbolMatching,
    });

    const projectMetrics = await this.getMetricsAtThreshold(
      projectId,
      config.threshold,
      config.matcherType
    );

    const persisted = await this.persistExperimentResult(
      projectId,
      config.matcherType,
      config.threshold,
      projectMetrics,
      {
        useGraphPropagation: config.useGraphPropagation,
        useSymbolMatching: config.useSymbolMatching,
      }
    );

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { repositories: true },
    });
    if (project?.repositories?.length) {
      const urls = project.repositories.map((r) => r.url).filter((u): u is string => u != null);
      const repos = await this.prisma.repo.findMany({
        where: { url: { in: urls } },
        select: { id: true },
      });
      for (const repo of repos) {
        const repoMetrics = await this.getMetricsAtThresholdForRepo(
          projectId,
          repo.id,
          config.threshold,
          config.matcherType
        );
        await this.persistExperimentResult(
          projectId,
          config.matcherType,
          config.threshold,
          repoMetrics,
          {
            repositoryId: repo.id,
            useGraphPropagation: config.useGraphPropagation,
            useSymbolMatching: config.useSymbolMatching,
          }
        );
      }
    }

    return { projectMetrics, persisted };
  }

  /**
   * List experiment runs for plotting: project-level only, unified shape.
   * Returns both TraceabilityExperimentResult and EvaluationRun (test) runs, sorted by createdAt.
   */
  async listExperimentRuns(projectId?: string): Promise<
    Array<{
      id: string;
      projectId: string;
      runAt: string;
      matcherType: string;
      threshold: number;
      precision: number;
      recall: number;
      f1: number;
      coverage: number;
      source: 'experiment' | 'tune';
    }>
  > {
    const runs: Array<{
      id: string;
      projectId: string;
      runAt: string;
      matcherType: string;
      threshold: number;
      precision: number;
      recall: number;
      f1: number;
      coverage: number;
      source: 'experiment' | 'tune';
    }> = [];

    const expWhere = projectId ? { projectId, repositoryId: null } : { repositoryId: null };
    const expRuns = await this.prisma.traceabilityExperimentResult.findMany({
      where: expWhere,
      orderBy: { createdAt: 'asc' },
    });
    expRuns.forEach((r) => {
      runs.push({
        id: r.id,
        projectId: r.projectId,
        runAt: r.createdAt.toISOString(),
        matcherType: r.matcherType,
        threshold: r.threshold,
        precision: r.precision,
        recall: r.recall,
        f1: r.f1,
        coverage: r.coverage,
        source: 'experiment',
      });
    });

    const evalWhere = projectId ? { projectId, datasetType: 'test' } : { datasetType: 'test' };
    const evalRuns = await this.prisma.evaluationRun.findMany({
      where: evalWhere,
      orderBy: { createdAt: 'asc' },
    });
    evalRuns.forEach((r) => {
      runs.push({
        id: r.id,
        projectId: r.projectId,
        runAt: r.createdAt.toISOString(),
        matcherType: r.matcherType,
        threshold: r.threshold,
        precision: r.precision,
        recall: r.recall,
        f1: r.f1,
        coverage: r.coverage,
        source: 'tune',
      });
    });

    runs.sort((a, b) => a.runAt.localeCompare(b.runAt));
    return runs;
  }

  /**
   * Compare two methods for a repository (for paired t-test input).
   */
  async compareExperiments(
    repoId: string,
    methodA: MatcherType,
    methodB: MatcherType
  ): Promise<{ repoId: string; f1A: number; f1B: number; delta: number }> {
    const results = await this.prisma.traceabilityExperimentResult.findMany({
      where: { repositoryId: repoId, matcherType: { in: [methodA, methodB] } },
      orderBy: { createdAt: 'desc' },
    });

    const latestA = results.find((r) => r.matcherType === methodA);
    const latestB = results.find((r) => r.matcherType === methodB);

    const f1A = latestA?.f1 ?? 0;
    const f1B = latestB?.f1 ?? 0;
    return {
      repoId,
      f1A,
      f1B,
      delta: f1A - f1B,
    };
  }

  /**
   * Bulk add ground truth links (e.g. from UI table).
   * Optimized to batch existence checks and use createMany.
   */
  async bulkAddGroundTruth(
    projectId: string,
    links: Array<{ requirementId: string; nodeId: string; source?: string; notes?: string }>
  ) {
    if (links.length === 0) return { added: 0, failed: 0, results: [] };

    // 1. Batch validate requirement existence and project ownership
    const reqIds = Array.from(new Set(links.map(l => l.requirementId)));
    const validRequirements = await this.prisma.withRetry(() => this.prisma.requirement.findMany({
      where: { id: { in: reqIds }, projectId },
      select: { id: true },
    }));
    const validReqIdSet = new Set(validRequirements.map(r => r.id));

    // 2. Batch validate node existence
    const nodeIds = Array.from(new Set(links.map(l => l.nodeId)));
    const validNodes = await this.prisma.withRetry(() => this.prisma.node.findMany({
      where: { id: { in: nodeIds } },
      select: { id: true },
    }));
    const validNodeIdSet = new Set(validNodes.map(n => n.id));

    const toCreate = [];
    const results = [];

    for (const link of links) {
      if (!validReqIdSet.has(link.requirementId)) {
        results.push({ ...link, ok: false, error: 'Requirement not found or project mismatch' });
        continue;
      }
      if (!validNodeIdSet.has(link.nodeId)) {
        results.push({ ...link, ok: false, error: 'Node not found' });
        continue;
      }

      toCreate.push({
        projectId,
        requirementId: link.requirementId,
        nodeId: link.nodeId,
        source: link.source ?? 'manual',
        notes: link.notes ?? null,
      });
      results.push({ ...link, ok: true });
    }

    if (toCreate.length > 0) {
      // Use createMany with skipDuplicates: true (PostgreSQL support)
      await this.prisma.withRetry(() => this.prisma.requirementGroundTruth.createMany({
        data: toCreate,
        skipDuplicates: true,
      }));
    }

    return { 
      added: toCreate.length, 
      failed: links.length - toCreate.length, 
      results 
    };
  }
}
