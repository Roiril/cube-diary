"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState, useEffect, Suspense } from "react";
import { Mesh } from "three";
import { OrbitControls, Environment, useTexture, Text } from "@react-three/drei";
import { supabase } from "@/lib/supabaseClient";

// 📦 テクスチャ（画像）付きのキューブ
function TexturedCube({ imageUrl }: { imageUrl: string }) {
  const meshRef = useRef<Mesh>(null!);
  const [active, setActive] = useState(false);
  
  // URLから画像を読み込む（魔法の1行！）
  const texture = useTexture(imageUrl);

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
      {/* map属性にテクスチャを渡すと、画像が貼り付きます */}
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

// 📦 画像がない時のプレーンなキューブ（フォールバック用）
function FallbackCube() {
  return (
    <mesh>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="gray" wireframe />
    </mesh>
  );
}

export default function Home() {
  const [latestEntry, setLatestEntry] = useState<any>(null);

  // Supabaseから最新の日記を取得
  useEffect(() => {
    const fetchEntry = async () => {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        console.log("Fetched data:", data); // 確認用ログ
        setLatestEntry(data);
      }
      if (error) console.error("Error fetching:", error);
    };

    fetchEntry();
  }, []);

  return (
    <main className="h-screen w-full bg-gray-900 text-white overflow-hidden relative">
      <div className="absolute top-8 left-8 z-10 pointer-events-none">
        <h1 className="text-4xl font-bold mb-2">Cube Diary</h1>
        {latestEntry ? (
          <div>
            <p className="text-xl opacity-90">"{latestEntry.content}"</p>
            <p className="text-sm opacity-50 mt-1">{new Date(latestEntry.created_at).toLocaleString()}</p>
          </div>
        ) : (
          <p className="opacity-50">Loading entry...</p>
        )}
      </div>

      <Canvas>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
        
        {/* 画像があればテクスチャ付き、なければロード中 */}
        <Suspense fallback={<FallbackCube />}>
          {latestEntry && latestEntry.image_url ? (
            <TexturedCube imageUrl={latestEntry.image_url} />
          ) : (
            <FallbackCube />
          )}
        </Suspense>
        
        <OrbitControls />
        <Environment preset="city" />
      </Canvas>
    </main>
  );
}