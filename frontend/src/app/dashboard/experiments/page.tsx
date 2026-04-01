'use client';

import { useState, useEffect } from 'react';
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
import { useRepolensApi, Project, ExperimentRun } from '../../utils/api';
import { FolderIcon, RefreshCwIcon } from '../../components/LucideIcons';
import toast from 'react-hot-toast';

const MATCHER_COLORS: Record<string, string> = {
  hybrid: '#3b82f6',
  'hybrid-no-graph': '#8b5cf6',
  'hybrid-no-symbol': '#06b6d4',
  embedding: '#10b981',
  tfidf: '#f59e0b',
  'structural-only': '#ef4444',
};

function getMatcherColor(matcherType: string): string {
  return MATCHER_COLORS[matcherType] ?? '#6b7280';
}

export default function ExperimentsPage() {
  const { getProjects, getExperimentRuns } = useRepolensApi();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [runs, setRuns] = useState<ExperimentRun[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProjects = async () => {
    try {
      const list = await getProjects();
      setProjects(list);
      if (list.length && !selectedProjectId) setSelectedProjectId(list[0].project_id);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load projects');
    }
  };

  const loadRuns = async () => {
    setLoading(true);
    try {
      const projectId = selectedProjectId || undefined;
      const data = await getExperimentRuns(projectId);
      setRuns(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load experiment runs');
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    loadRuns();
  }, [selectedProjectId]);

  const chartData = runs.map((r, i) => ({
    runIndex: i + 1,
    runAt: new Date(r.runAt).toLocaleString(),
    f1: Math.round(r.f1 * 100) / 100,
    precision: Math.round(r.precision * 100) / 100,
    recall: Math.round(r.recall * 100) / 100,
    coverage: Math.round(r.coverage * 100) / 100,
    matcherType: r.matcherType,
    threshold: r.threshold,
    source: r.source,
  }));

  const byMatcher = (() => {
    const map = new Map<string, { sum: number; count: number; last: ExperimentRun }>();
    runs.forEach((r) => {
      const cur = map.get(r.matcherType);
      if (!cur) {
        map.set(r.matcherType, { sum: r.f1, count: 1, last: r });
      } else {
        map.set(r.matcherType, {
          sum: cur.sum + r.f1,
          count: cur.count + 1,
          last: r,
        });
      }
    });
    return Array.from(map.entries()).map(([matcherType, { sum, count, last }]) => ({
      matcherType,
      avgF1: Math.round((sum / count) * 100) / 100,
      runs: count,
      lastF1: Math.round(last.f1 * 100) / 100,
    }));
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Experiment runs</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FolderIcon className="h-4 w-4 text-gray-400" />
            <select
              className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.project_id} value={p.project_id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => loadRuns()}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-2 text-sm text-white transition hover:bg-gray-600 disabled:opacity-50"
          >
            <RefreshCwIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-400">
        Runs come from &quot;Run experiment&quot; (Match Requirements → Metrics) and from threshold
        tuning. Select a project to filter, or show all.
      </p>

      {loading && runs.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 text-center text-gray-400">
          No experiment runs yet. Run experiments from Match Requirements → Metrics (run experiment
          or threshold tuning) to see data here.
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <h2 className="mb-4 text-lg font-semibold text-white">F1 / Precision / Recall over runs</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="runIndex"
                    type="number"
                    label={{ value: 'Run #', position: 'insideBottom', offset: -5 }}
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af' }}
                  />
                  <YAxis
                    domain={[0, 1]}
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af' }}
                    tickFormatter={(v) => (v as number).toFixed(2)}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#e5e7eb' }}
                    formatter={(value: number) => [value.toFixed(3), '']}
                    labelFormatter={(label, payload) =>
                      (payload?.[0]?.payload as { runAt?: string; runIndex?: number } | undefined)?.runAt ?? `Run #${label ?? ''}`
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="f1"
                    name="F1"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="precision"
                    name="Precision"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="recall"
                    name="Recall"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {byMatcher.length > 0 && (
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
              <h2 className="mb-4 text-lg font-semibold text-white">Average F1 by matcher</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byMatcher} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" domain={[0, 1]} stroke="#9ca3af" tick={{ fill: '#9ca3af' }} tickFormatter={(v) => (v as number).toFixed(2)} />
                    <YAxis type="category" dataKey="matcherType" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} width={90} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                      formatter={(value: number, _name: string, props: { payload?: { runs: number; lastF1: number } }) =>
                        [Number(value).toFixed(3), props.payload ? `Runs: ${props.payload.runs}, Last F1: ${props.payload.lastF1.toFixed(3)}` : 'Avg F1']
                      }
                    />
                    <Bar dataKey="avgF1" name="Avg F1" radius={[0, 4, 4, 0]}>
                      {byMatcher.map((entry, index) => (
                        <Cell key={entry.matcherType} fill={getMatcherColor(entry.matcherType)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-gray-700 bg-gray-800/50 overflow-hidden">
            <h2 className="border-b border-gray-700 p-4 text-lg font-semibold text-white">Run history</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-left text-gray-400">
                    <th className="p-3">#</th>
                    <th className="p-3">Time</th>
                    <th className="p-3">Matcher</th>
                    <th className="p-3">τ</th>
                    <th className="p-3">Precision</th>
                    <th className="p-3">Recall</th>
                    <th className="p-3">F1</th>
                    <th className="p-3">Coverage</th>
                    <th className="p-3">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r, i) => (
                    <tr key={r.id} className="border-b border-gray-700/50 text-gray-300">
                      <td className="p-3">{i + 1}</td>
                      <td className="p-3">{new Date(r.runAt).toLocaleString()}</td>
                      <td className="p-3">
                        <span
                          className="rounded px-2 py-0.5 text-xs"
                          style={{ backgroundColor: `${getMatcherColor(r.matcherType)}20`, color: getMatcherColor(r.matcherType) }}
                        >
                          {r.matcherType}
                        </span>
                      </td>
                      <td className="p-3">{r.threshold}</td>
                      <td className="p-3">{r.precision.toFixed(3)}</td>
                      <td className="p-3">{r.recall.toFixed(3)}</td>
                      <td className="p-3 font-medium">{r.f1.toFixed(3)}</td>
                      <td className="p-3">{r.coverage.toFixed(3)}</td>
                      <td className="p-3 text-gray-500">{r.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
