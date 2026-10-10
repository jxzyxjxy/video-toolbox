import { useEffect, useState, useCallback } from 'react';

function readHash(): string {
  const h = window.location.hash.replace(/^#\/?/, '');
  return h.split('?')[0] || 'home';
}

/**
 * 极简 Hash 路由。约定了两个路由：
 * - `#/home` 首页
 * - `#/tool/:id` 工具页
 * 供工具注册表（registry）驱动。
 */
export function useHashRoute(): {
  route: string;
  toolId: string | null;
  navigate: (to: string) => void;
} {
  const [route, setRoute] = useState<string>(() => readHash());

  useEffect(() => {
    const onHashChange = () => setRoute(readHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = `/${to}`;
  }, []);

  const toolId = route.startsWith('tool/') ? route.slice('tool/'.length) : null;

  return { route, toolId, navigate };
}

/** 回调 URL 使用的公开域名（前端运行时从环境变量读取，避免硬编码） */
export function getPublicBaseUrl(): string {
  return process.env.COZE_PROJECT_DOMAIN_DEFAULT ?? '';
}