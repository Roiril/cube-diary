"use client";

import React, { Component, ReactNode } from "react"; // Reactの機能をインポート
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState, useEffect, Suspense } from "react";
import { Mesh } from "three";
import { OrbitControls, Environment, useTexture } from "@react-three/drei";
import { supabase } from "@/lib/supabaseClient";

// 🛡️ エラーの防波堤（これがないと画像エラーでアプリ全体が死にます）
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

// 📦 テクスチャ（画像）付きのキューブ
function TexturedCube({ imageUrl }: { imageUrl: string }) {
  const meshRef = useRef<Mesh>(null!);
  const [active, setActive] = useState(false);
  
  // ここで読み込みに失敗するとエラーが発生する
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

// 📦 画像がない時やエラー時のプレーンなキューブ
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
      {/* エラー時はグレーのワイヤーフレーム表示 */}
      <meshStandardMaterial color="#666" wireframe />
    </mesh>
  );
}

export default function Home() {
  const [latestEntry, setLatestEntry] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [loading, setLoading] = useState(false);

  // データの取得
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

  // 投稿処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from('entries')
      .insert([{ content: newContent, image_url: newImageUrl }]);

    if (error) {
      alert('エラー: ' + error.message);
    } else {
      setNewContent("");
      setNewImageUrl("");
      setIsFormOpen(false);
      fetchEntry();
    }
    setLoading(false);
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
          {/* エラー防波堤で囲むことで、画像ロード失敗時にFallbackCubeを表示させる */}
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
              <div>
                <label className="block text-sm text-gray-400 mb-1">Image URL</label>
                <input
                  type="text"
                  required
                  placeholder="https://..."
                  className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">※3Dで使える画像URLを入力してください</p>
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
                  {loading ? 'Saving...' : 'Save Cube'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}