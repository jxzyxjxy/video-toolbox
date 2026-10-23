// ABOUTME: 可灵AI / 豆包等生成式视频链接抓取 - 烧录水印场景，返回原片进入框选流程

import type { ParseResult } from './types';

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

const FETCH_TIMEOUT = 12000;

/** 带重试的页面抓取：目标站偶发连接重置/握手失败，最多重试 2 次 */
export async function fetchPage(url: string): Promise<string> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': MOBILE_UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/** 从 HTML 中提取视频地址：og:video / video 标签 / JSON 中的 mp4 链接 */
export function extractVideoFromHtml(html: string): { video: string; title?: string; cover?: string } | null {
  // 1. og:video meta
  const ogVideo = html.match(/<meta[^>]+property=["']og:video(?::url)?["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::url)?["']/i);
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);

  if (ogVideo?.[1]) {
    return { video: ogVideo[1], title: ogTitle?.[1], cover: ogImage?.[1] };
  }

  // 2. <video src> 或 <source src>
  const videoTag = html.match(/<(?:video|source)[^>]+src=["']([^"']+\.(?:mp4|webm|mov)[^"']*)["']/i);
  if (videoTag?.[1]) {
    return { video: videoTag[1], title: ogTitle?.[1], cover: ogImage?.[1] };
  }

  // 3. JSON/脚本中的 mp4 直链（转义与非转义两种形态）
  const jsonVideo = html.match(/["'(](https?:\/\/[^"'()\s\\]+?\.mp4[^"'()\s\\]*?)["')]/i)
    ?? html.match(/(https?:\\\/\\\/[^"'\s]+?\.mp4[^"'\s]*?)[\\"']/i);
  if (jsonVideo?.[1]) {
    return {
      video: jsonVideo[1].replace(/\\\//g, '/'),
      title: ogTitle?.[1],
      cover: ogImage?.[1],
    };
  }

  return null;
}

/** 通用抓取：可灵/豆包/即梦等 AI 生成视频的分享页 */
export async function parseBurnedVideo(
  url: string,
  platform: 'kling' | 'generic',
  platformName: string,
): Promise<ParseResult> {
  try {
    const html = await fetchPage(url);
    const extracted = extractVideoFromHtml(html);

    if (extracted) {
      return {
        ok: true,
        platform,
        platformName,
        kind: 'burned',
        title: extracted.title,
        cover: extracted.cover,
        videoUrl: extracted.video,
        note: `${platformName}水印为生成时烧录进画面，已加载原视频，请框选水印区域去除`,
      };
    }

    return {
      ok: false,
      platform,
      platformName,
      kind: 'burned',
      note: '',
      error: `${platformName}分享页未能提取到视频（页面可能需登录或已更新），建议在 App 内下载原视频后使用本地上传`,
    };
  } catch (err) {
    return {
      ok: false,
      platform,
      platformName,
      kind: 'burned',
      note: '',
      error: `网络请求失败：${err instanceof Error ? err.message : '未知错误'}`,
    };
  }
}
