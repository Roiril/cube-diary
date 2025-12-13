import { CubeFaceConfig } from '@/types';

export const CUBE_FACE_COUNT = 6;
export const DUMMY_IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export const CUBE_FACE_CONFIG: CubeFaceConfig[] = [
  { name: 'Top', index: 2, col: 2, row: 1 },
  { name: 'Left', index: 1, col: 1, row: 2 },
  { name: 'Front', index: 4, col: 2, row: 2 },
  { name: 'Right', index: 0, col: 3, row: 2 },
  { name: 'Back', index: 5, col: 4, row: 2 },
  { name: 'Bottom', index: 3, col: 2, row: 3 },
];

export const IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 0.15,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
  initialQuality: 0.6,
};

export const CAMERA_POSITIONS = {
  single: {
    mobile: { x: 0, y: 0, z: 7 },
    desktop: { x: 0, y: 0, z: 5.5 },
  },
  gallery: {
    // 全体が見切れないように少し遠目に設定
    mobile: { x: 0, y: 15, z: 32 },
    desktop: { x: 0, y: 10, z: 24 },
  },
} as const;

export const GALLERY_LAYOUT_PARAMS = {
  sphere: {
    // 対数スケール導入により倍率を抑えめにする
    radiusMultiplier: 1.2,
  },
  helix: {
    radius: 10,
    ySpacing: 1.5,
    angleMultiplier: 0.5,
  },
  wormhole: {
    radius: 11,
    zSpacing: 3.5, // 管の太さとして利用
    angleMultiplier: 0.5,
  },
} as const;

export const GUEST_SAMPLE_USER_ID = '00000000-0000-0000-0000-000000000000';