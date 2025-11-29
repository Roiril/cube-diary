"use client";

import React, { Component, ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useState, useEffect, Suspense } from "react";
// MathUtils を追加インポート
import { Mesh, Vector3, MathUtils } from "three";
import { OrbitControls, Environment, useTexture, Text, ContactShadows } from "@react-three/drei";
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

// 📦 汎用キューブコンポーネント
function TexturedCube({ 
  imageUrls, 
  position = [0, 0, 0], 
  onClick 
}: { 
  imageUrls: string[], 
  position?: [number, number, number],
  onClick?: () => void
}) {
  const meshRef = useRef<Mesh>(null!);
  const [hovered, setHover] = useState(false);
  
  const filledUrls = Array(6).fill(null).map((_, i) => {
    return imageUrls[i % imageUrls.length];
  });
  const proxyUrls = filledUrls.map(url => `/api/proxy?url=${encodeURIComponent(url)}`);
  const textures = useTexture(proxyUrls);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * (hovered ? 0.5 : 0.1);
      meshRef.current.rotation.y += delta * (hovered ? 0.5 : 0.1);
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
      scale={hovered ? 1.1 : 1}
    >
      <boxGeometry args={[2, 2, 2]} />
      {textures.map((texture, i) => (
        <meshStandardMaterial key={i} attach={`material-${i}`} map={texture} />
      ))}
    </mesh>
  );
}

// 📦 フォールバック用キューブ
function FallbackCube({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#666" wireframe />
    </mesh>
  );
}

// 🗺️ 床コンポーネント
function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.5} />
    </mesh>
  );
}

// 🎥 カメラ制御コンポーネント（修正版）
function CameraController({ viewMode }: { viewMode: 'single' | 'gallery' }) {
  // 目標とする「距離」を設定
  // Single: 近く (6), Gallery: 遠く (15)
  const targetDistance = viewMode === 'single' ? 6 : 15;

  useFrame((state, delta) => {
    const position = state.camera.position;
    
    // 現在の原点(0,0,0)からの距離を計算
    const currentDistance = position.length();
    
    // 現在の距離から目標の距離へ、スムーズに数値を変化させる（線形補間）
    // 座標を強制するのではなく「距離（ベクトルの長さ）」だけを調整することで、
    // ユーザーによる「回転操作（ベクトルの向きの変更）」を邪魔しないようにする
    const newDistance = MathUtils.lerp(currentDistance, targetDistance, delta * 2);
    
    // カメラ位置ベクトルの長さを更新
    position.setLength(newDistance);
  });

  return null;
}


export default function Home() {
  const [entries, setEntries] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'single' | 'gallery'>('single');
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);

  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setEntries(data);
    if (error) console.error("Error fetching:", error);
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files || files.length === 0 || files.length > 6) {
      alert("画像は1〜6枚選択してください");
      return;
    }
    setLoading(true);
    setCompressing(true);

    try {
      const uploadedUrls: string[] = [];
      const compressionOptions = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/jpeg',
        initialQuality: 0.8
      };

      for (let i = 0; i < files.length; i++) {
        const originalFile = files[i];
        let fileToUpload = originalFile;
        
        try {
          const compressedFile = await imageCompression(originalFile, compressionOptions);
          fileToUpload = new File([compressedFile], originalFile.name, { type: compressedFile.type });
        } catch (error) {
          console.error("Compression failed:", error);
        }

        const fileExt = fileToUpload.type.split('/')[1] || 'jpg';
        const fileName = `${Math.random().toString(36).substring(2)}_${i}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage.from('cube-images').upload(filePath, fileToUpload);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('cube-images').getPublicUrl(filePath);
        uploadedUrls.push(publicUrl);
      }

      setCompressing(false);

      const { error: dbError } = await supabase
        .from('entries')
        .insert([{ content: newContent, image_urls: uploadedUrls }]);

      if (dbError) throw dbError;

      setNewContent("");
      setFiles(null);
      setIsFormOpen(false);
      fetchEntries();
      setViewMode('single');
      setSelectedIndex(0);

    } catch (error: any) {
      alert('Error: ' + error.message);
      setCompressing(false);
    } finally {
      setLoading(false);
    }
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

  const currentEntry = entries[selectedIndex];

  return (
    <main className="h-screen w-full bg-gray-900 text-white overflow-hidden relative font-sans">
      
      {viewMode === 'single' && currentEntry && (
        <div className="absolute top-8 left-8 z-10 pointer-events-none animate-fade-in">
          <h1 className="text-4xl font-bold mb-2 tracking-tighter">Cube Diary</h1>
          <p className="text-xl font-light opacity-90">"{currentEntry.content}"</p>
          <p className="text-sm opacity-50 mt-1 font-mono">
            {new Date(currentEntry.created_at).toLocaleString()}
          </p>
          <p className="text-xs opacity-40 mt-1">
            {selectedIndex + 1} / {entries.length}
          </p>
        </div>
      )}

      {viewMode === 'gallery' && (
        <div className="absolute top-8 left-8 z-10 pointer-events-none animate-fade-in">
          <h1 className="text-4xl font-bold mb-2 tracking-tighter">Memory Gallery</h1>
          <p className="opacity-70">Click a cube to view details</p>
        </div>
      )}

      <div className="absolute top-8 right-8 z-20 flex gap-2">
        <button
          onClick={() => setViewMode('single')}
          className={`px-4 py-2 rounded-lg font-bold transition ${viewMode === 'single' ? 'bg-white text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
        >
          Single
        </button>
        <button
          onClick={() => setViewMode('gallery')}
          className={`px-4 py-2 rounded-lg font-bold transition ${viewMode === 'gallery' ? 'bg-white text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
        >
          Gallery
        </button>
      </div>

      {viewMode === 'single' && entries.length > 1 && (
        <>
          <button
            onClick={() => setSelectedIndex((prev) => (prev + 1) % entries.length)}
            className="absolute top-1/2 right-4 z-20 text-4xl opacity-50 hover:opacity-100 transition"
          >
            ▶
          </button>
          <button
            onClick={() => setSelectedIndex((prev) => (prev - 1 + entries.length) % entries.length)}
            className="absolute top-1/2 left-4 z-20 text-4xl opacity-50 hover:opacity-100 transition"
          >
            ◀
          </button>
        </>
      )}

      <Canvas shadows>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.3} penumbra={1} castShadow intensity={1} />
        <Environment preset="city" />

        <CameraController viewMode={viewMode} />

        {viewMode === 'single' && currentEntry && (
          <Suspense fallback={<FallbackCube />}>
            <TextureErrorBoundary fallback={<FallbackCube />}>
              <TexturedCube imageUrls={getImageUrls(currentEntry)} />
            </TextureErrorBoundary>
          </Suspense>
        )}

        {viewMode === 'gallery' && (
          <group>
            <Floor />
            <ContactShadows resolution={1024} scale={50} blur={2} opacity={0.5} far={10} color="#000000" />
            
            {entries.map((entry, index) => {
              const COLS = 4;
              const SPACING = 4;
              const x = (index % COLS) * SPACING - (COLS * SPACING) / 2 + SPACING / 2;
              const z = -Math.floor(index / COLS) * SPACING;
              const imageUrls = getImageUrls(entry);

              return (
                <Suspense key={entry.id} fallback={<FallbackCube position={[x, 0, z]} />}>
                  <TextureErrorBoundary fallback={<FallbackCube position={[x, 0, z]} />}>
                    {imageUrls.length > 0 ? (
                      <TexturedCube 
                        imageUrls={imageUrls} 
                        position={[x, 0, z]} 
                        onClick={() => {
                          setSelectedIndex(index);
                          setViewMode('single');
                        }}
                      />
                    ) : (
                      <FallbackCube position={[x, 0, z]} />
                    )}
                  </TextureErrorBoundary>
                </Suspense>
              );
            })}
          </group>
        )}

        <OrbitControls makeDefault enableZoom={false} />
      </Canvas>

      {!isFormOpen && (
        <button
          onClick={() => setIsFormOpen(true)}
          className="absolute bottom-8 right-8 z-20 bg-blue-600 text-white w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg hover:scale-110 transition-transform duration-200"
        >
          ＋
        </button>
      )}

      {isFormOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
            <h2 className="text-2xl font-bold mb-6">New Memory</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Photos (Up to 6)</label>
                <div className="relative border-2 border-dashed border-gray-600 rounded-lg p-4 hover:border-blue-500 transition-colors text-center cursor-pointer group">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    required
                    onChange={(e) => setFiles(e.target.files)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="pointer-events-none group-hover:text-blue-400 transition-colors">
                    {files && files.length > 0 ? (
                      <p className="text-blue-400 font-medium">{files.length} images selected</p>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-gray-300 font-medium">Click to upload images</p>
                        <p className="text-xs text-gray-500">Large images will be compressed to under 1MB</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Message</label>
                <textarea
                  required
                  className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white h-24"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-2 rounded hover:bg-gray-700 transition" disabled={loading}>Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2 bg-blue-600 rounded hover:bg-blue-500 transition font-bold disabled:opacity-50">
                  {loading ? (compressing ? 'Compressing...' : 'Uploading...') : 'Save Cube'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}