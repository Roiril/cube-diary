export interface Entry {
  id: string;
  user_id: string;
  content: string;
  image_urls: string[];
  created_at: string;
  updated_at?: string;
}

export interface User {
  id: string;
  email?: string;
  isGuest?: boolean;
}

export type ViewMode = 'single' | 'gallery';
export type GalleryLayout = 'sphere' | 'helix' | 'wormhole';
export type FillMode = 'repeat' | 'color';

export interface CubeFaceConfig {
  name: string;
  index: number;
  col: number;
  row: number;
}

