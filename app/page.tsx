"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { Mesh } from "three";
import { OrbitControls, Environment } from "@react-three/drei";

// 回転するキューブのコンポーネント
function RotatingCube() {
  const meshRef = useRef<Mesh>(null!);
  const [hovered, setHover] = useState(false);
  const [active, setActive] = useState(false);

  // 毎フレーム実行される処理（アニメーション）
  useFrame((state, delta) => {
    meshRef.current.rotation.x += delta * 0.5;
    meshRef.current.rotation.y += delta * 0.5;
  });

  return (
    <mesh
      ref={meshRef}
      scale={active ? 1.5 : 1}
      onClick={() => setActive(!active)}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {/* 箱の形 (幅, 高さ, 奥行き) */}
      <boxGeometry args={[2, 2, 2]} />
      {/* 材質と色 */}
      <meshStandardMaterial color={hovered ? "hotpink" : "orange"} />
    </mesh>
  );
}

export default function Home() {
  return (
    <main className="h-screen w-full bg-gray-900">
      <div className="absolute top-8 left-8 z-10 text-white">
        <h1 className="text-4xl font-bold">Cube Diary</h1>
        <p className="opacity-80">Drag to rotate • Click cube to expand</p>
      </div>

      {/* 3Dキャンバス */}
      <Canvas>
        {/* 環境光（全体を明るく） */}
        <ambientLight intensity={0.5} />
        {/* スポットライト */}
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
        
        {/* キューブ */}
        <RotatingCube />
        
        {/* マウス操作カメラ */}
        <OrbitControls />
        {/* 環境マップ（反射などをリアルにする） */}
        <Environment preset="city" />
      </Canvas>
    </main>
  );
}
