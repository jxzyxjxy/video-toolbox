// ABOUTME: 链接解析调度入口 - 识别平台、分发到对应解析器、暴露平台清单

import { parseDouyin } from './douyin';
import { parseBurnedVideo } from './kling';
import type { ParseResult, PlatformId, PlatformInfo } from './types';

/** 从用户粘贴的整段分享文案中提取第一个 URL */
export function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"'`）)\]，】]+/i);
  return m ? m[0].replace(/[.,;!?。，；！？、]+$/, '') : null;
}

/** 根据域名识别平台 */
export function detectPlatform(url: string): { id: PlatformId; name: string } {
  const host = url.toLowerCase();
  if (host.includes('douyin.com') || host.includes('iesdouyin.com')) {
    return { id: 'douyin', name: '抖音' };
  }
  if (host.includes('klingai.com') || host.includes('kling.')) {
    return { id: 'kling', name: '可灵AI' };
  }
  if (host.includes('doubao.com')) {
    return { id: 'generic', name: '豆包' };
  }
  if (host.includes('jimeng') || host.includes('jianying.com')) {
    return { id: 'generic', name: '即梦' };
  }
  return { id: 'generic', name: '其他平台' };
}

/** 平台支持清单（前端展示 + API 返回） */
export const PLATFORM_LIST: PlatformInfo[] = [
  {
    id: 'douyin',
    name: '抖音',
    domains: ['v.douyin.com', 'www.douyin.com', 'iesdouyin.com'],
    support: 'full',
    note: '支持完整解析，直接获取无水印视频下载',
  },
  {
    id: 'kling',
    name: '可灵AI',
    domains: ['app.klingai.com', 'v.klingai.com'],
    support: 'partial',
    note: '水印为生成时烧录进画面，抓取原视频后需框选水印区域去除',
  },
  {
    id: 'generic',
    name: '豆包 / 即梦 / 其他',
    domains: ['doubao.com', 'jimeng.jianying.com'],
    support: 'try',
    note: '尝试通用解析，成功后进入框选流程；解析失败请在 App 内下载后上传',
  },
];

export async function parseShareUrl(rawText: string): Promise<ParseResult> {
  const url = extractUrl(rawText);
  if (!url) {
    return {
      ok: false,
      platform: 'generic',
      platformName: '其他平台',
      kind: 'clean',
      note: '',
      error: '未识别到有效链接，请粘贴完整的分享内容或链接',
    };
  }

  // 视频文件直链：无需解析页面，直接作为烧录水印原片进入框选流程
  if (/\.(mp4|webm|mov|m4v|avi)(\?|#|$)/i.test(url)) {
    return {
      ok: true,
      platform: 'generic',
      platformName: '视频直链',
      kind: 'burned',
      videoUrl: url,
      note: '已识别视频直链，请框选水印区域去除',
    };
  }

  const { id, name } = detectPlatform(url);
  switch (id) {
    case 'douyin':
      return parseDouyin(url);
    case 'kling':
      return parseBurnedVideo(url, 'kling', name);
    default:
      return parseBurnedVideo(url, 'generic', name);
  }
}
