import type { ReactNode } from 'react';
import type { ToolDef } from '../tools/types';

interface ToolPageProps {
  tool: ToolDef;
  onBack: () => void;
  children: ReactNode;
}

/** 工具页外壳：提供返回导航与标题栏 */
export function ToolPage({ tool, onBack, children }: ToolPageProps) {
  const Icon = tool.icon;
  return (
    <div className="container-app relative flex flex-col min-h-full">
      <div className="screen-glow" aria-hidden="true" />
      <header className="sticky top-0 z-20 flex items-center gap-3 px-4 pt-4 pb-3 bg-[rgba(15,16,32,0.72)] backdrop-blur-xl">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center text-[color:var(--text-1)] active:scale-90 transition-transform"
          aria-label="返回首页"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#d946ef] flex items-center justify-center text-white">
              <Icon className="w-5 h-5" />
            </span>
          )}
          <h1 className="text-base font-bold">{tool.name}</h1>
        </div>
      </header>
      <main className="flex-1 px-4 pb-8">{children}</main>
    </div>
  );
}