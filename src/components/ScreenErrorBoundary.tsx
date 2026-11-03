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
          <div className="w-20 h-20 rounded-full bg-brand-soft flex items-center justify-center">
            <Warning className="w-10 h-10 text-brand-ink" weight="duotone" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold text-ink">Something went wrong</h2>
          <p className="text-sm text-muted max-w-sm break-words">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="h-11 px-6 rounded-full bg-brand text-on-brand text-sm font-semibold hover:bg-brand-hover active:bg-brand-dark transition shadow-brand"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
