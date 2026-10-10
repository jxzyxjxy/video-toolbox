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
 * 就地执行边界驱动的扩散修复（inpaint）。
 *
 * 策略：以修复矩形为中心，向外扩展一圈「上下文环」（包含水印四周的真实画面），
 * 环内像素作为源；随后从外环向内用「邻域均值」逐层扩散，用水印四周的画面内容
 * 自然填充水印区域。复杂度约为 O(扩展面积)，性能可控。
 */
function inpaintRegion(
  ctx: CanvasRenderingContext2D,
  rect: Region,
  outputW: number,
  outputH: number,
  _iterations = 10,
): void {
  // 内层待修复矩形
  const ix0 = Math.max(0, Math.floor(rect.x));
  const iy0 = Math.max(0, Math.floor(rect.y));
  const ix1 = Math.min(outputW, Math.ceil(rect.x + rect.w));
  const iy1 = Math.min(outputH, Math.ceil(rect.y + rect.h));
  if (ix1 <= ix0 || iy1 <= iy0) return;

  // 外层扩展上下文环（向内缩进同样语义：扩展边距 = 修复宽高的 1/3，至少 8px）
  const margin = Math.max(8, Math.round(Math.min(rect.w, rect.h) / 3));
  const ox0 = Math.max(0, ix0 - margin);
  const oy0 = Math.max(0, iy0 - margin);
  const ox1 = Math.min(outputW, ix1 + margin);
  const oy1 = Math.min(outputH, iy1 + margin);
  const ow = ox1 - ox0;
  const oh = oy1 - oy0;

  // 采外层（含上下文环）像素并写入工作缓冲
  const imgData = ctx.getImageData(ox0, oy0, ow, oh);
  const data = imgData.data;
  const idx = (x: number, y: number) => (y * ow + x) * 4;

  // 标记哪些像素待修复（true=待修复，位于内层矩形内）
  const mask = new Uint8Array(ow * oh);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const vx = ox0 + x;
      const vy = oy0 + y;
      if (vx >= ix0 && vx < ix1 && vy >= iy0 && vy < iy1) mask[y * ow + x] = 1;
    }
  }

  // 由外向内逐圈扩散：每一轮让待修复像素取「相邻已完成像素」的均值
  // 用到边界的距离分层，保证外圈先被修复
  const totalRounds = Math.max(ix1 - ix0, iy1 - iy0) + margin;
  for (let round = 0; round < totalRounds; round++) {
    const snapshot = new Uint8ClampedArray(data);
    let touched = false;
    for (let y = 0; y < oh; y++) {
      for (let x = 0; x < ow; x++) {
        const p = y * ow + x;
        if (!mask[p]) continue; // 只处理待修复像素
        let s0 = 0;
        let s1 = 0;
        let s2 = 0;
        let cnt = 0;
        const around: Array<[number, number]> = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ];
        for (const [ax, ay] of around) {
          if (ax < 0 || ay < 0 || ax >= ow || ay >= oh) continue;
          // 源：已完成的像素（非当前待修复像素）
          if (!mask[ay * ow + ax]) {
            const sp = idx(ax, ay);
            s0 += snapshot[sp];
            s1 += snapshot[sp + 1];
            s2 += snapshot[sp + 2];
            cnt++;
          }
        }
        if (cnt > 0) {
          data[p] = s0 / cnt;
          data[p + 1] = s1 / cnt;
          data[p + 2] = s2 / cnt;
          mask[p] = 0; // 本轮已填充，标记为完成
          touched = true;
        }
      }
    }
    // 当前轮没有任何像素可填充（四周不再有已完成像素），扩散结束
    if (!touched) break;
  }

  ctx.putImageData(imgData, ox0, oy0);
}

export interface ProcessResult {
  blob: Blob | null;
  url: string;
  format: string;
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
    const { video, originalDuration, region, iterations = 12, onProgress, signal, mimeType } = options;

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

    // 选择录制类型
    const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    const chosen = mimeType && MediaRecorder.isTypeSupported(mimeType) ? mimeType : candidates.find(t => MediaRecorder.isTypeSupported(t));
    if (!chosen) {
      reject(new Error('当前浏览器不支持视频录制导出'));
      return;
    }

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
      resolve({ blob, url, format: chosen, duration: originalDuration });
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
      inpaintRegion(ctx, rect, outputW, outputH, iterations);
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