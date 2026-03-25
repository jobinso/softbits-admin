import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Settings, LogOut, Sun, Moon, HelpCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useQueryClient } from '@tanstack/react-query';
import HelpModal from '@/components/help/help-modal';

function formatDate(): string {
  return new Date().toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getUserInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export default function Header() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  // Keyboard shortcuts: ? and F1 to open help
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F1 always opens help
      if (e.key === 'F1') {
        e.preventDefault();
        openHelp();
        return;
      }
      // ? opens help only when not focused on an input/textarea/select
      if (e.key === '?' && !helpOpen) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if ((e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        openHelp();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [helpOpen, openHelp]);

  return (
    <header className="h-14 bg-surface-raised border-b border-border px-6 flex items-center justify-between shrink-0">
      {/* Left: Date */}
      <div className="flex items-center gap-4">
        <span className="text-xs text-semantic-text-subtle">{formatDate()}</span>
      </div>

      {/* Right: Actions + User */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleRefresh}
          title="Refresh data"
          className="p-2 rounded-lg text-semantic-text-subtle hover:text-semantic-text-default hover:bg-interactive-hover transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          onClick={openHelp}
          title="Help (? or F1)"
          className="p-2 rounded-lg text-semantic-text-subtle hover:text-semantic-text-default hover:bg-interactive-hover transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        <button
          title="Settings"
          className="p-2 rounded-lg text-semantic-text-subtle hover:text-semantic-text-default hover:bg-interactive-hover transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 rounded-lg text-semantic-text-subtle hover:text-semantic-text-default hover:bg-interactive-hover transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="h-6 w-px bg-border-default mx-1" />

        {user && (
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00d4aa] to-[#00b894] flex items-center justify-center text-[#111827] text-xs font-semibold shrink-0">
              {getUserInitials(user.FullName || user.UserName)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-semantic-text-default leading-tight truncate">
                {user.UserName}
              </p>
              {user.FullName && (
                <p className="text-[10px] text-semantic-text-subtle leading-tight truncate">{user.FullName}</p>
              )}
            </div>
          </div>
        )}

        <button
          onClick={logout}
          title="Sign out"
          className="p-2 rounded-lg text-semantic-text-subtle hover:text-danger hover:bg-interactive-hover transition-colors ml-1"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      <HelpModal open={helpOpen} onClose={closeHelp} currentPath={location.pathname} />
    </header>
  );
}
