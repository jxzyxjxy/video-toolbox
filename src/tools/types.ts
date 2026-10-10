import type { ComponentType } from 'react';

/** 工具状态 */
export type ToolStatus = 'online' | 'coming-soon';

/**
 * 工具描述元数据。新增工具时只需在 registry 中注册一条记录并实现对应页面组件。
 */
export interface ToolDef {
  /** 唯一标识，同时作为路由 slug 与 key */
  id: string;
  /** 工具名称 */
  name: string;
  /** 一句话说明 */
  desc: string;
  /** 工具状态 */
  status: ToolStatus;
  /** 图标（可选，未传则按 id 生成占位） */
  icon?: ComponentType<{ className?: string }>;
  /** 工具页面组件（coming-soon 无需实现） */
  component?: ComponentType;
  /** 主推工具（首页大卡片） */
  featured?: boolean;
}

/** 内置工具图标集合的承载体，避免循环依赖 */
export interface ToolCardProps {
  tool: ToolDef;
  onClick: (id: string) => void;
  variant: 'featured' | 'grid';
}