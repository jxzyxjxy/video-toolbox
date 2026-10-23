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
            <h3 className="text-lg font-bold whitespace-nowrap">{tool.name}</h3>
            <span className="shrink-0 whitespace-nowrap text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-[#6366f1] to-[#d946ef] text-white font-medium">
              去水印
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-[color:var(--text-2)] line-clamp-2">
            {tool.desc}
          </p>
        </div>
        <div className="shrink-0 text-[color:var(--text-3)]">
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      </div>
    </button>
  );
}

/** 网格占位卡片（coming-soon / 常规）：图标 + 标题 + 状态点，紧凑两行 */
export function GridToolCard({ tool, onClick }: ToolCardProps) {
  const Icon = tool.icon;
  const disabled = tool.status === 'coming-soon';
  return (
    <button
      type="button"
      onClick={() => !disabled && onClick(tool.id)}
      disabled={disabled}
      className={
        'glass-card rise flex items-center gap-2.5 text-left px-3 py-3 ' +
        (disabled ? 'opacity-80 cursor-default' : 'active:scale-[0.96] transition-transform duration-150')
      }
    >
      <div
        className={
          'w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ' +
          (disabled ? 'text-[color:var(--text-3)] bg-white/5' : 'text-[color:var(--text-2)] bg-white/10')
        }
      >
        {Icon ? <Icon className="w-[18px] h-[18px]" /> : <span className="text-base">▧</span>}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-[13px] font-semibold whitespace-nowrap leading-tight">{tool.name}</h4>
        <p className="mt-1 flex items-center gap-1 whitespace-nowrap text-[10px] text-[color:var(--text-3)]">
          <span
            className={
              'w-1 h-1 rounded-full shrink-0 ' +
              (disabled ? 'bg-amber-400/80' : 'bg-emerald-400/80')
            }
          />
          {disabled ? '即将上线' : '已上线'}
        </p>
      </div>
    </button>
  );
}