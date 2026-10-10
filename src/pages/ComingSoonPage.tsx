interface ComingSoonProps {
  title: string;
  desc?: string;
  onBack: () => void;
  variant?: 'missing' | 'coming';
}

export function ComingSoonPage({ title, desc, onBack, variant = 'coming' }: ComingSoonProps) {
  return (
    <div className="container-app relative flex flex-col items-center justify-center min-h-full px-6">
      <div className="screen-glow" aria-hidden="true" />
      <button
        type="button"
        onClick={onBack}
        className="absolute top-4 left-4 w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center active:scale-90 transition-transform"
        aria-label="返回首页"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[color:var(--text-1)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      <div className="glass-card rise w-full px-6 py-10 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#d946ef] flex items-center justify-center text-white mb-5">
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {variant === 'coming' ? (
              <>
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <path d="M3 9h18M9 9v7" />
              </>
            ) : (
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01" />
            )}
          </svg>
        </div>
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--text-2)] max-w-[260px]">
          {variant === 'coming'
            ? desc ?? '该工具正在打磨中，敬请期待。'
            : '未找到该工具，可能已下线或链接有误。'}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="btn-brand mt-6 px-8 py-3 text-sm"
        >
          回到首页
        </button>
      </div>
    </div>
  );
}