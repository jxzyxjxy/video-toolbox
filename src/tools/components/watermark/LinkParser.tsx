import { useCallback, useEffect, useState } from 'react';
import type { UploadedVideo } from './UploadStep';

/* ---------- 与后端对齐的类型 ---------- */
interface ParseResult {
  ok: boolean;
  platform: string;
  platformName: string;
  kind: 'clean' | 'burned';
  title?: string;
  cover?: string;
  videoUrl?: string;
  note: string;
  error?: string;
}

interface PlatformInfo {
  id: string;
  name: string;
  support: 'full' | 'partial' | 'try';
  note: string;
}

interface LinkParserProps {
  /** burned 类视频：回调进入框选流程（url 已经过本地代理） */
  onVideoReady: (v: UploadedVideo) => void;
  onError: (msg: string) => void;
}

const PROXY = (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`;

const SUPPORT_META: Record<PlatformInfo['support'], { label: string; cls: string; dot: string }> = {
  full: { label: '无水印直取', cls: 'bg-emerald-500/15 text-emerald-300', dot: 'bg-emerald-400' },
  partial: { label: '抓取后框选', cls: 'bg-amber-500/15 text-amber-300', dot: 'bg-amber-400' },
  try: { label: '尝试解析', cls: 'bg-white/10 text-[color:var(--text-3)]', dot: 'bg-white/40' },
};

/** 读取远程视频元数据（经本地代理，避免跨域污染后续 canvas 处理） */
function loadMeta(url: string): Promise<Pick<UploadedVideo, 'duration' | 'width' | 'height'>> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.muted = true;
    el.playsInline = true;
    el.src = url;
    el.onloadedmetadata = () => {
      if (el.duration && Number.isFinite(el.duration) && el.videoWidth > 0) {
        resolve({ duration: el.duration, width: el.videoWidth, height: el.videoHeight });
      } else {
        reject(new Error('无法读取视频信息'));
      }
      el.removeAttribute('src');
    };
    el.onerror = () => reject(new Error('视频加载失败，链接可能已过期'));
  });
}

/** 粘贴链接解析入口：抖音类直取无水印 / AI 生成类抓取后框选 */
export function LinkParser({ onVideoReady, onError }: LinkParserProps) {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [cleanResult, setCleanResult] = useState<ParseResult | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [showPlatforms, setShowPlatforms] = useState(false);

  useEffect(() => {
    fetch('/api/parse/platforms')
      .then(r => r.json())
      .then((d: { ok: boolean; platforms?: PlatformInfo[] }) => {
        if (d.ok && d.platforms) setPlatforms(d.platforms);
      })
      .catch(() => {
        /* 清单加载失败不阻塞主流程 */
      });
  }, []);

  const parse = useCallback(async () => {
    const value = text.trim();
    if (!value) {
      onError('请先粘贴分享链接或整段分享文案');
      return;
    }
    setParsing(true);
    setCleanResult(null);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value }),
      });
      const result = (await res.json()) as ParseResult;
      if (!result.ok || !result.videoUrl) {
        onError(result.error || '解析失败，请换个链接或改用本地上传');
        return;
      }

      const proxyUrl = PROXY(result.videoUrl);
      if (result.kind === 'burned') {
        // 烧录水印：加载元数据后进入框选流程
        const meta = await loadMeta(proxyUrl);
        onVideoReady({
          url: proxyUrl,
          duration: meta.duration,
          width: meta.width,
          height: meta.height,
          sourceName: result.title || `${result.platformName}视频`,
        });
        onError(''); // 清空旧错误，说明文案由父级流程提示
        return;
      }
      // 无水印源：展示结果卡片，直接下载
      setCleanResult({ ...result, videoUrl: proxyUrl });
    } catch (e) {
      onError(e instanceof Error ? e.message : '解析请求失败，请检查网络后重试');
    } finally {
      setParsing(false);
    }
  }, [text, onError, onVideoReady]);

  const downloadClean = useCallback(async () => {
    if (!cleanResult?.videoUrl) return;
    setDownloading(true);
    try {
      const res = await fetch(cleanResult.videoUrl);
      if (!res.ok) throw new Error('视频源响应异常');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const name = (cleanResult.title || '无水印视频').replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
      a.href = blobUrl;
      a.download = `${name}.mp4`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    } catch {
      onError('下载失败，请重试或改用框选流程处理');
    } finally {
      setDownloading(false);
    }
  }, [cleanResult, onError]);

  return (
    <section className="mt-6">
      {/* 分隔 */}
      <div className="flex items-center gap-3 mb-5">
        <span className="flex-1 h-px bg-white/10" />
        <span className="text-[11px] text-[color:var(--text-3)]">或</span>
        <span className="flex-1 h-px bg-white/10" />
      </div>

      <div className="glass-card px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-[color:var(--brand-3)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <h3 className="text-[14px] font-semibold">粘贴链接解析</h3>
          <button
            type="button"
            onClick={() => setShowPlatforms(v => !v)}
            className="ml-auto text-[11px] text-[color:var(--brand-3)] active:opacity-70"
          >
            {showPlatforms ? '收起支持说明' : '支持哪些平台？'}
          </button>
        </div>

        {/* 支持平台清单 */}
        {showPlatforms && (
          <div className="mb-3 space-y-2 rise">
            {platforms.map(p => {
              const meta = SUPPORT_META[p.support];
              return (
                <div key={p.id} className="flex items-start gap-2.5 rounded-xl bg-white/5 px-3 py-2.5">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-medium">{p.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-[color:var(--text-3)]">{p.note}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={3}
          placeholder="粘贴分享链接或整段文案，如：8.76 复制打开抖音… https://v.douyin.com/xxxx/"
          className="w-full rounded-xl bg-black/30 ring-1 ring-white/10 focus:ring-[color:var(--brand-2)] outline-none px-3 py-2.5 text-[13px] leading-relaxed placeholder:text-[color:var(--text-3)] resize-none"
        />
        <button
          type="button"
          onClick={parse}
          disabled={parsing}
          className="btn-brand w-full mt-3 px-4 py-3 text-sm disabled:opacity-60"
        >
          {parsing ? '解析中…' : '解析链接'}
        </button>
        <p className="mt-2.5 text-[11px] leading-snug text-[color:var(--text-3)]">
          链接解析在服务器完成；涉及框选修复时，视频仅在本地处理，不会上传保存。
        </p>
      </div>

      {/* 无水印直取结果 */}
      {cleanResult && (
        <div className="glass-card card-glow mt-3 px-4 py-4 rise">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold truncate">
                {cleanResult.title || `${cleanResult.platformName}视频`}
              </p>
              <p className="text-[11px] text-emerald-300/90">{cleanResult.note}</p>
            </div>
          </div>
          <video
            src={cleanResult.videoUrl}
            controls
            playsInline
            className="w-full rounded-xl bg-black/60 max-h-[320px]"
          />
          <button
            type="button"
            onClick={downloadClean}
            disabled={downloading}
            className="btn-brand w-full mt-3 px-4 py-3 text-sm disabled:opacity-60"
          >
            {downloading ? '下载中…' : '下载无水印视频'}
          </button>
        </div>
      )}
    </section>
  );
}
