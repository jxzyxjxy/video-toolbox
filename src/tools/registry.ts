import type { ToolDef } from './types';
import {
  WatermarkRemoverIcon,
  CompressIcon,
  ConvertIcon,
  AudioIcon,
  CropIcon,
  SubtitleIcon,
} from './icons/toolIcons';
import { WatermarkTool } from './components/WatermarkTool';

/**
 * 工具注册表：新增工具只需在此追加一条记录（含路由组件），
 * 首页卡片、路由分发、占位展示均由此表驱动，无需改动其他代码。
 */
export const TOOL_REGISTRY: ToolDef[] = [
  {
    id: 'watermark',
    name: '视频去水印',
    desc: '智能识别水印区域，一键去除画面中的水印与 logo',
    status: 'online',
    icon: WatermarkRemoverIcon,
    component: WatermarkTool,
    featured: true,
  },
  {
    id: 'compress',
    name: '视频压缩',
    desc: '压缩视频体积，保持清晰画质',
    status: 'coming-soon',
    icon: CompressIcon,
  },
  {
    id: 'convert',
    name: '格式转换',
    desc: 'MP4 / MOV / AVI 等格式互转',
    status: 'coming-soon',
    icon: ConvertIcon,
  },
  {
    id: 'audio',
    name: '音频提取',
    desc: '从视频中提取音频为 MP3',
    status: 'coming-soon',
    icon: AudioIcon,
  },
  {
    id: 'crop',
    name: '视频裁剪',
    desc: '按时间区间精准裁剪片段',
    status: 'coming-soon',
    icon: CropIcon,
  },
  {
    id: 'subtitle',
    name: '字幕提取',
    desc: '识别并导出视频中的字幕',
    status: 'coming-soon',
    icon: SubtitleIcon,
  },
];

/** 便捷查询 */
export function getToolById(id: string): ToolDef | undefined {
  return TOOL_REGISTRY.find(t => t.id === id);
}

/** 主推工具 */
export function getFeaturedTool(): ToolDef | undefined {
  return TOOL_REGISTRY.find(t => t.featured);
}

/** 即将上线工具列表 */
export function getComingSoonTools(): ToolDef[] {
  return TOOL_REGISTRY.filter(t => t.status === 'coming-soon');
}