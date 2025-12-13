"use client";

import React, { Component, ReactNode, useCallback, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useState, useEffect, Suspense } from "react";
import { Mesh } from "three";
import { Environment, useTexture, PresentationControls, OrbitControls } from "@react-three/drei";
import { useAuth } from "@/hooks/useAuth";
import { useEntries } from "@/hooks/useEntries";
import { useImageUpload } from "@/hooks/useImageUpload";
import { ErrorToast } from "@/components/ErrorToast";
import { SuccessToast } from "@/components/SuccessToast";
import { Entry, ViewMode, GalleryLayout, FillMode } from "@/types";
import { CUBE_FACE_CONFIG, CUBE_FACE_COUNT, DUMMY_IMG, CAMERA_POSITIONS } from "@/constants/cube";
import { getPosition } from "@/utils/position";
import { supabase } from "@/lib/supabaseClient";
import { generateGuestCubeImages } from "@/constants/guestImages";

// 🛡️ エラー防波堤
class TextureErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ⏳ ローディング画面コンポーネント
function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in cursor-wait">
      <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-white text-lg font-bold tracking-widest animate-pulse">{message}</p>
    </div>
  );
}

// 📦 展開図形式の入力コンポーネント
function CubeNetInput({ 
  faces, 
  onFileChange, 
  onRemove 
}: { 
  faces: (File | null)[], 
  onFileChange: (index: number, file: File) => void,
  onRemove: (index: number) => void
}) {
  const handleFileInput = (onFileSelect: (file: File) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) onFileSelect(file);
    };
    input.click();
  };
  const [previewUrls, setPreviewUrls] = useState<(string | null)[]>(Array(CUBE_FACE_COUNT).fill(null));

  useEffect(() => {
    const newUrls = faces.map(file => file ? URL.createObjectURL(file) : null);
    setPreviewUrls(newUrls);
    return () => {
      newUrls.forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [faces]);

  const faceConfig = CUBE_FACE_CONFIG;

  return (
    <div className="grid grid-cols-4 grid-rows-3 gap-2 w-64 h-48 mx-auto my-4 scale-90 md:scale-100">
      {faceConfig.map((face) => {
        const file = faces[face.index];
        const previewUrl = previewUrls[face.index];

        return (
          <div
            key={face.name}
            className={`relative border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer overflow-hidden transition-colors ${file ? 'border-white bg-gray-800' : 'border-gray-600 hover:border-gray-400 bg-gray-900/50'}`}
            style={{
              gridColumn: face.col,
              gridRow: face.row,
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) {
                onFileChange(face.index, e.dataTransfer.files[0]);
              }
            }}
            onClick={() => handleFileInput((file) => onFileChange(face.index, file))}
          >
            {previewUrl ? (
              <>
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${previewUrl})` }} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(face.index);
                  }}
                  className="absolute top-0 right-0 bg-white text-black w-5 h-5 flex items-center justify-center rounded-bl text-xs hover:bg-gray-200"
                >
                  ×
                </button>
              </>
            ) : (
              <span className="text-[10px] md:text-xs text-gray-500 font-mono">{face.name}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 🗺️ 展開図コンポーネント
function CubeNet({ 
  images, 
  onImageUpdate 
}: { 
  images: (string | File)[], 
  onImageUpdate?: (index: number, file: File) => void 
}) {
  const [displayUrls, setDisplayUrls] = useState<(string | null)[]>(Array(CUBE_FACE_COUNT).fill(null));

  useEffect(() => {
    const newUrls = images.map(item => {
      if (item instanceof File) return URL.createObjectURL(item);
      return typeof item === 'string' ? item : null;
    });
    setDisplayUrls(newUrls);
    return () => {
      newUrls.forEach((url, i) => {
        if (images[i] instanceof File && url) URL.revokeObjectURL(url);
      });
    };
  }, [images]);

  const faces = CUBE_FACE_CONFIG;

  return (
    <div className="grid grid-cols-4 grid-rows-3 gap-1 w-48 h-36 mx-auto">
      {faces.map((face) => {
        const url = displayUrls[face.index] || "";
        let isColor = false;
        if (url.startsWith('color:')) {
          isColor = true;
        }

        const style = isColor 
          ? { backgroundColor: url.replace('color:', '') } 
          : { backgroundImage: `url(${url})` };

        const isEditable = !!onImageUpdate;

        return (
          <div
            key={face.name}
            className={`relative bg-gray-800 border border-white/20 rounded-sm overflow-hidden group ${isEditable ? 'cursor-pointer hover:border-white' : 'cursor-help'}`}
            style={{
              gridColumn: face.col,
              gridRow: face.row,
            }}
            title={isEditable ? `Edit ${face.name}` : `${face.name} Face`}
            onDragOver={(e) => {
              if (isEditable) e.preventDefault();
            }}
            onDrop={(e) => {
              if (isEditable) {
                e.preventDefault();
                if (e.dataTransfer.files?.[0] && onImageUpdate) {
                  onImageUpdate(face.index, e.dataTransfer.files[0]);
                }
              }
            }}
            onClick={() => {
              if (isEditable && onImageUpdate) {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) onImageUpdate(face.index, f);
                };
                input.click();
              }
            }}
          >
            {
              !isColor && url === "" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-700/50">
                  <span className="text-[8px] text-gray-500 font-mono">+</span>
                </div>
              ) : (
                <div 
                  className={`absolute inset-0 ${!isColor ? 'bg-cover bg-center' : ''}`}
                  style={style}
                />
              )
            }
            <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${isEditable ? 'bg-blue-500/40 opacity-0 group-hover:opacity-100' : 'bg-black/60 opacity-0 group-hover:opacity-100'}`}>
              <span className="text-[10px] text-white font-mono font-bold uppercase">
                {isEditable ? 'EDIT' : face.name}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 📦 汎用キューブコンポーネント
function TexturedCube({ 
  images, 
  position = [0, 0, 0], 
  onClick,
  enableHoverEffect = true
}: { 
  images: (string | File)[], 
  position?: [number, number, number],
  onClick?: () => void,
  enableHoverEffect?: boolean
}) {
  const meshRef = useRef<Mesh>(null!);
  const [hovered, setHover] = useState(false);
  
  const textureMap = useMemo(() => {
    const urls: string[] = [];
    const mapping: number[] = [];

    images.forEach((item, i) => {
      if (item instanceof File) {
        urls.push(URL.createObjectURL(item));
        mapping[i] = urls.length - 1;
      } else if (typeof item === 'string' && !item.startsWith('color:')) {
        // 外部URLはすべてプロキシ経由で使用
        urls.push(`/api/proxy?url=${encodeURIComponent(item)}`);
        mapping[i] = urls.length - 1;
      } else {
        mapping[i] = -1;
      }
    });
    return { urls, mapping };
  }, [images]);

  const loadUrls = textureMap.urls.length > 0 ? textureMap.urls : [DUMMY_IMG];
  const textures = useTexture(loadUrls);

  useFrame((_state, delta) => {
    if (enableHoverEffect && meshRef.current) {
      // ホバー時のふわふわアニメーション
      if (hovered) {
        meshRef.current.rotation.x += delta * 0.5;
        meshRef.current.rotation.y += delta * 0.5;
        meshRef.current.scale.lerp({ x: 1.1, y: 1.1, z: 1.1 } as any, delta * 5);
      } else {
        meshRef.current.scale.lerp({ x: 1, y: 1, z: 1 } as any, delta * 5);
      }
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick && onClick();
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <boxGeometry args={[2, 2, 2]} />
      {images.map((item, i) => {
        if (typeof item === 'string' && item.startsWith('color:')) {
          return <meshStandardMaterial key={i} attach={`material-${i}`} color={item.replace('color:', '')} />;
        }
        
        const texIndex = textureMap.mapping[i];
        if (texIndex !== -1 && textures.length > texIndex) {
           const texArray = Array.isArray(textures) ? textures : [textures];
           return <meshStandardMaterial key={i} attach={`material-${i}`} map={texArray[texIndex]} />;
        }
        
        return <meshStandardMaterial key={i} attach={`material-${i}`} color="#666" />;
      })}
    </mesh>
  );
}

// 📦 フォールバック用キューブ
function FallbackCube({ position = [0, 0, 0], color = "#444" }: { position?: [number, number, number], color?: string }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color={color} wireframe />
    </mesh>
  );
}

// 🎥 カメラ位置更新コンポーネント (モード切替時のスムーズな移動を担当)
function CameraPositionUpdater({ viewMode }: { viewMode: 'single' | 'gallery' }) {
  const { camera, size } = useThree();
  
  useEffect(() => {
    const isMobile = size.width < 768;
    const target = isMobile 
      ? CAMERA_POSITIONS[viewMode].mobile 
      : CAMERA_POSITIONS[viewMode].desktop;

    // モード切り替え時にカメラを所定位置へリセット
    // スムーズなアニメーションはOrbitControlsのdampingに任せるか、必要に応じてLerpする
    camera.position.set(target.x, target.y, target.z);
    camera.lookAt(0, 0, 0);
  }, [viewMode, size.width, camera]);

  return null;
}

export default function Home() {
  const { user, loading: authLoading, signIn, signUp, signOut, signInAsGuest } = useAuth();
  const { entries, loading: entriesLoading, fetchEntries } = useEntries(user);
  const { uploadFile, compressing, uploading } = useImageUpload();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [galleryLayout, setGalleryLayout] = useState<GalleryLayout>('sphere');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [faces, setFaces] = useState<(File | null)[]>(Array(CUBE_FACE_COUNT).fill(null)); 
  const [fillMode, setFillMode] = useState<FillMode>('repeat'); 
  const [solidColor, setSolidColor] = useState('#888888'); 

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editImages, setEditImages] = useState<(string | File)[]>([]);
  const [editContent, setEditContent] = useState("");
  const [isEditing, setIsEditing] = useState(false); 

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const loading = authLoading || entriesLoading || uploading;

  const getImageUrls = useCallback((entry: Entry | undefined): string[] => {
    if (!entry) return [];
    const urls = entry.image_urls || [];
    if (user?.isGuest && urls.length < CUBE_FACE_COUNT) {
      return generateGuestCubeImages(urls);
    }
    return urls;
  }, [user?.isGuest]);

  useEffect(() => {
    if (entries.length > 0 && entries[selectedIndex]) {
      const entry = entries[selectedIndex];
      const urls = getImageUrls(entry);
      const filledImages = Array(CUBE_FACE_COUNT).fill(null).map((_, i) => 
        urls[i % urls.length] || 'color:#000000'
      );
      setEditImages(filledImages);
      setEditContent(entry.content);
      setIsEditing(false);
    }
  }, [selectedIndex, entries, getImageUrls]);

  // Auth/Submit/Update/Delete Handlers (省略せずそのまま)
  const handleAuth = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const result = isSignUp ? await signUp(email, password) : await signIn(email, password);
    if (!result.success) {
      setErrorMessage(result.error || '認証に失敗しました');
    } else if (isSignUp) {
      setSuccessMessage("登録確認メールを送信しました。");
    }
  }, [email, password, isSignUp, signIn, signUp]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMessage('ユーザーが認証されていません');
      return;
    }
    const hasImage = faces.some(f => f !== null);
    if (fillMode === 'repeat' && !hasImage) {
      setErrorMessage("リピートモードでは少なくとも1枚の画像が必要です。");
      return;
    }
    try {
      const uploadedUrls: (string | null)[] = await Promise.all(
        faces.map(async (file, index) => {
          if (!file) return null;
          return await uploadFile(file, index);
        })
      );
      const validUrls = uploadedUrls.filter((u): u is string => u !== null);
      const finalImageUrls = uploadedUrls.map((url, i) => {
        if (url) return url;
        if (fillMode === 'color') return `color:${solidColor}`;
        if (validUrls.length === 0) return 'color:#000000';
        return validUrls[i % validUrls.length];
      });

      const { error: dbError } = await supabase
        .from('entries')
        .insert([{ 
          content: newContent, 
          image_urls: finalImageUrls,
          user_id: user.id
        }]);

      if (dbError) throw dbError;

      setNewContent("");
      setFaces(Array(CUBE_FACE_COUNT).fill(null));
      setIsFormOpen(false);
      fetchEntries();
      setViewMode('single');
      setSelectedIndex(0);
      setSuccessMessage('日記を保存しました');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
      setErrorMessage(`エラー: ${errorMessage}`);
    }
  }, [user, faces, fillMode, solidColor, newContent, uploadFile, fetchEntries]);

  const handleUpdate = useCallback(async () => {
    if (!entries[selectedIndex] || !user) return;
    try {
      const updatedUrls = await Promise.all(
        editImages.map(async (item, index) => {
          if (item instanceof File) {
            return await uploadFile(item, index);
          }
          return item as string;
        })
      );
      const { error } = await supabase
        .from('entries')
        .update({ content: editContent, image_urls: updatedUrls })
        .eq('id', entries[selectedIndex].id);

      if (error) throw error;
      fetchEntries();
      setIsEditing(false);
      setIsEditModalOpen(false);
      setSuccessMessage('日記を更新しました');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
      setErrorMessage(`更新エラー: ${errorMessage}`);
    }
  }, [entries, selectedIndex, editImages, editContent, uploadFile, fetchEntries, user]);

  const handleDelete = useCallback(async () => {
    if (!entries[selectedIndex]) return;
    try {
      const entryId = entries[selectedIndex].id;
      const { error } = await supabase.from('entries').delete().eq('id', entryId);
      if (error) throw error;
      setIsDeleteConfirmOpen(false);
      setSelectedIndex(0);
      fetchEntries();
      setViewMode('gallery');
      setSuccessMessage('日記を削除しました');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
      setErrorMessage(`削除エラー: ${errorMessage}`);
    }
  }, [entries, selectedIndex, fetchEntries]);

  const currentEntry = useMemo(() => entries[selectedIndex], [entries, selectedIndex]);

  // Handle Auth UI
  if (!user) {
    return (
      <main className="h-[100dvh] w-full bg-black text-white flex items-center justify-center font-sans">
        <div className="w-full max-w-md p-8 space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tighter mb-2">Cube Diary</h1>
            <p className="text-gray-400">3D空間に思い出を残そう</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">メールアドレス</label>
              <input
                type="email" required className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-white transition-colors"
                placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">パスワード</label>
              <input
                type="password" required className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-white transition-colors"
                placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" disabled={authLoading} className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50">
              {authLoading ? '処理中...' : (isSignUp ? 'アカウント作成' : 'ログイン')}
            </button>
          </form>
          <div className="text-center space-y-4">
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-gray-400 hover:text-white transition-colors block w-full">
              {isSignUp ? 'すでにアカウントをお持ちの方はログイン' : 'アカウントを作成する'}
            </button>
            <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-700"></div></div><div className="relative flex justify-center text-sm"><span className="px-4 bg-black text-gray-400">または</span></div></div>
            <button onClick={async () => { const result = await signInAsGuest(); if (!result.success) setErrorMessage(result.error || 'ゲストログインに失敗しました'); }} disabled={authLoading} className="w-full py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 border border-gray-600">
              {authLoading ? '処理中...' : '🎮 ゲストとして閲覧する'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-[100dvh] w-full bg-black text-white overflow-hidden relative font-sans touch-none">
      
      {loading && <LoadingOverlay message={compressing ? "画像を圧縮中..." : "データを保存中..."} />}

        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
          <button 
            onClick={async () => { await signOut(); }}
            className="text-xs text-gray-500 hover:text-white transition"
            aria-label={user?.isGuest ? "ゲストを終了" : "ログアウト"}
          >
            {user?.isGuest ? 'ゲストを終了' : 'ログアウト'}
          </button>
          {user?.isGuest && (
            <>
              <span className="text-xs text-gray-600 px-2 py-1 bg-gray-900 rounded border border-gray-700">
                👤 ゲストモード
              </span>
              <button
                onClick={async () => {
                  await signOut();
                  setTimeout(() => {
                    window.location.reload();
                  }, 100);
                }}
                className="text-xs text-white px-3 py-1 bg-gray-800 rounded border border-gray-700 hover:bg-gray-700 transition-colors"
              >
                アカウント作成/ログイン
              </button>
            </>
          )}
        </div>

      {errorMessage && <ErrorToast message={errorMessage} onClose={() => setErrorMessage(null)} />}
      {successMessage && <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />}

      {viewMode === 'single' && currentEntry && !isEditModalOpen && !isDeleteConfirmOpen && (
        <div className="absolute top-12 left-4 md:top-16 md:left-8 z-10 pointer-events-none animate-fade-in max-w-[80%]">
          <h1 className="text-2xl md:text-4xl font-bold mb-2 tracking-tighter">Cube Diary</h1>
          <p className="text-lg md:text-xl font-light opacity-90 line-clamp-2">"{currentEntry.content}"</p>
          <p className="text-xs md:text-sm opacity-50 mt-1 font-mono">
            {new Date(currentEntry.created_at).toLocaleString()}
          </p>
          <p className="text-xs opacity-40 mt-1">
            {selectedIndex + 1} / {entries.length}
          </p>
        </div>
      )}

      {viewMode === 'gallery' && (
        <div className="absolute top-12 left-4 md:top-16 md:left-8 z-10 pointer-events-none animate-fade-in">
          <h1 className="text-2xl md:text-4xl font-bold mb-2 tracking-tighter">
            {user?.isGuest ? 'サンプルギャラリー' : 'ギャラリー'}
          </h1>
          <p className="text-sm md:text-base opacity-70">
            {galleryLayout === 'sphere' && "黄金比スフィア"}
            {galleryLayout === 'helix' && "時間螺旋"}
            {galleryLayout === 'wormhole' && "トーラスノット"}
          </p>
        </div>
      )}

      <div className="absolute top-4 right-4 md:top-8 md:right-8 z-20 flex flex-col items-end gap-2">
        <div className="flex gap-1 md:gap-2">
          <button onClick={() => setViewMode('single')} className={`px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base rounded-lg font-bold transition ${viewMode === 'single' ? 'bg-white text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>シングル</button>
          <button onClick={() => setViewMode('gallery')} className={`px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base rounded-lg font-bold transition ${viewMode === 'gallery' ? 'bg-white text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>ギャラリー</button>
        </div>

        {viewMode === 'gallery' && (
          <div className="flex gap-1 md:gap-2 mt-2 bg-gray-800 p-1 rounded-lg">
            {(['sphere', 'helix', 'wormhole'] as const).map((layout) => (
              <button
                key={layout}
                onClick={() => setGalleryLayout(layout)}
                className={`px-2 py-1 md:px-3 text-xs md:text-sm rounded transition ${galleryLayout === layout ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {layout.charAt(0).toUpperCase() + layout.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {viewMode === 'single' && entries.length > 1 && !isEditModalOpen && !isDeleteConfirmOpen && (
        <>
          <button onClick={() => setSelectedIndex((prev) => (prev + 1) % entries.length)} className="absolute top-1/2 right-2 md:right-4 z-20 text-3xl md:text-4xl opacity-50 hover:opacity-100 transition p-2">▶</button>
          <button onClick={() => setSelectedIndex((prev) => (prev - 1 + entries.length) % entries.length)} className="absolute top-1/2 left-2 md:left-4 z-20 text-3xl md:text-4xl opacity-50 hover:opacity-100 transition p-2">◀</button>
        </>
      )}

      {viewMode === 'single' && currentEntry && !isEditModalOpen && !isDeleteConfirmOpen && !user?.isGuest && (
        <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8 z-20 flex gap-4">
          <button onClick={() => setIsEditModalOpen(true)} className="bg-gray-800 text-white w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-lg md:text-xl shadow-lg hover:bg-gray-700 transition-transform duration-200" title="編集">✏️</button>
          <button onClick={() => setIsDeleteConfirmOpen(true)} className="bg-gray-800 text-white border border-gray-600 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-lg md:text-xl shadow-lg hover:bg-white hover:text-black transition-all duration-200" title="削除">🗑️</button>
        </div>
      )}

      {/* Delete/Edit Modals (省略せずそのまま表示) */}
      {isDeleteConfirmOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in px-4">
          <div className="bg-gray-800 p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-700 text-center">
            <h3 className="text-xl font-bold text-white mb-4">削除しますか？</h3>
            <div className="flex gap-4 justify-center">
              <button onClick={() => setIsDeleteConfirmOpen(false)} className="px-6 py-2 rounded-full bg-gray-700 text-white hover:bg-gray-600 transition">キャンセル</button>
              <button onClick={handleDelete} className="px-6 py-2 rounded-full bg-white text-black hover:bg-gray-200 transition font-bold">削除</button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && currentEntry && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in px-4">
           {/* (編集モーダルの中身は変更なし) */}
           <div className="bg-gray-800/90 p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700 backdrop-blur-md max-h-[85vh] overflow-y-auto">
             <h2 className="text-2xl font-bold mb-6 text-center">日記を編集</h2>
             <div className="flex flex-col gap-6">
                <div className="bg-black/40 p-4 rounded-xl border border-white/10">
                  <h3 className="text-white text-[10px] font-bold mb-3 text-center uppercase tracking-widest opacity-70">
                    画像の配置 (クリックで編集)
                  </h3>
                  <CubeNet images={editImages} onImageUpdate={(index, file) => { const newImages = [...editImages]; newImages[index] = file; setEditImages(newImages); setIsEditing(true); }} />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">メッセージ</label>
                  <textarea 
                    className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white h-28 focus:outline-none focus:border-white" 
                    value={editContent} 
                    onChange={(e) => { setEditContent(e.target.value); setIsEditing(true); }}
                    placeholder="メッセージを入力"
                    title="メッセージを入力"
                  />
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setIsEditModalOpen(false);
                      if (entries[selectedIndex]) {
                        const entry = entries[selectedIndex];
                        const urls = getImageUrls(entry);
                        const filledImages = Array(CUBE_FACE_COUNT).fill(null).map((_, i) => 
                          urls[i % urls.length] || 'color:#000000'
                        );
                        setEditImages(filledImages);
                        setEditContent(entry.content);
                        setIsEditing(false);
                      }
                    }} 
                    className="flex-1 py-2 rounded hover:bg-gray-700 transition"
                    disabled={loading}
                  >
                    キャンセル
                  </button>
                  <button 
                    onClick={handleUpdate} 
                    disabled={!isEditing || loading} 
                    className={`flex-1 py-2 rounded font-bold transition ${isEditing ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                  >
                    {loading ? '更新中...' : '変更を保存'}
                  </button>
                </div>
             </div>
           </div>
        </div>
      )}

      <Canvas shadows className="touch-none" dpr={[1, 2]}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.3} penumbra={1} castShadow intensity={1} />
        <Environment preset="city" />

         <CameraPositionUpdater viewMode={viewMode} />

         {/* ▼▼▼ モードによる操作系統の切り替え ▼▼▼ */}
        {viewMode === 'gallery' ? (
          <>
            <OrbitControls 
              makeDefault
              enableDamping={true}
              dampingFactor={0.05}
              autoRotate={true}
              autoRotateSpeed={0.5}
              minDistance={5}
              maxDistance={60}
              target={[0, 0, 0]}
            />
            <group>
              {entries.map((entry, index) => {
                const position = getPosition(index, entries.length, galleryLayout);
                const imageUrls = getImageUrls(entry);
                const filledUrls = Array(CUBE_FACE_COUNT).fill(null).map((_, i) => imageUrls[i % imageUrls.length]);
                return (
                  <Suspense key={entry.id} fallback={<FallbackCube position={position} />}>
                    <TextureErrorBoundary fallback={<FallbackCube position={position} />}>
                       {imageUrls.length > 0 ? (
                         <TexturedCube 
                           images={filledUrls} 
                           position={position} 
                           onClick={() => { setSelectedIndex(index); setViewMode('single'); }} 
                           enableHoverEffect={true} 
                         />
                       ) : <FallbackCube position={position} />}
                    </TextureErrorBoundary>
                  </Suspense>
                );
              })}
              {/* 未来のキューブ (プレースホルダー) */}
              {Array.from({ length: 8 }).map((_, i) => {
                 const futureIndex = entries.length + i;
                 const position = getPosition(futureIndex, entries.length + 8, galleryLayout);
                 return <FallbackCube key={`future-${futureIndex}`} position={position} color="#333" />;
              })}
            </group>
          </>
        ) : (
          /* シングルモード: 物を回す */
          currentEntry && (
            <PresentationControls 
              global 
              rotation={[0, 0, 0]} 
              polar={[-Math.PI / 2, Math.PI / 2]}
              azimuth={[-Infinity, Infinity]} 
              speed={1.5}
            >
              <Suspense fallback={<FallbackCube />}>
                <TextureErrorBoundary fallback={<FallbackCube />}>
                  <TexturedCube 
                    images={isEditModalOpen ? editImages : getImageUrls(currentEntry)} 
                    enableHoverEffect={false} 
                  />
                </TextureErrorBoundary>
              </Suspense>
            </PresentationControls>
          )
        )}
      </Canvas>

      {!isFormOpen && !isEditModalOpen && !isDeleteConfirmOpen && !user?.isGuest && (
        <button
          onClick={() => setIsFormOpen(true)}
          className="absolute bottom-6 right-6 md:bottom-8 md:right-8 z-20 bg-white text-black w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-2xl shadow-lg hover:scale-110 transition-transform duration-200"
        >
          ＋
        </button>
      )}

      {/* 新規作成フォーム (変更なし) */}
      {isFormOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
           {/* ... フォームの中身 (CubeNetInputなど) は元のコードと同じ ... */}
           <div className="bg-gray-800 p-4 md:p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 max-h-[85vh] overflow-y-auto">
             <h2 className="text-2xl font-bold mb-4 text-center">新しい日記を作成</h2>
             <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                <CubeNetInput 
                   faces={faces} 
                   onFileChange={(index, file) => { const newFaces = [...faces]; newFaces[index] = file; setFaces(newFaces); }} 
                   onRemove={(index) => { const newFaces = [...faces]; newFaces[index] = null; setFaces(newFaces); }} 
                />
                {/* 塗りつぶしモード選択など */}
                <div className="bg-gray-900/50 p-4 rounded-lg">
                   <label className="block text-sm text-gray-400 mb-2">画像がない面の埋め方:</label>
                   <div className="flex gap-4 flex-col md:flex-row">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="fillMode" 
                          checked={fillMode === 'repeat'} 
                          onChange={() => setFillMode('repeat')} 
                          className="accent-white" 
                        />
                        <span className="text-sm">画像をリピート</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="fillMode" 
                          checked={fillMode === 'color'} 
                          onChange={() => setFillMode('color')} 
                          className="accent-white" 
                        />
                        <span className="text-sm">単色で塗りつぶす</span>
                      </label>
                   </div>
                   {fillMode === 'color' && (
                     <div className="mt-3 flex items-center gap-3 animate-fade-in">
                       <input 
                         type="color" 
                         value={solidColor} 
                         onChange={(e) => setSolidColor(e.target.value)} 
                         className="h-8 w-16 cursor-pointer rounded bg-transparent"
                         aria-label="色を選択"
                         title="色を選択"
                       />
                       <span className="text-sm text-gray-300 font-mono">{solidColor}</span>
                     </div>
                   )}
                </div>
                <textarea required className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white h-16 md:h-20" value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="今日はどんな一日でしたか？" />
                <div className="flex gap-3 pt-2">
                   <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-2 rounded hover:bg-gray-700 transition">キャンセル</button>
                   <button type="submit" disabled={loading} className="flex-1 py-2 bg-white text-black rounded hover:bg-gray-200 transition font-bold disabled:opacity-50">{loading ? '保存中...' : '保存する'}</button>
                </div>
             </form>
           </div>
        </div>
      )}
    </main>
  );
}