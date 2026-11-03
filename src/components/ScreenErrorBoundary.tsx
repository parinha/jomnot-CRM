'use client';

import { Warning } from '@phosphor-icons/react';
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  screenName?: string;
}

interface State {
  error: Error | null;
}

export default class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error(`[${this.props.screenName ?? 'Screen'}] crashed:`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
          <Warning className="w-10 h-10 text-amber-500" weight="duotone" aria-hidden />
          <h2 className="text-lg font-semibold text-ink">Something went wrong</h2>
          <p className="text-sm text-faint max-w-sm break-words">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 rounded-lg bg-yellow-400 text-ink text-sm font-semibold hover:bg-brand-hover active:bg-brand-dark transition"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
