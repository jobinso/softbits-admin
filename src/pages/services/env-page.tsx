import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CodeMirror from '@uiw/react-codemirror';
import toast from 'react-hot-toast';
import { AlertTriangle, Save, RotateCcw } from 'lucide-react';
import { Button, LoadingSpinner } from '@/components/shared';
import type { ApiError } from '@/types';
import { getEnvConfig, updateEnvConfig } from '@/services/admin-service';

export default function EnvPage() {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const { data: envData, isLoading } = useQuery({
    queryKey: ['admin', 'env'],
    queryFn: getEnvConfig,
  });

  useEffect(() => {
    if (envData?.content !== undefined) {
      setContent(envData.content);
      setIsDirty(false);
    }
  }, [envData?.content]);

  const saveMutation = useMutation({
    mutationFn: (body: { content: string }) => updateEnvConfig(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'env'] });
      setIsDirty(false);
      toast.success('Environment file updated. Restart services for changes to take effect.');
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error || 'Failed to save environment file');
    },
  });

  const handleChange = (value: string) => {
    setContent(value);
    setIsDirty(value !== (envData?.content ?? ''));
  };

  const handleSave = () => {
    if (!window.confirm('Saving will update the .env file. A backup will be created. Continue?')) return;
    saveMutation.mutate({ content });
  };

  const handleReset = () => {
    if (envData?.content !== undefined) {
      setContent(envData.content);
      setIsDirty(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Warning Banner */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
        <p className="text-sm text-yellow-400">
          Changes to environment variables require a service restart to take effect.
        </p>
      </div>

      {/* Editor */}
      <div className="bg-surface-raised border border-border rounded-xl overflow-hidden">
        <CodeMirror
          value={content}
          onChange={handleChange}
          height="500px"
          theme="dark"
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
          }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-semantic-text-faint">
          {isDirty ? 'Unsaved changes' : 'No changes'}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={handleReset}
            disabled={!isDirty}
          >
            Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Save className="w-3.5 h-3.5" />}
            onClick={handleSave}
            disabled={!isDirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
