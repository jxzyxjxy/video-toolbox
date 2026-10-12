import { useCallback, useRef, useState } from 'react';
import type { Region, ProcessResult } from '../lib/videoProcessor';
import { processVideo, revokeUrl, isExportSupported } from '../lib/videoProcessor';
import { UploadStep, type UploadedVideo } from './watermark/UploadStep';
import { SelectStep } from './watermark/SelectStep';

type Step = 'idle' | 'select' | 'processing' | 'result';

/** 「视频去水印」工具主流程：上传 → 框选 → 处理 → 对比下载 */
export function WatermarkTool() {
  const [step, setStep] = useState<Step>('idle');
  const [video, setVideo] = useState<UploadedVideo | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLVideoElement | null>(null);
  const originalRef = useRef<HTMLVideoElement | null>(null);

  const onVideoReady = useCallback((v: UploadedVideo) => {
    setVideo(v);
    setRegion(null);
    setError('');
    setStep('select');
  }, []);

  const onUploadError = useCallback((msg: string) => {
    setError(msg);
  }, []);

  const startProcessing = useCallback(async () => {
    if (!video || !region) {
      setError('请先框选水印区域后再开始处理');
      return;
    }
    if (!isExportSupported()) {
      setError('当前浏览器不支持录制导出，请使用最新版 Chrome / Edge / Safari');
      return;
    }
    setError('');
    setStep('processing');
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;

    // 读取视频源，供处理引擎逐帧绘制
    const v = document.createElement('video');
    v.src = video.url;
    v.preload = 'auto';
    v.muted = true;
    v.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      v.onloadeddata = () => resolve();
      v.onerror = () => reject(new Error('无法加载视频进行去水印'));
    });

    try {
      const res = await processVideo({
        video: v,
        originalDuration: video.duration,
        region,
        onProgress: info => setProgress(info.progress),
        signal: controller.signal,
      });
      // 释放旧结果
      if (result) revokeUrl(result.url);
      setResult(res);
      setStep('result');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '处理失败，请重试';
      setError(msg);
      setStep('select');
    } finally {
      v.removeAttribute('src');
    }
  }, [video, region, result]);

  const cancelProcessing = useCallback(() => {
    abortRef.current?.abort();
    setStep('select');
    setError('处理已取消');
  }, []);

  const resetAll = useCallback(() => {
    if (result) revokeUrl(result.url);
    if (video) URL.revokeObjectURL(video.url);
    setVideo(null);
    setRegion(null);
    setResult(null);
    setError('');
    setProgress(0);
    setStep('idle');
  }, [result, video]);

  // 下载处理结果：用 fetch + blob 方式，确保移动端真正保存文件而非新开播放
  const download = useCallback(async () => {
    if (!result?.url) return;
    try {
      const res = await fetch(result.url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const base = 'VidPop-去水印';
      const ext = result.ext || (result.format.includes('mp4') ? '.mp4' : '.webm');
      a.href = blobUrl;
      a.download = `${base}-${Date.now()}${ext}`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    } catch {
      setError('下载失败，请重试');
    }
  }, [result, setError]);

  return (
    <div className="relative">
      {/* 错误横幅 */}
      {error && (
        <div className="glass-card mt-4 px-4 py-3 flex items-start gap-3 rise border-rose-400/30">
          <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0 mt-0.5">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </span>
          <p className="text-[13px] leading-relaxed text-rose-200">{error}</p>
        </div>
      )}

      {/* 空状态：上传 */}
      {step === 'idle' && <UploadStep onVideoReady={onVideoReady} onError={onUploadError} />}

      {/* 框选 */}
      {step === 'select' && video && (
        <section className="rise mt-4">
          <SelectStep video={video} region={region} onChange={setRegion} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={resetAll}
              className="px-4 py-3 rounded-2xl bg-white/8 text-[13px] font-medium active:scale-95 transition-transform"
            >
              重新选择
            </button>
            <button
              type="button"
              onClick={startProcessing}
              disabled={!region}
              className="btn-brand px-4 py-3 text-sm"
            >
              开始去水印
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] text-[color:var(--text-3)]">
            处理全程在本地完成，视频不会上传到服务器
          </p>
        </section>
      )}

      {/* 处理中 */}
      {step === 'processing' && (
        <section className="rise mt-8 flex flex-col items-center">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#6366f1] to-[#d946ef] flex items-center justify-center text-white mb-6">
            <svg viewBox="0 0 24 24" className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <path d="M9 12v4m6-4v4" />
            </svg>
          </div>
          <h3 className="text-lg font-bold">正在去除水印…</h3>
          <p className="mt-1 text-[13px] text-[color:var(--text-2)]">
            {progress < 1 ? '逐帧修复水印区域，请保持页面打开' : '即将完成…'}
          </p>

          {/* 进度条 */}
          <div className="w-full max-w-[300px] mt-6 h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round(progress * 100)}%`,
                backgroundImage: 'linear-gradient(90deg,#6366f1,#8b5cf6,#d946ef)',
                backgroundSize: '200% 100%',
                animation: 'glow-flow 1.6s linear infinite',
                transition: 'width 0.25s ease',
              }}
            />
          </div>
          <p className="mt-3 text-[13px] font-medium text-[color:var(--brand-3)]">
            {Math.round(progress * 100)}%
          </p>

          <button
            type="button"
            onClick={cancelProcessing}
            className="mt-8 px-5 py-2.5 rounded-xl bg-white/8 text-[13px] active:scale-95 transition-transform"
          >
            取消处理
          </button>
        </section>
      )}

      {/* 结果对比 */}
      {step === 'result' && result && video && (
        <section className="rise mt-5">
          <h3 className="text-base font-bold mb-2 text-center">处理完成 🎉</h3>

          {/* 对比播放器 */}
          <div className="glass-card p-3">
            <div className="space-y-4">
              <div>
                <p className="text-[12px] font-medium text-[color:var(--text-3)] mb-1.5">处理前</p>
                <video
                  ref={originalRef}
                  src={video.url}
                  controls
                  muted
                  playsInline
                  className="w-full rounded-xl bg-black/60"
                />
              </div>
              <div>
                <p className="text-[12px] font-medium text-[color:var(--brand-3)] mb-1.5">处理后</p>
                <video
                  ref={outputRef}
                  src={result.url}
                  controls
                  muted
                  playsInline
                  className="w-full rounded-xl bg-black/60"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={resetAll}
              className="px-4 py-3.5 rounded-2xl bg-white/8 text-[13px] font-medium active:scale-95 transition-transform"
            >
              处理下一个
            </button>
            <button
              type="button"
              onClick={download}
              className="btn-brand px-4 py-3.5 text-sm"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="M7 10l5 5 5-5" />
                <path d="M12 15V3" />
              </svg>
              下载视频
            </button>
          </div>
        </section>
      )}
    </div>
  );
}