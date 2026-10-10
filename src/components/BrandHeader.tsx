/** 品牌 Logo（渐变菱形 + 播放三角） */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        backgroundImage:
          'linear-gradient(135deg, var(--brand-1), var(--brand-2) 55%, var(--brand-3))',
        boxShadow: '0 8px 22px -6px rgba(139,92,246,0.6)',
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" className="w-1/2 h-1/2" aria-hidden="true">
        <path d="M10 8.5v7l5.5-3.5z" fill="#fff" />
      </svg>
    </div>
  );
}

/** 品牌信息块 */
export function BrandHeader() {
  return (
    <div className="text-center pt-2">
      <div className="flex items-center justify-center gap-3">
        <BrandLogo className="w-12 h-12 rounded-2xl flex items-center justify-center" />
        <div className="text-left">
          <h1 className="text-[22px] font-extrabold leading-none tracking-tight">
            VidPop
          </h1>
          <p className="text-sm mt-1.5 text-[color:var(--text-3)]">视频工具箱</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed max-w-[260px] mx-auto text-[color:var(--text-2)]">
        一站式视频处理工具，去水印 · 压缩 · 转换，随手搞定
      </p>
    </div>
  );
}