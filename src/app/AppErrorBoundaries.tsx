import React from 'react';
import { ModalShell } from '../ui/ModalShell';

interface StageErrorBoundaryProps {
  children: React.ReactNode;
}

interface StageErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class StageErrorBoundary extends React.Component<StageErrorBoundaryProps, StageErrorBoundaryState> {
  constructor(props: StageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): StageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Stage render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#111114] text-[#a1a1aa] p-6 text-center select-none">
          <div className="text-sm font-semibold text-white mb-1.5">Stage Canvas Failed to Load</div>
          <div className="text-xs text-rose-400 mb-4 max-w-md">
            {this.state.error?.message || 'A runtime error occurred in the 3D viewport.'}
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="px-3.5 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-xs font-medium text-white transition cursor-pointer"
          >
            Retry Loading Stage
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface ModalErrorBoundaryProps {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

interface ModalErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ModalErrorBoundary extends React.Component<ModalErrorBoundaryProps, ModalErrorBoundaryState> {
  constructor(props: ModalErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ModalErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ModalShell
          backdropProps={{ className: 'fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4' }}
          surfaceProps={{ className: 'w-full max-w-sm rounded-2xl bg-[#121216] border border-red-500/30 p-5 space-y-3 text-center text-xs' }}
        >
          <div className="text-sm font-semibold text-white">Failed to load {this.props.title}</div>
          <p className="text-zinc-400 text-[11px]">
            {this.state.error?.message || 'A network error occurred while loading this dialog.'}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-white text-xs font-medium transition cursor-pointer"
          >
            Close
          </button>
        </ModalShell>
      );
    }
    return this.props.children;
  }
}

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Raylight Editor] Fatal App Error:', error, errorInfo);
  }

  handleDownloadBackup = () => {
    try {
      const saved = localStorage.getItem('raylight_project_backup') || localStorage.getItem('raylight_current_project');
      if (saved) {
        const blob = new Blob([saved], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `raylight-recovery-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert('No local project backup found.');
      }
    } catch {
      alert('Unable to export backup state.');
    }
  };

  handleResetProject = () => {
    try {
      localStorage.removeItem('raylight_project_backup');
      localStorage.removeItem('raylight_current_project');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0c0e12] text-[#a1a1aa] p-6 text-center select-none font-sans">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-400 font-bold text-lg">
            !
          </div>
          <h1 className="text-base font-semibold text-white mb-2">Raylight Editor Encountered an Unexpected Error</h1>
          <p className="text-xs text-rose-400/90 mb-6 max-w-lg font-mono bg-black/40 p-3 rounded-xl border border-rose-500/20 break-words">
            {this.state.error?.message || 'An unhandled application error occurred.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-medium">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition cursor-pointer shadow-lg shadow-sky-600/20"
            >
              Try Reloading Workspace
            </button>
            <button
              type="button"
              onClick={this.handleDownloadBackup}
              className="px-4 py-2 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-white transition cursor-pointer border border-white/10"
            >
              Export Recovery JSON
            </button>
            <button
              type="button"
              onClick={this.handleResetProject}
              className="px-4 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 transition cursor-pointer border border-rose-500/30"
            >
              Reset Session
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
