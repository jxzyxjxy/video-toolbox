import { useRef, useState } from 'react';

export interface UploadedVideo {
  file: File;
  url: string;
  duration: number;
  width: number;
  height: number;
}

interface UploadStepProps {
  onVideoReady: (v: UploadedVideo) => void;
  onError: (msg: string) => void;
}

const ACCEPTED = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/3gpp', 'video/mpeg'];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 第一步：选择/上传视频 */
export function UploadStep({ onVideoReady, onError }: UploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');

  const readVideo = (file: File) => {
    // 校验类型（按扩展名兜底）
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const isVideo = file.type.startsWith('video/') || ['mp4', 'mov', 'm4v', 'webm', 'avi', '3gp', 'mkv'].includes(ext);
    if (!isVideo) {
      onError('请上传视频文件（支持 MP4、MOV、WebM、AVI 等格式）');
      return;
    }
    // 体积提示（不硬限制，超 100MB 给出提醒）
    if (file.size > 100 * 1024 * 1024) {
      onError('视频超过 100MB，超大文件可能处理缓慢，建议先压缩');
      return;
    }

    const url = URL.createObjectURL(file);
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.muted = true;
    el.src = url;
    const onLoaded = () => {
      if (el.duration && Number.isFinite(el.duration) && el.videoWidth > 0) {
        setFileName(file.name);
        setFileSize(formatBytes(file.size));
        onVideoReady({
          file,
          url,
          duration: el.duration,
          width: el.videoWidth,
          height: el.videoHeight,
        });
      } else {
        URL.revokeObjectURL(url);
        onError('无法读取该视频的时长与分辨率，请换一个视频试试');
      }
      el.removeAttribute('src');
    };
    el.onloadedmetadata = onLoaded;
    el.onerror = () => {
      URL.revokeObjectURL(url);
      onError('视频文件无法解码，可能已损坏或不支持该编码');
    };
  };

  return (
    <section className="rise mt-4">
      {/* 上传区 */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="glass-card card-glow w-full px-5 py-10 flex flex-col items-center active:scale-[0.98] transition-transform"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) readVideo(f);
            e.target.value = '';
          }}
        />
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#d946ef] flex items-center justify-center text-white shadow-lg mb-4">
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M17 8l-5-5-5 5" />
            <path d="M12 3v12" />
          </svg>
        </div>
        <p className="text-base font-semibold">点击选择视频</p>
        <p className="mt-1 text-[12px] text-[color:var(--text-3)]">
          支持 MP4 / MOV / WebM / AVI，单文件 ≤100MB
        </p>
        <p className="mt-3 text-[11px] px-3 py-1 rounded-full bg-white/10 text-[color:var(--text-2)]">
          支持从相册或文件选择，全程本地处理不上传
        </p>
      </button>

      {fileName && (
        <div className="glass-card mt-3 px-4 py-3 flex items-center gap-3 rise">
          <span className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium truncate">{fileName}</p>
            <p className="text-[11px] text-[color:var(--text-3)]">{fileSize}</p>
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-[12px] text-[color:var(--text-3)] leading-relaxed">
        已就绪后，请点击下方按钮进入下一步框选水印区域
      </p>
    </section>
  );
}