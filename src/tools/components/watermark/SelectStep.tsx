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
        {/* 选区遮罩 */}
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
            <div className="w-full h-full absolute ring-2 ring-[color:var(--brand-3)] bg-[color:var(--brand-3)]/15"
              style={{ boxShadow: '0 0 0 9999px rgba(10,10,20,0.35)' }}
            />
            <span className="absolute -top-6 left-0 text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--brand-3)] text-white">
              水印区
            </span>
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