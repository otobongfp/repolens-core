/**
 * Paired t-test for baseline comparison (research export only, not exposed to UI).
 * d_i = hybrid_i - baseline_i; tests whether mean difference is significantly different from zero.
 */

function mean(x: number[]): number {
  if (x.length === 0) return NaN;
  return x.reduce((a, b) => a + b, 0) / x.length;
}

function sampleStd(x: number[]): number {
  if (x.length < 2) return 0;
  const m = mean(x);
  const sq = x.reduce((acc, v) => acc + (v - m) ** 2, 0);
  return Math.sqrt(sq / (x.length - 1));
}

/** Approximate standard normal CDF (Abramowitz & Stegun) */
function normCdf(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.SQRT2;

  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  return 0.5 * (1.0 + sign * y);
}

/** Two-tailed p-value for t-distribution approximated by normal for df >= 30 */
function tTestTwoTailedPValue(t: number, df: number): number {
  if (df <= 0) return NaN;
  if (df >= 30) {
    return 2 * (1 - normCdf(Math.abs(t)));
  }
  const z = Math.abs(t);
  const z2 = z * z;
  const approx = z * (1 - 1 / (4 * df)) / Math.sqrt(1 + z2 / (2 * df));
  return 2 * (1 - normCdf(approx));
}

export interface PairedTTestResult {
  meanDifference: number;
  stdDifference: number;
  tStatistic: number;
  pValue: number;
  n: number;
  df: number;
}

/**
 * Compute paired t-test: hybridF1[i] vs baselineF1[i].
 * Returns mean difference (hybrid - baseline), std of differences, t-statistic, and two-tailed p-value.
 */
export function computePairedTTest(
  hybridF1: number[],
  baselineF1: number[]
): PairedTTestResult {
  const n = Math.min(hybridF1.length, baselineF1.length);
  if (n === 0) {
    return {
      meanDifference: NaN,
      stdDifference: NaN,
      tStatistic: NaN,
      pValue: NaN,
      n: 0,
      df: 0,
    };
  }

  const d: number[] = [];
  for (let i = 0; i < n; i++) {
    d.push(hybridF1[i] - baselineF1[i]);
  }

  const meanD = mean(d);
  const stdD = sampleStd(d);
  const df = n - 1;
  const se = stdD / Math.sqrt(n);
  const tStat = se === 0 ? 0 : meanD / se;
  const pValue = tTestTwoTailedPValue(tStat, df);

  return {
    meanDifference: Math.round(meanD * 10000) / 10000,
    stdDifference: Math.round(stdD * 10000) / 10000,
    tStatistic: Math.round(tStat * 10000) / 10000,
    pValue: Math.round(pValue * 10000) / 10000,
    n,
    df,
  };
}
