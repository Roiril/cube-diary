// ゲスト用フリー画像URLリスト
// Picsum Photosを使用（CORS対応、ランダム画像）
// 各画像は異なるIDを使用してランダム性を確保
export const GUEST_FREE_IMAGES = [
  // 自然・風景系（様々なIDでランダムな画像を取得）
  'https://picsum.photos/800/800?random=1',
  'https://picsum.photos/800/800?random=2',
  'https://picsum.photos/800/800?random=3',
  'https://picsum.photos/800/800?random=4',
  'https://picsum.photos/800/800?random=5',
  'https://picsum.photos/800/800?random=6',
  'https://picsum.photos/800/800?random=7',
  'https://picsum.photos/800/800?random=8',
  'https://picsum.photos/800/800?random=9',
  'https://picsum.photos/800/800?random=10',
  'https://picsum.photos/800/800?random=11',
  'https://picsum.photos/800/800?random=12',
  'https://picsum.photos/800/800?random=13',
  'https://picsum.photos/800/800?random=14',
  'https://picsum.photos/800/800?random=15',
  'https://picsum.photos/800/800?random=16',
  'https://picsum.photos/800/800?random=17',
  'https://picsum.photos/800/800?random=18',
  'https://picsum.photos/800/800?random=19',
  'https://picsum.photos/800/800?random=20',
  'https://picsum.photos/800/800?random=21',
  'https://picsum.photos/800/800?random=22',
  'https://picsum.photos/800/800?random=23',
  'https://picsum.photos/800/800?random=24',
  'https://picsum.photos/800/800?random=25',
  'https://picsum.photos/800/800?random=26',
  'https://picsum.photos/800/800?random=27',
  'https://picsum.photos/800/800?random=28',
  'https://picsum.photos/800/800?random=29',
  'https://picsum.photos/800/800?random=30',
  'https://picsum.photos/800/800?random=31',
  'https://picsum.photos/800/800?random=32',
  'https://picsum.photos/800/800?random=33',
  'https://picsum.photos/800/800?random=34',
  'https://picsum.photos/800/800?random=35',
  'https://picsum.photos/800/800?random=36',
  'https://picsum.photos/800/800?random=37',
  'https://picsum.photos/800/800?random=38',
  'https://picsum.photos/800/800?random=39',
  'https://picsum.photos/800/800?random=40',
];

// ランダムに画像を取得する関数
export function getRandomGuestImage(): string {
  const randomIndex = Math.floor(Math.random() * GUEST_FREE_IMAGES.length);
  return GUEST_FREE_IMAGES[randomIndex];
}

// キューブの6面分の画像を生成する関数
export function generateGuestCubeImages(existingImages: string[] = []): string[] {
  const CUBE_FACE_COUNT = 6;
  const images: string[] = [];
  
  // 既存の画像があれば使用
  for (let i = 0; i < CUBE_FACE_COUNT; i++) {
    if (existingImages[i]) {
      images.push(existingImages[i]);
    } else {
      // ランダムに画像を選択（同じ画像が連続しないようにする）
      let image = getRandomGuestImage();
      if (i > 0 && images[i - 1] === image) {
        image = getRandomGuestImage();
      }
      images.push(image);
    }
  }
  
  return images;
}

