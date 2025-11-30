export interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

export type SvgFormat = 'svg' | 'jsx' | 'tsx' | 'vue' | 'svelte';

export interface ExportSettings {
  format: 'png' | 'jpeg' | 'webp';
  scale: number;
  width?: number;
  height?: number;
  transparent: boolean;
  quality: number;
}

export type SelectedElement = {
  id: string;
  tagName: string;
  fill: string;
  stroke: string;
  strokeWidth: string;
} | null;

export interface FileData {
  name: string;
  content: string;
}
