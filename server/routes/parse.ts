// ABOUTME: 链接解析与视频代理 API 路由

import { Router } from 'express';
import { Readable } from 'stream';
import { parseShareUrl, PLATFORM_LIST } from '../parsers/index';

const router = Router();

/** POST /api/parse { text } - 解析分享链接 */
router.post('/api/parse', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) {
    res.status(400).json({ ok: false, error: '缺少链接内容' });
    return;
  }
  if (text.length > 2000) {
    res.status(400).json({ ok: false, error: '链接内容过长' });
    return;
  }
  try {
    const result = await parseShareUrl(text);
    res.status(result.ok ? 200 : 422).json(result);
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: `解析服务异常：${err instanceof Error ? err.message : '未知错误'}`,
    });
  }
});

/** GET /api/parse/platforms - 支持平台清单 */
router.get('/api/parse/platforms', (_req, res) => {
  res.json({ ok: true, platforms: PLATFORM_LIST });
});

/** 按目标域名选择防盗链 Referer */
function refererFor(host: string): string {
  if (host.includes('douyin') || host.includes('bytecdn') || host.includes('douyinvod')) {
    return 'https://www.douyin.com/';
  }
  if (host.includes('klingai') || host.includes('kuaishou') || host.includes('kwsnc')) {
    return 'https://app.klingai.com/';
  }
  return '';
}

/**
 * GET /api/proxy?url=<encoded> - 视频流代理
 * 解决：1) 平台 CDN 防盗链（Referer 校验）；2) 跨域视频导致 canvas 被污染无法做像素处理
 */
router.get('/api/proxy', async (req, res) => {
  const raw = typeof req.query.url === 'string' ? req.query.url : '';
  let target: URL;
  try {
    target = new URL(raw);
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      throw new Error('bad protocol');
    }
  } catch {
    res.status(400).json({ ok: false, error: '非法的视频地址' });
    return;
  }

  try {
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    };
    const referer = refererFor(target.hostname);
    if (referer) headers['Referer'] = referer;
    if (typeof req.headers.range === 'string') headers['Range'] = req.headers.range;

    const upstream = await fetch(target.toString(), {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    });

    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ ok: false, error: `视频源响应异常（${upstream.status}）` });
      return;
    }

    res.status(upstream.status);
    const passHeaders = ['content-type', 'content-length', 'accept-ranges', 'content-range'];
    for (const name of passHeaders) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const nodeStream = Readable.fromWeb(upstream.body as import('stream/web').ReadableStream);
    nodeStream.on('error', () => res.end());
    nodeStream.pipe(res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({
        ok: false,
        error: `视频代理失败：${err instanceof Error ? err.message : '未知错误'}`,
      });
    }
  }
});

export default router;
