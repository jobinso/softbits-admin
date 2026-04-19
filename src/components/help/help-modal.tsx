/**
 * HelpModal Component
 * Contextual help system with searchable topics for AdminIT
 */

import { useState, useEffect } from 'react';
import { HelpCircle, X, Loader2 } from 'lucide-react';
import { helpTopics, builtInHelpContent, markdownToHtml, routeToTopic } from './help-content';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
  currentPath?: string;
}

export default function HelpModal({ open, onClose, currentPath }: HelpModalProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTopic, setActiveTopic] = useState('admin-overview');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open) {
      // Resolve the initial topic from the current route
      const topicFromRoute = currentPath ? routeToTopic[currentPath] : undefined;
      setActiveTopic(topicFromRoute && helpTopics[topicFromRoute] ? topicFromRoute : 'admin-overview');
      setSearchQuery('');
    }
  }, [open, currentPath]);

  useEffect(() => {
    if (open && activeTopic) {
      loadHelpContent(activeTopic);
    }
  }, [open, activeTopic]);

  // Keyboard shortcut to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const loadHelpContent = async (topicId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/help/${topicId}`);
      if (response.ok) {
        const data = await response.json();
        setContent(data.html);
      } else {
        throw new Error('Not found');
      }
    } catch {
      // Use built-in help content as fallback
      const helpData = builtInHelpContent[topicId] || builtInHelpContent['admin-overview'];
      if (helpData) {
        setContent(markdownToHtml(helpData.content));
      } else {
        setContent('<p>Help content is not available for this topic.</p>');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredTopics = Object.entries(helpTopics).filter(([key, value]) =>
    searchQuery === '' ||
    value.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-raised border border-border rounded-xl shadow-2xl flex flex-col max-w-[900px] w-[90vw] max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-[18px] h-[18px] text-primary" />
            <h3 className="text-base font-semibold text-semantic-text-default">Help Center</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-semantic-text-subtle hover:text-semantic-text-default hover:bg-interactive-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-[200px] border-r border-border flex flex-col shrink-0">
            <div className="p-3">
              <input
                className="w-full px-3 py-2 text-xs bg-surface-overlay border border-border rounded-lg text-semantic-text-default placeholder:text-semantic-text-faint focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring"
                placeholder="Search help..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-auto px-2 pb-2">
              {filteredTopics.map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setActiveTopic(key)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all mb-0.5 ${
                    activeTopic === key
                      ? 'bg-accent-primary-subtle text-primary'
                      : 'text-semantic-text-subtle hover:text-semantic-text-default hover:bg-interactive-hover'
                  }`}
                >
                  {value.title}
                </button>
              ))}
            </div>
          </div>

          {/* Help Content */}
          <div className="flex-1 overflow-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-semantic-text-faint">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <div
                className="help-content text-[13px] leading-[1.7] text-semantic-text-secondary"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <span className="text-[11px] text-semantic-text-faint">
            Press ? or F1 anytime to open help
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium text-semantic-text-on-primary bg-primary hover:bg-primary/90 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Help Content Styles */}
      <style>{`
        .help-content h1 { font-size: 22px; font-weight: 700; margin-bottom: 16px; color: var(--text-default); }
        .help-content h2 { font-size: 18px; font-weight: 600; margin: 24px 0 12px; color: var(--text-default); border-bottom: 1px solid var(--border-default); padding-bottom: 8px; }
        .help-content h3 { font-size: 15px; font-weight: 600; margin: 20px 0 10px; color: var(--text-secondary); }
        .help-content p { margin-bottom: 12px; }
        .help-content ul, .help-content ol { margin: 12px 0; padding-left: 24px; }
        .help-content li { margin-bottom: 6px; }
        .help-content code { background: var(--surface-overlay); padding: 2px 6px; border-radius: 4px; font-size: 12px; color: var(--accent-primary); }
        .help-content pre { background: var(--surface-overlay); padding: 16px; border-radius: 8px; overflow-x: auto; margin: 16px 0; border: 1px solid var(--border-default); }
        .help-content pre code { background: none; padding: 0; color: var(--text-default); }
        .help-content strong { color: var(--text-default); font-weight: 600; }
        .help-content em { color: var(--text-faint); }
        .help-content table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
        .help-content th { text-align: left; padding: 8px 12px; background: var(--surface-overlay); color: var(--text-default); font-weight: 600; border-bottom: 1px solid var(--border-default); }
        .help-content td { padding: 8px 12px; border-bottom: 1px solid var(--border-subtle); }
      `}</style>
    </div>
  );
}
