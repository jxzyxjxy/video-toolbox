import { useCallback, useEffect, useRef, useState } from 'react';
import type { Region } from '../../lib/videoProcessor';
import type { UploadedVideo } from './UploadStep';

interface SelectStepProps {
  video: UploadedVideo;
  region: Region | null;
  onChange: (r: Region | null) => void;
}

/**
 * 第二步：在预览视频上框选水印区域。
 * 支持鼠标与触摸指针，手指/光标按下后拖动生成矩形。
 */
export function SelectStep({ video, region, onChange }: SelectStepProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [displayW, setDisplayW] = useState(0);
  const [displayH, setDisplayH] = useState(0);
  const [draft, setDraft] = useState<Region | null>(null);
  const dragRef = useRef<{ sx: number; sy: number } | null>(null);

  // 计算视频显示尺寸（等比置于容器内）
  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    if (!cw) return;
    const vw = video.width;
    const vh = video.height;
    const scale = Math.min(cw / vw, 340 / vh);
    setDisplayW(vw * scale);
    setDisplayH(vh * scale);
  }, [video]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  // 指针位置 -> 归一化坐标
  const toRegion = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const x = (clientX - rect.left) / displayW;
    const y = (clientY - rect.top) / displayH;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = toRegion(e.clientX, e.clientY);
    dragRef.current = { sx: p.x, sy: p.y };
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const p = toRegion(e.clientX, e.clientY);
    const sx = dragRef.current.sx;
    const sy = dragRef.current.sy;
    setDraft({
      x: Math.min(sx, p.x),
      y: Math.min(sy, p.y),
      w: Math.abs(p.x - sx),
      h: Math.abs(p.y - sy),
    });
  };

  const onPointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (draft && draft.w > 0.01 && draft.h > 0.01) {
      onChange(draft);
    } else {
      setDraft(null);
      onChange(null);
    }
  };

  const active = draft && draft.w > 0.004 && draft.h > 0.004;

  return (
    <section className="rise mt-4">
      <p className="text-[13px] leading-relaxed text-[color:var(--text-2)] mb-3">
        用手指在视频上<span className="font-semibold text-white">框选水印所在区域</span>（可放大分析后精确框选），拖动即可调整选区。
      </p>

      <div
        ref={containerRef}
        className="relative mx-auto select-none touch-none overflow-hidden rounded-2xl bg-black/60"
        style={{ width: displayW || '100%', height: displayH || 260 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <video
          ref={videoRef}
          src={video.url}
          className="w-full h-full object-cover"
          muted
          loop
          playsInline
          autoPlay
        />
        {/* 选区遮罩：外部压暗高对比 + 高亮流动描边 + 四角锚点 */}
        {(active || (region && !draft)) && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${((draft ?? region)!.x) * 100}%`,
              top: `${((draft ?? region)!.y) * 100}%`,
              width: `${((draft ?? region)!.w) * 100}%`,
              height: `${((draft ?? region)!.h) * 100}%`,
            }}
          >
            {/* 外部深色压暗，突出框内 */}
            <div
              className="absolute -inset-px"
              style={{ boxShadow: '0 0 0 9999px rgba(8,8,20,0.62)' }}
            />
            {/* 渐进渐变底，模拟去除区域状态 */}
            <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--brand-1)]/45 via-[color:var(--brand-2)]/25 to-[color:var(--brand-1)]/45"
              style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.10) 0 1px, transparent 1px 5px)' }}
            />
            {/* 高亮描边，第3帧呼吸光晕 */}
            <div className="absolute inset-0 rounded-[6px] border-2 border-white/95 box-selection-glow" />
            {/* 四个醒目拖拽锚点 */}
            {[
              { left: '-3px', top: '-3px' },
              { left: 'calc(100% - 1px)', top: '-3px' },
              { left: '-3px', top: 'calc(100% - 1px)' },
              { left: 'calc(100% - 1px)', top: 'calc(100% - 1px)' },
            ].map((pos, i) => (
              <div
                key={i}
                className="absolute w-[14px] h-[14px] rounded-[4px] border-2 border-white bg-[color:var(--brand-1)] box-selection-glow"
                style={pos}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 gap-3">
        <button
          type="button"
          onClick={() => { setDraft(null); onChange(null); }}
          className="px-4 py-2.5 rounded-xl bg-white/8 text-[13px] font-medium active:scale-95 transition-transform"
        >
          清除选区
        </button>
        {active && (
          <p className="text-[11px] text-[color:var(--text-3)]">
            松开手指确认选区
          </p>
        )}
      </div>
    </section>
  );
}