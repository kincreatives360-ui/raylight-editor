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
