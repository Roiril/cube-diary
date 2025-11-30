"use client";

import React, { Component, ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useState, useEffect, Suspense, useMemo } from "react";
import { Mesh, Vector3, MathUtils } from "three";
import { Environment, useTexture, ContactShadows, PresentationControls } from "@react-three/drei";
import { supabase } from "@/lib/supabaseClient";
import imageCompression from 'browser-image-compression';

// 🛡️ エラー防波堤
class TextureErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
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

// ⏳ ローディング画面コンポーネント (色は白黒に)
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
  const [previewUrls, setPreviewUrls] = useState<(string | null)[]>(Array(6).fill(null));

  useEffect(() => {
    const newUrls = faces.map(file => file ? URL.createObjectURL(file) : null);
    setPreviewUrls(newUrls);
    return () => {
      newUrls.forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [faces]);

  const faceConfig = [
    { name: 'Top', index: 2, col: 2, row: 1 },
    { name: 'Left', index: 1, col: 1, row: 2 },
    { name: 'Front', index: 4, col: 2, row: 2 },
    { name: 'Right', index: 0, col: 3, row: 2 },
    { name: 'Back', index: 5, col: 4, row: 2 },
    { name: 'Bottom', index: 3, col: 2, row: 3 },
  ];

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
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = (e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (f) onFileChange(face.index, f);
              };
              input.click();
            }}
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
  const [displayUrls, setDisplayUrls] = useState<(string | null)[]>(Array(6).fill(null));

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

  const faces = [
    { name: 'Top', index: 2, col: 2, row: 1 },
    { name: 'Left', index: 1, col: 1, row: 2 },
    { name: 'Front', index: 4, col: 2, row: 2 },
    { name: 'Right', index: 0, col: 3, row: 2 },
    { name: 'Back', index: 5, col: 4, row: 2 },
    { name: 'Bottom', index: 3, col: 2, row: 3 },
  ];

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
        urls.push(`/api/proxy?url=${encodeURIComponent(item)}`);
        mapping[i] = urls.length - 1;
      } else {
        mapping[i] = -1;
      }
    });
    return { urls, mapping };
  }, [images]);

  const DUMMY_IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const loadUrls = textureMap.urls.length > 0 ? textureMap.urls : [DUMMY_IMG];
  const textures = useTexture(loadUrls);

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
      scale={1}
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

// 🎥 カメラ制御コンポーネント
function CameraController({ viewMode }: { viewMode: 'single' | 'gallery' }) {
  const { size } = useThree();
  const targetPos = useRef(new Vector3());
  const targetLookAt = new Vector3(0, 0, 0);

  const targetDistance = useRef(0);

  useEffect(() => {
    const isMobile = size.width < 768;

    if (viewMode === 'single') {
      targetPos.current.set(0, 0, isMobile ? 7 : 5.5);
      targetDistance.current = isMobile ? 7 : 5.5;
    } else {
      targetPos.current.set(0, 12, isMobile ? 22 : 16);
      targetDistance.current = new Vector3(0, 12, isMobile ? 22 : 16).length();
    }
  }, [viewMode, size.width]); 

  useFrame((state, delta) => {
    const position = state.camera.position;
    state.camera.position.lerp(targetPos.current, delta * 3);
    state.camera.lookAt(targetLookAt);
  });

  return null;
}


export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const [entries, setEntries] = useState<any[]>([]);
  // ★ 初期値を 'gallery' に変更
  const [viewMode, setViewMode] = useState<'single' | 'gallery'>('gallery');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [galleryLayout, setGalleryLayout] = useState<'sphere' | 'helix' | 'wormhole'>('sphere');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [faces, setFaces] = useState<(File | null)[]>(Array(6).fill(null)); 
  const [fillMode, setFillMode] = useState<'repeat' | 'color'>('repeat'); 
  const [solidColor, setSolidColor] = useState('#888888'); 

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editImages, setEditImages] = useState<(string | File)[]>([]);
  const [editContent, setEditContent] = useState("");
  const [isEditing, setIsEditing] = useState(false); 

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchEntries(session.user.id);
      } else {
        setEntries([]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = isSignUp 
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      alert(error.message);
    } else if (isSignUp) {
      alert("登録確認メールを送信しました。");
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const fetchEntries = async (userId?: string) => {
    const targetId = userId || user?.id;
    if (!targetId) return;

    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false });

    if (data) setEntries(data);
    if (error) console.error("Error fetching:", error);
  };

  const getImageUrls = (entry: any): string[] => {
    if (!entry) return [];
    if (Array.isArray(entry.image_urls)) return entry.image_urls;
    if (typeof entry.image_url === 'string') return [entry.image_url];
    if (typeof entry.image_urls === 'string') {
        try { return JSON.parse(entry.image_urls); } catch { return []; }
    }
    return [];
  };

  useEffect(() => {
    if (entries.length > 0 && entries[selectedIndex]) {
      const entry = entries[selectedIndex];
      const urls = getImageUrls(entry);
      const filledImages = Array(6).fill(null).map((_, i) => urls[i % urls.length] || 'color:#000000');
      setEditImages(filledImages);
      setEditContent(entry.content);
      setIsEditing(false);
    }
  }, [selectedIndex, entries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const hasImage = faces.some(f => f !== null);
    if (fillMode === 'repeat' && !hasImage) {
      alert("リピートモードでは少なくとも1枚の画像が必要です。");
      return;
    }

    setLoading(true);
    setCompressing(true);

    try {
      const uploadedUrls: (string | null)[] = await Promise.all(faces.map(async (file, index) => {
        if (!file) return null;
        return await uploadFile(file, index);
      }));

      setCompressing(false);

      const validUrls = uploadedUrls.filter(u => u !== null) as string[];
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
      setFaces(Array(6).fill(null));
      setIsFormOpen(false);
      fetchEntries();
      // 投稿後はそのキューブを見るためSingleモードへ切り替える
      setViewMode('single');
      setSelectedIndex(0);

    } catch (error: any) {
      alert('エラー: ' + error.message);
      setCompressing(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditModalOpen(false);
    if (entries[selectedIndex]) {
      const entry = entries[selectedIndex];
      const urls = getImageUrls(entry);
      const filledImages = Array(6).fill(null).map((_, i) => urls[i % urls.length] || 'color:#000000');
      setEditImages(filledImages);
      setEditContent(entry.content);
      setIsEditing(false);
    }
  };

  const handleUpdate = async () => {
    if (!entries[selectedIndex]) return;
    setLoading(true);
    
    try {
      const updatedUrls = await Promise.all(editImages.map(async (item, index) => {
        if (item instanceof File) {
          return await uploadFile(item, index);
        }
        return item as string;
      }));

      const { error } = await supabase
        .from('entries')
        .update({ content: editContent, image_urls: updatedUrls })
        .eq('id', entries[selectedIndex].id);

      if (error) throw error;

      fetchEntries();
      setIsEditing(false);
      setIsEditModalOpen(false);

    } catch (error: any) {
      alert('更新エラー: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!entries[selectedIndex]) return;
    setLoading(true);

    try {
      const entryId = entries[selectedIndex].id;
      
      const { error } = await supabase
        .from('entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      setIsDeleteConfirmOpen(false);
      setSelectedIndex(0);
      fetchEntries();
      // 削除後はギャラリーに戻るのが自然（もし0件になった場合なども考慮）
      setViewMode('gallery');

    } catch (error: any) {
      alert('削除エラー: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File, index: number): Promise<string> => {
    const compressionOptions = {
      maxSizeMB: 0.15,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.6
    };

    let fileToUpload = file;
    try {
      const compressedFile = await imageCompression(file, compressionOptions);
      fileToUpload = new File([compressedFile], file.name, { type: compressedFile.type });
    } catch (error) {
      console.error("圧縮失敗:", error);
    }

    const fileExt = fileToUpload.type.split('/')[1] || 'jpg';
    const fileName = `${Math.random().toString(36).substring(2)}_${index}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage.from('cube-images').upload(filePath, fileToUpload);
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('cube-images').getPublicUrl(filePath);
    return publicUrl;
  };

  const getPosition = (index: number, total: number, layout: 'sphere' | 'helix' | 'wormhole'): [number, number, number] => {
    switch (layout) {
      case 'sphere':
        const phi = Math.acos(-1 + (2 * index) / total);
        const theta = Math.sqrt(total * Math.PI) * phi;
        const r = Math.cbrt(total) * 3.5;
        return [
          r * Math.cos(theta) * Math.sin(phi),
          r * Math.sin(theta) * Math.sin(phi),
          r * Math.cos(phi)
        ];
      case 'helix':
        const helixR = 4;
        const helixY = (index - total / 2) * 1.5;
        const helixAngle = index * 0.8;
        return [
          helixR * Math.cos(helixAngle),
          helixY,
          helixR * Math.sin(helixAngle)
        ];
      case 'wormhole':
        const tunnelR = 5;
        const tunnelZ = (index - total / 2) * 3;
        const tunnelAngle = index * 0.5;
        return [
          tunnelR * Math.cos(tunnelAngle),
          tunnelR * Math.sin(tunnelAngle),
          tunnelZ
        ];
      default:
        return [0, 0, 0];
    }
  };

  const currentEntry = entries[selectedIndex];

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
              <label className="block text-sm font-medium text-gray-400 mb-2">
                メールアドレス
              </label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-white transition-colors"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                パスワード
              </label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-white transition-colors"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {loading ? '処理中...' : (isSignUp ? 'アカウント作成' : 'ログイン')}
            </button>
          </form>
          <div className="text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {isSignUp ? 'すでにアカウントをお持ちの方はログイン' : 'アカウントを作成する'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-[100dvh] w-full bg-black text-white overflow-hidden relative font-sans touch-none">
      
      {loading && (
        <LoadingOverlay message={compressing ? "画像を圧縮中..." : "データを保存中..."} />
      )}

      <button 
        onClick={handleSignOut}
        className="absolute top-4 left-4 z-20 text-xs text-gray-500 hover:text-white transition"
      >
        ログアウト
      </button>

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
          <h1 className="text-2xl md:text-4xl font-bold mb-2 tracking-tighter">ギャラリー</h1>
          <p className="text-sm md:text-base opacity-70">ドラッグして視点を回転</p>
        </div>
      )}

      <div className="absolute top-4 right-4 md:top-8 md:right-8 z-20 flex flex-col items-end gap-2">
        <div className="flex gap-1 md:gap-2">
          <button
            onClick={() => setViewMode('single')}
            className={`px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base rounded-lg font-bold transition ${viewMode === 'single' ? 'bg-white text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            シングル
          </button>
          <button
            onClick={() => setViewMode('gallery')}
            className={`px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base rounded-lg font-bold transition ${viewMode === 'gallery' ? 'bg-white text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            ギャラリー
          </button>
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
          <button
            onClick={() => setSelectedIndex((prev) => (prev + 1) % entries.length)}
            className="absolute top-1/2 right-2 md:right-4 z-20 text-3xl md:text-4xl opacity-50 hover:opacity-100 transition p-2"
          >
            ▶
          </button>
          <button
            onClick={() => setSelectedIndex((prev) => (prev - 1 + entries.length) % entries.length)}
            className="absolute top-1/2 left-2 md:left-4 z-20 text-3xl md:text-4xl opacity-50 hover:opacity-100 transition p-2"
          >
            ◀
          </button>
        </>
      )}

      {viewMode === 'single' && currentEntry && !isEditModalOpen && !isDeleteConfirmOpen && (
        <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8 z-20 flex gap-4">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="bg-gray-800 text-white w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-lg md:text-xl shadow-lg hover:bg-gray-700 transition-transform duration-200"
            title="編集"
          >
            ✏️
          </button>
          <button
            onClick={() => setIsDeleteConfirmOpen(true)}
            className="bg-gray-800 text-white border border-gray-600 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-lg md:text-xl shadow-lg hover:bg-white hover:text-black transition-all duration-200"
            title="削除"
          >
            🗑️
          </button>
        </div>
      )}

      {isDeleteConfirmOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in px-4">
          <div className="bg-gray-800 p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-700 text-center">
            <h3 className="text-xl font-bold text-white mb-4">この日記を削除しますか？</h3>
            <p className="text-gray-400 mb-8">この操作は取り消せません。</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-6 py-2 rounded-full bg-gray-700 text-white hover:bg-gray-600 transition"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                className="px-6 py-2 rounded-full bg-white text-black hover:bg-gray-200 transition font-bold"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && currentEntry && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in px-4">
          <div className="bg-gray-800/90 p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700 backdrop-blur-md max-h-[85vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-center">日記を編集</h2>
            <div className="flex flex-col gap-6">
              <div className="bg-black/40 p-4 rounded-xl border border-white/10">
                <h3 className="text-white text-[10px] font-bold mb-3 text-center uppercase tracking-widest opacity-70">
                  画像の配置 (ドラッグ移動で入替可)
                </h3>
                <CubeNet 
                  images={editImages} 
                  onImageUpdate={(index, file) => {
                    const newImages = [...editImages];
                    newImages[index] = file;
                    setEditImages(newImages);
                    setIsEditing(true);
                  }}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">メッセージ</label>
                <textarea
                  className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white focus:outline-none focus:border-white h-28"
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    setIsEditing(true);
                  }}
                />
              </div>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 py-2 rounded hover:bg-gray-700 transition"
                  disabled={loading}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={!isEditing || loading}
                  className={`flex-1 py-2 rounded font-bold transition ${
                    isEditing 
                      ? 'bg-white text-black hover:bg-gray-200' 
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {loading ? '更新中...' : '変更を保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Canvas shadows className="touch-none">
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.3} penumbra={1} castShadow intensity={1} />
        <Environment preset="city" />

        <CameraController viewMode={viewMode} />

        {viewMode === 'single' && currentEntry && (
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
        )}

        {viewMode === 'gallery' && (
          <PresentationControls 
            global 
            rotation={[0, 0, 0]}
            polar={[-Math.PI / 4, Math.PI / 4]} 
            azimuth={[-Infinity, Infinity]}
            speed={1.0}
          >
            <group>
              {entries.map((entry, index) => {
                const position = getPosition(index, entries.length, galleryLayout);
                const imageUrls = getImageUrls(entry);
                const filledUrls = Array(6).fill(null).map((_, i) => imageUrls[i % imageUrls.length]);

                return (
                  <Suspense key={entry.id} fallback={<FallbackCube position={position} />}>
                    <TextureErrorBoundary fallback={<FallbackCube position={position} />}>
                      {imageUrls.length > 0 ? (
                        <TexturedCube 
                          images={filledUrls} 
                          position={position} 
                          onClick={() => {
                            setSelectedIndex(index);
                            setViewMode('single');
                          }}
                          enableHoverEffect={true} 
                        />
                      ) : (
                        <FallbackCube position={position} />
                      )}
                    </TextureErrorBoundary>
                  </Suspense>
                );
              })}

              {Array.from({ length: 8 }).map((_, i) => {
                const futureIndex = entries.length + i;
                const position = getPosition(futureIndex, entries.length + 8, galleryLayout);
                return (
                  <FallbackCube 
                    key={`future-${futureIndex}`} 
                    position={position} 
                    color="#333" 
                  />
                );
              })}

            </group>
          </PresentationControls>
        )}

      </Canvas>

      {!isFormOpen && !isEditModalOpen && !isDeleteConfirmOpen && (
        <button
          onClick={() => setIsFormOpen(true)}
          className="absolute bottom-6 right-6 md:bottom-8 md:right-8 z-20 bg-white text-black w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-2xl shadow-lg hover:scale-110 transition-transform duration-200"
        >
          ＋
        </button>
      )}

      {isFormOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-gray-800 p-4 md:p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 max-h-[85vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 text-center">新しい日記を作成</h2>
            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2 text-center">画像をドラッグ＆ドロップ</label>
                <CubeNetInput 
                  faces={faces} 
                  onFileChange={(index, file) => {
                    const newFaces = [...faces];
                    newFaces[index] = file;
                    setFaces(newFaces);
                  }}
                  onRemove={(index) => {
                    const newFaces = [...faces];
                    newFaces[index] = null;
                    setFaces(newFaces);
                  }}
                />
              </div>
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
                    />
                    <span className="text-sm text-gray-300 font-mono">{solidColor}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">メッセージ</label>
                <textarea
                  required
                  className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white h-16 md:h-20 focus:outline-none focus:border-white"
                  placeholder="今日はどんな一日でしたか？"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-2 rounded hover:bg-gray-700 transition" disabled={loading}>キャンセル</button>
                <button type="submit" disabled={loading} className="flex-1 py-2 bg-white text-black rounded hover:bg-gray-200 transition font-bold disabled:opacity-50">
                  {loading ? (compressing ? '画像を圧縮中...' : 'アップロード中...') : '保存する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}