import type { ToolCardProps } from '../tools/types';

/** 主推大卡片（featured） */
export function FeaturedToolCard({ tool, onClick }: ToolCardProps) {
  const Icon = tool.icon;
  return (
    <button
      type="button"
      onClick={() => onClick(tool.id)}
      className="glass-card card-glow rise w-full text-left px-5 py-5 active:scale-[0.98] transition-transform duration-150"
    >
      <div className="relative z-10 flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center text-white"
          style={{
            backgroundImage:
              'linear-gradient(135deg, var(--brand-1), var(--brand-2) 55%, var(--brand-3))',
            boxShadow: '0 8px 22px -6px rgba(139,92,246,0.6)',
          }}
        >
          {Icon ? <Icon className="w-7 h-7" /> : <span className="text-xl">▶</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold">{tool.name}</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#6366f1] to-[#d946ef] text-white font-medium">
              去水印
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-[color:var(--text-2)]">
            {tool.desc}
          </p>
        </div>
        <div className="text-[color:var(--text-3)]">
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      </div>
    </button>
  );
}

/** 网格占位卡片（coming-soon / 常规） */
export function GridToolCard({ tool, onClick }: ToolCardProps) {
  const Icon = tool.icon;
  const disabled = tool.status === 'coming-soon';
  return (
    <button
      type="button"
      onClick={() => !disabled && onClick(tool.id)}
      disabled={disabled}
      className={
        'glass-card rise relative flex flex-col items-center justify-center gap-3 aspect-square text-center px-3 ' +
        (disabled ? 'opacity-80 cursor-default' : 'active:scale-[0.96] transition-transform duration-150')
      }
    >
      {disabled && (
        <span className="absolute top-2.5 right-2.5 text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-[color:var(--text-3)]">
          即将上线
        </span>
      )}
      <div
        className={
          'w-12 h-12 rounded-2xl flex items-center justify-center ' +
          (disabled ? 'text-[color:var(--text-3)] bg-white/5' : 'text-[color:var(--text-2)] bg-white/10')
        }
      >
        {Icon ? <Icon className="w-6 h-6" /> : <span className="text-lg">▧</span>}
      </div>
      <div>
        <h4 className="text-sm font-semibold">{tool.name}</h4>
        <p className="mt-0.5 text-[11px] leading-tight text-[color:var(--text-3)]">{tool.desc}</p>
      </div>
    </button>
  );
}