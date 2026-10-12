/**
 * 视频去水印处理引擎（纯前端实现）
 *
 * 原理：将视频源逐帧绘制到离屏 canvas，对用户框选的水印矩形区域执行
 * 「邻域扩散修复」（heat-diffusion inpaint）——反复用四周像素均值向内
 * 填充，从而以帧内容替代水印像素，真正去除该区域水印。处理的同时用
 * MediaRecorder 把 canvas 帧流实时录制为可下载的 webm 视频。
 *
 * 完全在浏览器内完成，无需后端，不上传任何数据。
 */

export interface Region {
  /** 归一化坐标（0~1，相对视频原生尺寸） */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProgressHandler {
  (info: { progress: number; currentTime: number; duration: number }): void;
}

/** 是否支持录制导出（需要 MediaRecorder 支持视频格式） */
export function isExportSupported(): boolean {
  return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';
}

/**
 * 就地执行「最近边界像素」扩散修复（inpaint）。
 *
 * 思路：以修复矩形为中心向外扩展一环「上下文」，然后把矩形内每个像素
 * 用其四周、距最近的真实画面像素颜色覆盖（由外向内逐圈传播）。相比逐圈
 * 均值，最近像素传播能保留画面纹理与色彩，不会把区域平均成灰块或产生
 * 重复拖影，更适合视频逐帧水印修补。
 *
 * 复杂度约 O(扩展面积)，逐帧调用可接受。
 */
function inpaintRegion(
  ctx: CanvasRenderingContext2D,
  rect: Region,
  outputW: number,
  outputH: number,
): void {
  // 内层待修复矩形
  const ix0 = Math.max(0, Math.floor(rect.x));
  const iy0 = Math.max(0, Math.floor(rect.y));
  const ix1 = Math.min(outputW, Math.ceil(rect.x + rect.w));
  const iy1 = Math.min(outputH, Math.ceil(rect.y + rect.h));
  if (ix1 <= ix0 || iy1 <= iy0) return;

  // 外层扩展一圈上下文环（边距 = 修复宽高的 1/4，最小 4px，避免过度扩散）
  const margin = Math.max(4, Math.round(Math.min(rect.w, rect.h) / 4));
  const ox0 = Math.max(0, ix0 - margin);
  const oy0 = Math.max(0, iy0 - margin);
  const ox1 = Math.min(outputW, ix1 + margin);
  const oy1 = Math.min(outputH, iy1 + margin);
  const ow = ox1 - ox0;
  const oh = oy1 - oy0;

  // 整数索引
  let x0i = ix0 - ox0;
  let y0i = iy0 - oy0;
  let x1i = ix1 - ox0;
  let y1i = iy1 - oy0;
  if (x0i < 0) x0i = 0;
  if (y0i < 0) y0i = 0;
  if (x1i > ow) x1i = ow;
  if (y1i > oh) y1i = oh;

  const imgData = ctx.getImageData(ox0, oy0, ow, oh);
  const data = imgData.data;

  // mask：待修复像素（位于内层矩形内）
  const mask = new Uint8Array(ow * oh);
  for (let y = y0i; y < y1i; y++) {
    for (let x = x0i; x < x1i; x++) {
      mask[y * ow + x] = 1;
    }
  }

  // 每个像素到边框的距离（用于由外向内分层）——取到四邻的切比雪夫距离
  const dist = (x: number, y: number) =>
    Math.min(
      x - x0i + 1,
      x1i - x,
      y - y0i + 1,
      y1i - y,
    );

  const maxLayer = Math.max(x1i - x0i, y1i - y0i);
  for (let layer = 1; layer <= maxLayer; layer++) {
    // 采样本层开始时 data 值
    const snap = new Uint8ClampedArray(data);
    let touched = false;
    for (let y = y0i; y < y1i; y++) {
      for (let x = x0i; x < x1i; x++) {
        const p = y * ow + x;
        if (!mask[p] || dist(x, y) !== layer) continue;
        // 从 4 邻域选「已完成（mask=0）」像素作为源：
        //  - 上下文环（矩形外，天然 mask=0）直接可用
        //  - 矩形内更外层的已修复像素也可用
        const around: Array<[number, number]> = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ];
        for (const [ax, ay] of around) {
          if (ax < 0 || ax >= ow || ay < 0 || ay >= oh) continue;
          const ap = ay * ow + ax;
          if (mask[ap]) continue; // 仍需修复，跳过
          // 若源在矩形内，必须是更外层（距离更小），避免同层互相污染
          const inRect = ax >= x0i && ax < x1i && ay >= y0i && ay < y1i;
          if (inRect && dist(ax, ay) >= layer) continue;
          data[p] = snap[ap];
          data[p + 1] = snap[ap + 1];
          data[p + 2] = snap[ap + 2];
          mask[p] = 0;
          touched = true;
          break;
        }
      }
    }
    if (!touched) break;
  }

  ctx.putImageData(imgData, ox0, oy0);
}

export interface ProcessResult {
  blob: Blob | null;
  url: string;
  format: string;
  /** 输出文件扩展名（.mp4 或 .webm） */
  ext: string;
  duration: number;
}

export interface ProcessOptions {
  video: HTMLVideoElement;
  originalDuration: number;
  region: Region;
  /** 修复迭代次数，越大越平滑但越慢 */
  iterations?: number;
  onProgress?: ProgressHandler;
  signal?: AbortSignal;
  mimeType?: string;
}

/**
 * 处理主流程：把视频源帧逐帧绘制并修复水印区，用 MediaRecorder 录制。
 * 处理时视频会以正常速率播放，进度依据 currentTime / duration。
 */
export function processVideo(options: ProcessOptions): Promise<ProcessResult> {
  return new Promise<ProcessResult>((resolve, reject) => {
    const { video, originalDuration, region, onProgress, signal, mimeType } = options;

    // 目标输出尺寸：保持源分辨率
    const outputW = video.videoWidth;
    const outputH = video.videoHeight;

    // 创建离屏处理画布
    const canvas = document.createElement('canvas');
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      reject(new Error('无法创建 2D 画布上下文'));
      return;
    }

    // 计算缩放后的区域像素坐标（归一化 -> 原生像素）
    const rect: Region = {
      x: region.x * outputW,
      y: region.y * outputH,
      w: region.w * outputW,
      h: region.h * outputH,
    };

    // 选择录制类型：优先 mp4（iOS/Safari 支持），Android/Chrome 回退 webm
    const candidates = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const chosen = mimeType && MediaRecorder.isTypeSupported(mimeType) ? mimeType : candidates.find(t => MediaRecorder.isTypeSupported(t));
    if (!chosen) {
      reject(new Error('当前浏览器不支持视频录制导出'));
      return;
    }
    const ext = chosen.startsWith('video/mp4') ? '.mp4' : '.webm';

    const stream = canvas.captureStream(24);
    // 尝试把源视频音频混入，若无法则静音导出
    try {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      dest.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      audioCtx.resume();
    } catch {
      /* 音频不可用则忽略 */
    }

    const recorder = new MediaRecorder(stream, { mimeType: chosen, videoBitsPerSecond: 6_000_000 });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const cleanup = () => {
      stream.getTracks().forEach(t => t.stop());
      recorder.stream.getTracks().forEach(t => t.stop());
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: chosen });
      const url = URL.createObjectURL(blob);
      cleanup();
      resolve({ blob, url, format: chosen, ext, duration: originalDuration });
    };

    recorder.onerror = () => {
      cleanup();
      reject(new Error('视频录制过程中发生错误，请重试'));
    };

    let raf = 0;
    const paint = () => {
      if (signal?.aborted || recorder.state !== 'recording') {
        if (recorder.state !== 'inactive') recorder.stop();
        return;
      }
      ctx.drawImage(video, 0, 0, outputW, outputH);
      inpaintRegion(ctx, rect, outputW, outputH);
      const t = video.currentTime;
      const progress = originalDuration > 0 ? Math.min(1, t / originalDuration) : 0;
      onProgress?.({ progress, currentTime: t, duration: originalDuration });
      raf = requestAnimationFrame(paint);
    };

    signal?.addEventListener('abort', () => {
      cancelAnimationFrame(raf);
      if (recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
      }
      cleanup();
      reject(new Error('处理已取消'));
    });

    video.currentTime = 0;
    video.muted = true;
    video.loop = false;
    recorder.start(250);
    const playP = video.play();
    if (playP) playP.catch(() => {
      /* 自动播放被阻止时忽略，仍尝试录制首帧 */
    });

    paint();

    video.addEventListener('ended', function onEnd() {
      video.removeEventListener('ended', onEnd);
      cancelAnimationFrame(raf);
      if (recorder.state !== 'inactive') recorder.stop();
    }, { once: false });
  });
}

/** 释放对象 URL */
export function revokeUrl(url: string): void {
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}