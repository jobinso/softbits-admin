import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Save, RotateCcw, FileCode, AlignLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, LoadingSpinner } from '@/components/shared';
import { getConfigFiles, getConfigFile, updateConfigFile } from '@/services/admin-service';
import type { ErpConfigFile, ApiError } from '@/types';
import JsonEditor from './json-editor';

// ===== Helpers =====

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeDate(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

// ===== Component =====

interface ErpConfigFileManagerProps {
  folder: string;
}

export default function ErpConfigFileManager({ folder }: ErpConfigFileManagerProps) {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const loadedContentRef = useRef<string>('');

  // Reset selection when folder changes
  useEffect(() => {
    setSelectedFile(null);
    setEditedContent('');
    setSearchTerm('');
    setJsonError(null);
    loadedContentRef.current = '';
  }, [folder]);

  // ===== Queries =====

  const { data: filesResponse, isLoading: filesLoading } = useQuery({
    queryKey: ['erp-config-files', folder],
    queryFn: () => getConfigFiles(folder),
  });

  const files: ErpConfigFile[] = filesResponse?.files ?? [];

  const { data: fileData, isLoading: fileLoading } = useQuery({
    queryKey: ['erp-config-file', folder, selectedFile],
    queryFn: async () => {
      const data = await getConfigFile(selectedFile!, folder);
      return data;
    },
    enabled: !!selectedFile,
  });

  // Sync loaded content when file data changes
  useEffect(() => {
    if (fileData?.content !== undefined) {
      loadedContentRef.current = fileData.content;
      setEditedContent(fileData.content);
      setJsonError(null);
    }
  }, [fileData?.content]);

  // ===== Mutation =====

  const saveMutation = useMutation({
    mutationFn: () => updateConfigFile(selectedFile!, editedContent, folder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['erp-config-files', folder] });
      queryClient.invalidateQueries({ queryKey: ['erp-config-file', folder, selectedFile] });
      toast.success('File saved successfully');
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error || 'Failed to save file');
    },
  });

  // ===== Derived state =====

  const isDirty = editedContent !== loadedContentRef.current;

  const filteredFiles = (files || []).filter((f) =>
    f.filename.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // ===== Handlers =====

  const handleContentChange = useCallback((value: string) => {
    setEditedContent(value);
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (e: unknown) {
      setJsonError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const handleSelectFile = useCallback(
    (filename: string) => {
      if (isDirty) {
        const confirmed = window.confirm('You have unsaved changes. Discard and switch files?');
        if (!confirmed) return;
      }
      setSelectedFile(filename);
      setJsonError(null);
    },
    [isDirty],
  );

  const handleReset = useCallback(() => {
    setEditedContent(loadedContentRef.current);
    setJsonError(null);
  }, []);

  const handleFormat = useCallback(() => {
    try {
      const formatted = JSON.stringify(JSON.parse(editedContent), null, 2);
      setEditedContent(formatted);
      setJsonError(null);
    } catch (e: unknown) {
      setJsonError(e instanceof Error ? e.message : String(e));
    }
  }, [editedContent]);

  const handleSave = useCallback(() => {
    saveMutation.mutate();
  }, [saveMutation]);

  // ===== Render =====

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)]">
      {/* Left panel: file list */}
      <div className="w-72 flex-shrink-0 flex flex-col bg-surface-raised border border-border rounded-xl overflow-hidden">
        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-semantic-text-faint" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-10 pr-3 py-2 bg-surface-overlay border border-border rounded-lg text-sm text-semantic-text-default placeholder:text-semantic-text-faint focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring"
            />
          </div>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {filesLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <p className="text-sm text-semantic-text-faint text-center py-8">No files found</p>
          ) : (
            <div className="p-2 space-y-1">
              {filteredFiles.map((file) => (
                <button
                  key={file.filename}
                  onClick={() => handleSelectFile(file.filename)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                    selectedFile === file.filename
                      ? 'bg-interactive-active border border-accent-primary'
                      : 'hover:bg-interactive-hover border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-semantic-text-faint flex-shrink-0" />
                    <span className="text-sm font-medium text-semantic-text-default truncate">
                      {file.filename}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 ml-6 text-xs text-semantic-text-faint">
                    <span>{formatFileSize(file.size)}</span>
                    <span>{formatRelativeDate(file.modified)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel: editor */}
      <div className="flex-1 flex flex-col bg-surface-raised border border-border rounded-xl overflow-hidden">
        {!selectedFile ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileCode className="w-12 h-12 text-semantic-text-faint mx-auto mb-3" />
              <p className="text-sm text-semantic-text-faint">Select a file to edit</p>
            </div>
          </div>
        ) : fileLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <FileCode className="w-4 h-4 text-semantic-text-faint" />
                <span className="text-sm font-medium text-semantic-text-default">{selectedFile}</span>
                <span className="text-xs text-semantic-text-faint">
                  {fileData ? formatFileSize(fileData.size ?? 0) : ''}
                </span>
                <span className="text-xs text-semantic-text-faint">
                  {fileData?.modified ? formatRelativeDate(fileData.modified) : ''}
                </span>
                {isDirty && (
                  <span className="text-xs text-warning font-medium">Modified</span>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<AlignLeft className="w-3.5 h-3.5" />}
                onClick={handleFormat}
              >
                Format
              </Button>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden">
              <JsonEditor
                value={editedContent}
                onChange={handleContentChange}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <div className="text-xs">
                {jsonError ? (
                  <span className="text-danger">JSON Error: {jsonError}</span>
                ) : (
                  <span className="text-success">Valid JSON</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  onClick={handleReset}
                  disabled={!isDirty}
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  icon={<Save className="w-3.5 h-3.5" />}
                  onClick={handleSave}
                  loading={saveMutation.isPending}
                  disabled={!isDirty || !!jsonError}
                >
                  Save
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
