import React, { useEffect, useState } from 'react';
import { useRepolensApi } from '../utils/api';
import { Folder, Play, Loader2 } from 'lucide-react';

interface LocalRepoListProps {
  onSelect: (repo: { name: string; path: string }) => void;
}

export const LocalRepoList: React.FC<LocalRepoListProps> = ({ onSelect }) => {
  const { getLocalCodebases } = useRepolensApi();
  const [codebases, setCodebases] = useState<Array<{ name: string; path: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCodebases = async () => {
      try {
        const data = await getLocalCodebases();
        setCodebases(data);
      } catch (err) {
        console.error('Failed to fetch local codebases:', err);
        setError('Could not load local codebases');
      } finally {
        setLoading(false);
      }
    };
    fetchCodebases();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-3">
        <Loader2 className="w-4 h-4 animate-spin text-blue-500 mr-2" />
        <span className="text-xs text-gray-400">Loading codebases...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-400 p-2">
        {error}
      </div>
    );
  }

  if (codebases.length === 0) {
    return (
      <div className="text-xs text-gray-500 italic p-2 text-center">
        No folders found in codebases/
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
      {codebases.map((repo) => (
        <button
          key={repo.path}
          type="button"
          onClick={() => onSelect(repo)}
          className="flex items-center justify-between p-2 rounded-lg border border-border bg-background hover:bg-accent hover:border-primary/50 transition-all group"
        >
          <div className="flex items-center min-w-0">
            <Folder className="w-3.5 h-3.5 text-primary mr-2 flex-shrink-0" />
            <span className="text-xs font-medium truncate">{repo.name}</span>
          </div>
          <Play className="w-2.5 h-2.5 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>
      ))}
    </div>
  );
};
