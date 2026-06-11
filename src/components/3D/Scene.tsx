import { Suspense, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Float, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { ProceduralTree } from './ProceduralTree';

// Horizon tint shared by the fog and the grass edge so the ground melts
// into the sky instead of ending in a hard gray line.
const HORIZON_COLOR = '#cfe2f3';

// Circular grass meadow: radial gradient from rich green in the middle out
// to the horizon color, with speckles for a natural grassy feel.
function Ground() {
  const texture = useMemo(() => {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, '#679250');
    g.addColorStop(0.35, '#557a3e');
    g.addColorStop(0.65, '#7fa05e');
    g.addColorStop(0.88, '#b9cba4');
    g.addColorStop(1, HORIZON_COLOR);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    // Grass speckles (darker and lighter dots)
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const dark = Math.random() > 0.5;
      ctx.fillStyle = dark
        ? `rgba(25, 50, 18, ${Math.random() * 0.18})`
        : `rgba(190, 220, 150, ${Math.random() * 0.12})`;
      ctx.fillRect(x, y, 2 + Math.random() * 2, 2 + Math.random() * 2);
    }

    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -10, 0]} receiveShadow>
      {/* Far larger than the fog distance, so the rim is always fully fogged
          into the horizon color and never shows a hard edge */}
      <circleGeometry args={[1500, 64]} />
      <meshStandardMaterial map={texture} roughness={1} />
    </mesh>
  );
}

function IntroCamera({ onFinish }: { onFinish: () => void }) {
  // Stop far enough back to see the whole canopy (~50 units wide) with cards hanging below it
  const targetPos = new THREE.Vector3(0, 10, 85);

  useFrame((state) => {
    // Lerp from current position to target slowly (0.015 for slow dramatic feel)
    state.camera.position.lerp(targetPos, 0.015);
    state.camera.lookAt(0, 5, 0); // Keep looking at the actual canopy center (scaled up)
    
    // Once it's close enough, finish intro and give control to user
    if (state.camera.position.distanceTo(targetPos) < 0.2) {
      onFinish();
    }
  });

  return null;
}

export function Scene() {
  const [introFinished, setIntroFinished] = useState(false);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Start camera far away for the fly-in: [0, 40, 100] */}
      <Canvas camera={{ position: [0, 60, 200], fov: 45 }}>
        {/* Real scattering sky with a visible sun near the main light */}
        <Sky
          sunPosition={[100, 60, 100]}
          turbidity={4}
          rayleigh={1.2}
          mieCoefficient={0.005}
          mieDirectionalG={0.8}
        />
        <fog attach="fog" args={[HORIZON_COLOR, 110, 360]} />
        
        {/* Environment and Lights - Bright and sunny */}
        <ambientLight intensity={1.5} color="#ffffff" />
        
        {/* Main sun light */}
        <directionalLight 
          position={[30, 50, 20]} 
          intensity={2.5} 
          castShadow 
          shadow-mapSize={[2048, 2048]}
          color="#fffaee"
        />

        {/* Cold rim light for contrast */}
        <directionalLight 
          position={[-20, 20, -20]} 
          intensity={1.5} 
          color="#4d88ff"
        />
        
        <Environment preset="dawn" environmentIntensity={0.5} />
        
        {/* Grass meadow that fades into the horizon */}
        <Ground />
        
        <Suspense fallback={null}>
          <Float speed={1} rotationIntensity={0.05} floatIntensity={0.1}>
            <ProceduralTree />
          </Float>
        </Suspense>

        {!introFinished && <IntroCamera onFinish={() => setIntroFinished(true)} />}

        <OrbitControls 
          makeDefault
          enabled={introFinished} // Only allow user to rotate after intro finishes
          enablePan={true} // Allow right-click dragging to pan the center
          target={[0, 5, 0]} // Center the camera orbit properly on the scaled canopy
          minDistance={2} // Allow very close zooming
          maxDistance={100} // Increased max distance to view the bigger tree
        />
      </Canvas>
      
      {/* Overlay UI */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        padding: '2rem',
        pointerEvents: 'none', // Let clicks pass through to Canvas
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <h1 style={{ 
          fontSize: '3rem', 
          fontWeight: 800, 
          background: 'linear-gradient(to right, #fff, #ffd6a5)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '1rem',
          textShadow: '0 4px 20px rgba(0,0,0,0.8)'
        }}>
          Memory Tree
        </h1>
        <p style={{
          fontSize: '1.2rem',
          color: 'rgba(255,255,255,0.8)',
          textAlign: 'center',
          maxWidth: '600px',
          fontWeight: 400
        }}>
          Góc lưu giữ những kỷ niệm và gương mặt của các thành viên.
          Dùng chuột để xoay và khám phá.
        </p>
      </div>

      {/* Editor toolbar — fixed in the bottom-left corner of the screen */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        background: 'rgba(0,0,0,0.8)',
        padding: '12px',
        borderRadius: '8px',
        display: 'flex',
        gap: '10px'
      }}>
        <button
          onClick={() => window.dispatchEvent(new Event('memorytree:export'))}
          style={{ padding: '8px 12px', cursor: 'pointer', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Lưu & Copy Tọa Độ
        </button>
        <button
          onClick={() => window.dispatchEvent(new Event('memorytree:reset'))}
          style={{ padding: '8px 12px', cursor: 'pointer', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Reset Tạo Lại Ngẫu Nhiên
        </button>
      </div>
    </div>
  );
}
