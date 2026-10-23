// ABOUTME: 链接解析服务的类型定义

/** 平台标识 */
export type PlatformId = 'douyin' | 'kling' | 'generic';

/**
 * 解析结果
 * - clean: 已取得平台无水印源，可直接下载
 * - burned: 水印为生成时烧录进画面，需进入框选修复流程
 */
export interface ParseResult {
  ok: boolean;
  platform: PlatformId;
  platformName: string;
  /** clean=无水印源 / burned=烧录水印原片 */
  kind: 'clean' | 'burned';
  title?: string;
  cover?: string;
  /** 视频地址（前端经 /api/proxy 访问，避免防盗链与跨域污染画布） */
  videoUrl?: string;
  /** 给用户的提示文案 */
  note: string;
  /** 失败原因（ok=false 时） */
  error?: string;
}

/** 平台展示信息（用于前端「支持平台」清单） */
export interface PlatformInfo {
  id: PlatformId;
  name: string;
  domains: string[];
  support: 'full' | 'partial' | 'try';
  /** 说明文案：该平台的链接会得到什么结果 */
  note: string;
}
