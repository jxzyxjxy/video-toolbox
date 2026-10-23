// ABOUTME: 抖音链接解析 - 提取无水印视频源（平台浮层水印场景）

import type { ParseResult } from './types';
import { fetchPage } from './kling';

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

const FETCH_TIMEOUT = 12000;

/** 带重试的短链重定向解析：返回最终落地 URL */
async function resolveFinalUrl(url: string): Promise<string> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': MOBILE_UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      return res.url;
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/** 在任意嵌套对象中查找第一个包含 url_list 的 play_addr 节点 */
function findPlayAddr(node: unknown, depth = 0): { url_list?: string[] } | null {
  if (depth > 12 || node === null || typeof node !== 'object') return null;
  const obj = node as Record<string, unknown>;
  for (const key of ['play_addr', 'playAddr']) {
    const cand = obj[key] as Record<string, unknown> | undefined;
    if (cand && Array.isArray(cand.url_list) && (cand.url_list as unknown[]).length > 0) {
      return cand as { url_list?: string[] };
    }
  }
  for (const value of Object.values(obj)) {
    if (typeof value === 'object') {
      const found = findPlayAddr(value, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function findStringField(node: unknown, keys: string[], depth = 0): string | undefined {
  if (depth > 10 || node === null || typeof node !== 'object') return undefined;
  const obj = node as Record<string, unknown>;
  for (const key of keys) {
    if (typeof obj[key] === 'string' && obj[key]) return obj[key] as string;
  }
  for (const value of Object.values(obj)) {
    if (typeof value === 'object') {
      const found = findStringField(value, keys, depth + 1);
      if (found) return found;
    }
  }
  return undefined;
}

/** 无水印地址：抖音 playwm 域名的水印流，play 域名为无水印流 */
function toNoWatermark(url: string): string {
  return url.replace(/playwm/g, 'play').replace(/^http:\/\//, 'https://');
}

/** 从 share 页 HTML 中解析 video 数据（_ROUTER_DATA 或 RENDER_DATA） */
function extractFromHtml(html: string): { play: string; title?: string; cover?: string } | null {
  // 路径 A: window._ROUTER_DATA = {...}
  const routerMatch = html.match(/window\._ROUTER_DATA\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  if (routerMatch) {
    try {
      const data = JSON.parse(routerMatch[1]) as unknown;
      const playAddr = findPlayAddr(data);
      const play = playAddr?.url_list?.[0];
      if (play) {
        return {
          play: toNoWatermark(play),
          title: findStringField(data, ['desc', 'title']),
          cover: findStringField(data, ['cover', 'origin_cover']),
        };
      }
    } catch {
      /* 尝试下一路径 */
    }
  }
  // 路径 B: <script id="RENDER_DATA" type="application/json">(urlencoded)</script>
  const renderMatch = html.match(/<script id="RENDER_DATA"[^>]*>([\s\S]*?)<\/script>/);
  if (renderMatch) {
    try {
      const data = JSON.parse(decodeURIComponent(renderMatch[1])) as unknown;
      const playAddr = findPlayAddr(data);
      const play = playAddr?.url_list?.[0];
      if (play) {
        return {
          play: toNoWatermark(play),
          title: findStringField(data, ['desc', 'title']),
          cover: findStringField(data, ['cover', 'originCover', 'origin_cover']),
        };
      }
    } catch {
      /* 解析失败 */
    }
  }
  return null;
}

/** 提取 aweme_id：支持 /video/xxx、/note/xxx、modal_id=xxx */
function extractAwemeId(url: string): string | null {
  const patterns = [/\/(?:video|note)\/(\d+)/, /modal_id=(\d+)/, /aweme_id=(\d+)/];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export async function parseDouyin(url: string): Promise<ParseResult> {
  try {
    // 1. 跟随短链重定向，拿到真实地址
    const finalUrl = await resolveFinalUrl(url);
    const awemeId = extractAwemeId(finalUrl) ?? extractAwemeId(url);
    if (!awemeId) {
      return {
        ok: false,
        platform: 'douyin',
        platformName: '抖音',
        kind: 'clean',
        note: '',
        error: '未能识别视频 ID，请确认分享链接完整',
      };
    }

    // 2. 依次尝试 share 页与主站页提取数据
    const pageUrls = [
      `https://www.iesdouyin.com/share/video/${awemeId}`,
      `https://www.douyin.com/video/${awemeId}`,
    ];
    for (const pageUrl of pageUrls) {
      try {
        const html = await fetchPage(pageUrl);
        const extracted = extractFromHtml(html);
        if (extracted) {
          return {
            ok: true,
            platform: 'douyin',
            platformName: '抖音',
            kind: 'clean',
            title: extracted.title,
            cover: extracted.cover,
            videoUrl: extracted.play,
            note: '已获取抖音无水印视频，可直接下载',
          };
        }
      } catch {
        /* 尝试下一个页面 */
      }
    }

    return {
      ok: false,
      platform: 'douyin',
      platformName: '抖音',
      kind: 'clean',
      note: '',
      error: '抖音页面解析失败（平台可能更新了接口），请下载后使用本地上传',
    };
  } catch (err) {
    return {
      ok: false,
      platform: 'douyin',
      platformName: '抖音',
      kind: 'clean',
      note: '',
      error: `网络请求失败：${err instanceof Error ? err.message : '未知错误'}`,
    };
  }
}
