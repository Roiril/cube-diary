import { GALLERY_LAYOUT_PARAMS } from '@/constants/cube';
import { GalleryLayout } from '@/types';

export function getPosition(
  index: number,
  total: number,
  layout: GalleryLayout
): [number, number, number] {
  const safeTotal = Math.max(1, total);

  switch (layout) {
    case 'sphere': {
      // フィボナッチ・スフィア (均等配置)
      const { radiusMultiplier } = GALLERY_LAYOUT_PARAMS.sphere;
      
      const k = index + 0.5;
      const phi = Math.acos(1 - (2 * k) / safeTotal);
      const theta = Math.PI * (1 + Math.sqrt(5)) * k; // 黄金角

      // 対数スケールでサイズ調整 (数が増えても大きくなりすぎない)
      const r = (10 + Math.log(safeTotal) * 2) * radiusMultiplier;

      return [
        r * Math.cos(theta) * Math.sin(phi),
        r * Math.sin(theta) * Math.sin(phi),
        r * Math.cos(phi),
      ];
    }

    case 'helix': {
      // 螺旋階段
      const { radius, ySpacing, angleMultiplier } = GALLERY_LAYOUT_PARAMS.helix;
      
      // 全体の中心を原点に持ってくる
      const yOffset = ((safeTotal - 1) * ySpacing) / 2;
      const helixY = -(index * ySpacing) + yOffset;
      const helixAngle = index * angleMultiplier;

      return [
        radius * Math.cos(helixAngle),
        helixY,
        radius * Math.sin(helixAngle),
      ];
    }

    case 'wormhole': {
      // トーラス・ノット (三葉結び目風)
      const p = 2; // 経度回転
      const q = 3; // 緯度回転
      
      const { radius, zSpacing } = GALLERY_LAYOUT_PARAMS.wormhole;
      
      const t = (index / safeTotal) * Math.PI * 2;
      const tubeRadius = zSpacing || 4; // 管の太さ
      const r = radius + tubeRadius * Math.cos(q * t);

      return [
        r * Math.cos(p * t),
        r * Math.sin(p * t),
        tubeRadius * Math.sin(q * t)
      ];
    }

    default:
      return [0, 0, 0];
  }
}