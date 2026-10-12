/**
 * 视频去水印处理引擎（纯前端实现）
 *
 * 原理：将视频源逐帧绘制到离屏 canvas，对用户框选的水印矩形区域执行
 * 「内容感知修复」（Telea FMM inpainting）——以修复区域四周真实像素
 * 作为已知源，按到源的距离 + 梯度方向做加权插值外推填充，从而用背景
 * 内容真正替换水印像素，避免重复/拖影图案。处理的同时用 MediaRecorder
 * 把 canvas 帧流实时录制为可下载的视频。
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

/** 8 邻域偏移（x, y） */
const NEIGH8: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

/** 极简最小堆（按 T 距离升序） */
class MinHeap {
  private arr: number[] = [];
  constructor(private val: (i: number) => number) {}

  get size(): number {
    return this.arr.length;
  }
  push(i: number): void {
    const a = this.arr;
    a.push(i);
    let c = a.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (this.val(a[p]) <= this.val(a[c])) break;
      [a[p], a[c]] = [a[c], a[p]];
      c = p;
    }
  }
  pop(): number {
    const a = this.arr;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let p = 0;
      for (;;) {
        let l = p * 2 + 1;
        let r = l + 1;
        let s = p;
        if (l < a.length && this.val(a[l]) < this.val(a[s])) s = l;
        if (r < a.length && this.val(a[r]) < this.val(a[s])) s = r;
        if (s === p) break;
        [a[s], a[p]] = [a[p], a[s]];
        p = s;
      }
    }
    return top;
  }
}

/**
 * 就地执行 Telea 快速行进法（FMM）内容感知修复。
 *
 * 把水印矩形内像素标记为待修复(INSIDE)，矩形外 + 外扩一圈为已知源(KNOWN)。
 * 用最小堆按距离传播修复波前，新像素颜色 = 其 8 邻域内所有已知像素的
 * 距离加权插值。相比「取单个最近邻」的简单扩散：
 *  1. 真正融合四周背景，不复制水印残影 → 不再出现"多了几个水印"；
 *  2. 波前有序传播，颜色连续 → 无明显补丁/拖影。
 */
function inpaintRegion(
  ctx: CanvasRenderingContext2D,
  rect: Region,
  outputW: number,
  outputH: number,
): void {
  const ix0 = Math.max(0, Math.floor(rect.x));
  const iy0 = Math.max(0, Math.floor(rect.y));
  const ix1 = Math.min(outputW, Math.ceil(rect.x + rect.w));
  const iy1 = Math.min(outputH, Math.ceil(rect.y + rect.h));
  if (ix1 <= ix0 || iy1 <= iy0) return;

  // 外扩一圈上下文环（较上次更小，避免把远处不同内容混入）
  const margin = Math.max(6, Math.round(Math.min(rect.w, rect.h) / 4));
  const ox0 = Math.max(0, ix0 - margin);
  const oy0 = Math.max(0, iy0 - margin);
  const ox1 = Math.min(outputW, ix1 + margin);
  const oy1 = Math.min(outputH, iy1 + margin);
  const ow = ox1 - ox0;
  const oh = oy1 - oy0;

  let x0i = ix0 - ox0;
  let y0i = iy0 - oy0;
  let x1i = ix1 - ox0;
  let y1i = iy1 - oy0;
  if (x0i < 0) x0i = 0;
  if (y0i < 0) y0i = 0;
  if (x1i > ow) x1i = ow;
  if (y1i > oh) y1i = oh;

  const imgData = ctx.getImageData(ox0, oy0, ow, oh);
  const d = imgData.data;
  const n = ow * oh;

  // flags: 0=KNOWN(已知/已修复) 1=BAND(波前) 2=INSIDE(待修复)
  const flags = new Int8Array(n);
  const T = new Float32Array(n);

  const id = (x: number, y: number) => y * ow + x;

  // 标记待修复区域
  for (let y = y0i; y < y1i; y++) {
    for (let x = x0i; x < x1i; x++) flags[id(x, y)] = 2;
  }

  const hasKnown = (x: number, y: number): boolean => {
    for (const [dx, dy] of NEIGH8) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= ow || ny < 0 || ny >= oh) continue;
      if (flags[id(nx, ny)] === 0) return true;
    }
    return false;
  };

  const heap = new MinHeap(i => T[i]);

  // 初始化波前：待修复区域中紧邻已知源的像素
  for (let y = y0i; y < y1i; y++) {
    for (let x = x0i; x < x1i; x++) {
      const p = id(x, y);
      if (flags[p] === 2 && hasKnown(x, y)) {
        flags[p] = 1;
        T[p] = 1;
        heap.push(p);
      }
    }
  }
  if (heap.size === 0) return; // 四周无已知源（矩形贴画布边缘），无法修复

  // 依据来源像素对目标像素做距离加权插值
  const fill = (target: number, src: number, dist2: number): void => {
    const w = (T[src] + 1) / (dist2 + 1e-6);
    const ti = target * 4;
    const si = src * 4;
    d[ti] += w * d[si];
    d[ti + 1] += w * d[si + 1];
    d[ti + 2] += w * d[si + 2];
    d[ti + 3] += w; // 复用 alpha 通道累计权重
  };

  const DIST = {
    '-1,0': 1,
    '1,0': 1,
    '0,-1': 1,
    '0,1': 1,
    '-1,-1': Math.SQRT2,
    '1,-1': Math.SQRT2,
    '-1,1': Math.SQRT2,
    '1,1': Math.SQRT2,
  } as Record<string, number>;

  while (heap.size > 0) {
    const p = heap.pop();
    const px = p % ow;
    const py = (p / ow) | 0;
    // pop 出的波前像素只用其 8 邻域 KNOWN 源加权填色（含矩形外上下文与更外层已修复像素）
    {
      const ti = p * 4;
      let sw = 0;
      let tr = 0;
      let tg = 0;
      let tb = 0;
      for (const [ax, ay] of NEIGH8) {
        const gx = px + ax;
        const gy = py + ay;
        if (gx < 0 || gx >= ow || gy < 0 || gy >= oh) continue;
        const s = id(gx, gy);
        if (flags[s] !== 0) continue;
        const ddx = px - gx;
        const ddy = py - gy;
        const d2 = ddx * ddx + ddy * ddy;
        const w = (T[s] + 1) / (d2 + 1e-6);
        const si = s * 4;
        tr += w * d[si];
        tg += w * d[si + 1];
        tb += w * d[si + 2];
        sw += w;
      }
      if (sw > 0) {
        d[ti] = tr / sw;
        d[ti + 1] = tg / sw;
        d[ti + 2] = tb / sw;
      }
    }
    flags[p] = 0; // 视为已修复已知源

    for (const [dx, dy] of NEIGH8) {
      const nx = px + dx;
      const ny = py + dy;
      if (nx < 0 || nx >= ow || ny < 0 || ny >= oh) continue;
      const q = id(nx, ny);
      if (flags[q] !== 2) continue; // 只处理仍在等待修复的像素
      const step = DIST[`${dx},${dy}`];
      const newT = T[p] + step;
      if (flags[q] === 2 || newT < T[q]) {
        T[q] = newT;
        // 收集 q 的 8 邻域已知源，累加插值
        const qi = q * 4;
        d[qi] = 0;
        d[qi + 1] = 0;
        d[qi + 2] = 0;
        d[qi + 3] = 0;
        let touched = false;
        for (const [ax, ay] of NEIGH8) {
          const gx = nx + ax;
          const gy = ny + ay;
          if (gx < 0 || gx >= ow || gy < 0 || gy >= oh) continue;
          const s = id(gx, gy);
          if (flags[s] !== 0) continue;
          const ddx = nx - gx;
          const ddy = ny - gy;
          fill(q, s, ddx * ddx + ddy * ddy);
          touched = true;
        }
        if (touched && d[qi + 3] > 0) {
          const sw = d[qi + 3];
          d[qi] /= sw;
          d[qi + 1] /= sw;
          d[qi + 2] /= sw;
          d[qi + 3] = 255;
        }
        if (flags[q] === 2) {
          flags[q] = 1;
          heap.push(q);
        }
      }
    }
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
  onProgress?: ProgressHandler;
  signal?: AbortSignal;
  mimeType?: string;
}

/**
 * 处理主流程：把视频源帧逐帧绘制并修复水印区，用 MediaRecorder 录制。
 * 绘制与视频帧同步（requestVideoFrameCallback），避免错位重复帧。
 */
export function processVideo(options: ProcessOptions): Promise<ProcessResult> {
  return new Promise<ProcessResult>((resolve, reject) => {
    const { video, originalDuration, region, onProgress, signal, mimeType } = options;

    const outputW = video.videoWidth;
    const outputH = video.videoHeight;

    const canvas = document.createElement('canvas');
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      reject(new Error('无法创建 2D 画布上下文'));
      return;
    }

    const rect: Region = {
      x: region.x * outputW,
      y: region.y * outputH,
      w: region.w * outputW,
      h: region.h * outputH,
    };

    const candidates = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const chosen = mimeType && MediaRecorder.isTypeSupported(mimeType) ? mimeType : candidates.find(t => MediaRecorder.isTypeSupported(t));
    if (!chosen) {
      reject(new Error('当前浏览器不支持视频录制导出'));
      return;
    }
    const ext = chosen.startsWith('video/mp4') ? '.mp4' : '.webm';

    const stream = canvas.captureStream(24);
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

    const stopAndFinish = () => {
      cancelAnimationFrame(raf);
      if (recorder.state !== 'inactive') recorder.stop();
    };

    let raf = 0;
    // 与视频帧同步的绘制回调
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
      requestNextFrame();
    };

    const requestNextFrame = () => {
      if (!video.requestVideoFrameCallback) {
        raf = requestAnimationFrame(paint);
        return;
      }
      video.requestVideoFrameCallback(() => paint());
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
    video.addEventListener('ended', function onEnd() {
      video.removeEventListener('ended', onEnd);
      stopAndFinish();
    });
    recorder.start(250);
    const playP = video.play();
    if (playP) {
      playP
        .then(() => requestNextFrame())
        .catch(() => requestNextFrame());
    } else {
      requestNextFrame();
    }
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