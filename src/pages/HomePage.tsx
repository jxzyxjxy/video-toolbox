import { BrandHeader } from '../components/BrandHeader';
import { FeaturedToolCard, GridToolCard } from '../components/ToolCards';
import { TOOL_REGISTRY } from '../tools/registry';

interface HomePageProps {
  navigate: (to: string) => void;
}

export function HomePage({ navigate }: HomePageProps) {
  const openTool = (id: string) => navigate(`tool/${id}`);
  const online = TOOL_REGISTRY.filter(t => t.status === 'online');
  const featured = online.find(t => t.featured);
  const grid = online.filter(t => !t.featured);
  const coming = TOOL_REGISTRY.filter(t => t.status === 'coming-soon');

  return (
    <div className="container-app relative flex flex-col px-5 pb-10">
      <div className="screen-glow" aria-hidden="true" />
      <header className="pt-8 rise">
        <BrandHeader />
      </header>

      {/* 主推工具 */}
      <section className="mt-7">
        <h2 className="text-[13px] font-semibold mb-3 text-[color:var(--text-2)] tracking-wide uppercase">
          热门工具
        </h2>
        {featured && <FeaturedToolCard tool={featured} onClick={openTool} variant="featured" />}
        {grid.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            {grid.map(t => (
              <GridToolCard key={t.id} tool={t} onClick={openTool} variant="grid" />
            ))}
          </div>
        )}
      </section>

      {/* 即将上线 */}
      <section className="mt-7">
        <h2 className="text-[13px] font-semibold mb-3 text-[color:var(--text-2)] tracking-wide uppercase">
          更多工具
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {coming.map(t => (
            <GridToolCard key={t.id} tool={t} onClick={openTool} variant="grid" />
          ))}
        </div>
      </section>

      {/* 底部引导 */}
      <footer className="mt-auto pt-10">
        <div className="glass-card px-4 py-3.5 flex items-center gap-3 rise">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#d946ef] flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          <p className="text-[12px] leading-snug text-[color:var(--text-2)]">
            选择上方工具卡片，即可开始处理你的视频。更多实用工具陆续上线中。
          </p>
        </div>
        <p className="text-center text-[11px] text-[color:var(--text-3)] mt-4">
          VidPop · 让视频处理更简单
        </p>
      </footer>
    </div>
  );
}