"use client";

import React, { Component, ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState, useEffect, Suspense } from "react";
import { Mesh } from "three";
import { OrbitControls, Environment, useTexture } from "@react-three/drei";
import { supabase } from "@/lib/supabaseClient";

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

// 📦 テクスチャ付きキューブ
function TexturedCube({ imageUrl }: { imageUrl: string }) {
  const meshRef = useRef<Mesh>(null!);
  const [active, setActive] = useState(false);
  
  // プロキシ経由で読み込む
  const texture = useTexture(`/api/proxy?url=${encodeURIComponent(imageUrl)}`);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.2;
      meshRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <mesh
      ref={meshRef}
      scale={active ? 1.5 : 1}
      onClick={() => setActive(!active)}
    >
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

// 📦 フォールバック用キューブ
function FallbackCube() {
  const meshRef = useRef<Mesh>(null!);
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.2;
      meshRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#666" wireframe />
    </mesh>
  );
}

export default function Home() {
  const [latestEntry, setLatestEntry] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newContent, setNewContent] = useState("");
  
  // ファイルアップロード用のState
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchEntry = async () => {
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) setLatestEntry(data);
    if (error) console.error("Error fetching:", error);
  };

  useEffect(() => {
    fetchEntry();
  }, []);

  // 投稿処理（画像アップロードを含む）
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert("画像を選択してください！");
      return;
    }
    setLoading(true);

    try {
      // 1. ファイル名をユニークにする（被らないようにランダムな文字列をつける）
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      // 2. Supabase Storageにアップロード
      const { error: uploadError } = await supabase.storage
        .from('cube-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 3. 公開URLを取得
      const { data: { publicUrl } } = supabase.storage
        .from('cube-images')
        .getPublicUrl(filePath);

      // 4. データベースに保存
      const { error: dbError } = await supabase
        .from('entries')
        .insert([{ content: newContent, image_url: publicUrl }]);

      if (dbError) throw dbError;

      // 成功時のリセット処理
      setNewContent("");
      setFile(null);
      setIsFormOpen(false);
      fetchEntry();

    } catch (error: any) {
      alert('エラーが発生しました: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="h-screen w-full bg-gray-900 text-white overflow-hidden relative font-sans">
      
      <div className="absolute top-8 left-8 z-10 pointer-events-none">
        <h1 className="text-4xl font-bold mb-2 tracking-tighter">Cube Diary</h1>
        {latestEntry ? (
          <div className="animate-fade-in">
            <p className="text-xl font-light opacity-90">"{latestEntry.content}"</p>
            <p className="text-sm opacity-50 mt-1 font-mono">
              {new Date(latestEntry.created_at).toLocaleString()}
            </p>
          </div>
        ) : (
          <p className="opacity-50">No entries yet.</p>
        )}
      </div>

      <Canvas>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
        
        <Suspense fallback={<FallbackCube />}>
          <TextureErrorBoundary fallback={<FallbackCube />}>
            {latestEntry && latestEntry.image_url ? (
              <TexturedCube imageUrl={latestEntry.image_url} />
            ) : (
              <FallbackCube />
            )}
          </TextureErrorBoundary>
        </Suspense>
        
        <OrbitControls />
        <Environment preset="city" />
      </Canvas>

      {!isFormOpen && (
        <button
          onClick={() => setIsFormOpen(true)}
          className="absolute bottom-8 right-8 z-20 bg-white text-black w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg hover:scale-110 transition-transform duration-200"
        >
          ＋
        </button>
      )}

      {isFormOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
            <h2 className="text-2xl font-bold mb-6">New Memory</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* 画像ファイル選択 */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Photo</label>
                <div className="relative border-2 border-dashed border-gray-600 rounded-lg p-4 hover:border-blue-500 transition-colors text-center cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="pointer-events-none">
                    {file ? (
                      <p className="text-blue-400 font-medium truncate">{file.name}</p>
                    ) : (
                      <p className="text-gray-500">Click to upload image</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Message</label>
                <textarea
                  required
                  placeholder="How was your day?"
                  className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:outline-none focus:border-blue-500 h-24"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-2 rounded hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-blue-600 rounded hover:bg-blue-500 transition font-bold disabled:opacity-50"
                >
                  {loading ? 'Uploading...' : 'Save Cube'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}