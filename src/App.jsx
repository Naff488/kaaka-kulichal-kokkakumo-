import React, { Suspense, useRef, useState, useEffect, useMemo } from "react";
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, Html } from "@react-three/drei";
import { Howl } from 'howler';
import { gsap } from 'gsap';
import './index.css';

// ------------------ Helper: Simple sound loader ------------------
const splashSound = new Howl({ src: ['https://actions.google.com/sounds/v1/water/splash.ogg'], volume: 0.6 });
const cawSound = new Howl({ src: ['Crow1.jpg.mp3'], volume: 0.6 });

// ------------------ CrowModel ------------------
function CrowModel({ position = [0, -0.6, 0], isGlowing }) {
  // Try loading a GLB crow; if not found, render a placeholder
  try {
    const gltf = useGLTF('/models/crow.glb');
    const scene = gltf.scene.clone();
    // Simple material tweak on glow
    useEffect(() => {
      scene.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
          if (isGlowing) {
            c.material.emissive = c.material.emissive || { r: 0, g: 0, b: 0 };
            c.material.emissiveIntensity = 0.4;
          } else {
            c.material.emissiveIntensity = 0;
          }
        }
      });
    }, [scene, isGlowing]);
    return <primitive object={scene} position={position} scale={0.9} />;
  } catch (e) {
    // Placeholder: cute stylized crow using simple geometry
    return (
      <group position={position}>
        <mesh castShadow>
          <sphereGeometry args={[0.6, 32, 32]} />
          <meshStandardMaterial color={isGlowing ? '#1e90ff' : '#222'} metalness={0.2} roughness={0.6} />
        </mesh>
        {/* beak */}
        <mesh position={[0.6, -0.05, 0.1]} rotation={[0, 0, -0.4]}>
          <coneGeometry args={[0.18, 0.5, 16]} />
          <meshStandardMaterial color={'#ffb84d'} />
        </mesh>
        {/* eyes */}
        <mesh position={[0.25, 0.15, 0.45]}> 
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color={'white'} />
        </mesh>
        <mesh position={[0.32, 0.15, 0.48]}> 
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color={'black'} />
        </mesh>
        {/* eyelashes if glowing */}
        {isGlowing && (
          <group position={[0.25, 0.24, 0.45]}>
            <mesh rotation={[0, 0, -0.5]} position={[0, 0, 0]}> <planeGeometry args={[0.18, 0.05]} /> <meshStandardMaterial color={'#000'} /> </mesh>
          </group>
        )}
      </group>
    );
  }
}

// ------------------ Bathtub placeholder ------------------
function BathtubPlaceholder() {
  return (
    <group position={[0, -1.1, 0]}>
      <mesh receiveShadow>
        <cylinderGeometry args={[2.2, 2.2, 0.6, 32]} />
        <meshStandardMaterial color={'#6d87b0ff'} roughness={0.5} metalness={0.1} />
      </mesh>
    </group>
  );
}

// ------------------ Draggable Sponge (3D) ------------------
function DraggableSponge({ onScrub }) {
  const ref = useRef();
  const { camera, gl, scene } = useThree();
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState([1.2, 0.5, 0.6]); // starting position
  const pointer = useRef({ x: 0, y: 0 });
  const scrubCooldown = useRef(false);

  useEffect(() => {
    const handlePointerMove = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  useFrame(() => {
    if (dragging) {
      // convert pointer to 3D world position on plane near camera
      const vec = new THREE.Vector3(pointer.current.x, pointer.current.y, 0.5);
      vec.unproject(camera);
      const dir = vec.sub(camera.position).normalize();
      const distance = -camera.position.z / dir.z;
      const pos = camera.position.clone().add(dir.multiplyScalar(distance));
      // keep sponge slightly above tub
      const newPos = [pos.x, Math.max(-0.3, Math.min(1.2, pos.y)), pos.z];
      setPosition(newPos);

      // detect proximity to crow center (0, -0.6, 0) or model; we'll use approximate distance
      const dx = newPos[0] - 0;
      const dy = newPos[1] - (-0.6);
      const dz = newPos[2] - 0;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (dist < 0.9 && !scrubCooldown.current) {
        scrubCooldown.current = true;
        onScrub();
        // play splash
        splashSound.play();
        cawSound.play();
        setTimeout(() => { scrubCooldown.current = false; }, 350);
      }
    }
    // animate small floating when idle
    if (ref.current && !dragging) {
      ref.current.rotation.z += 0.01;
      ref.current.position.y = position[1] + Math.sin(performance.now() / 700) * 0.02;
    }
  });

  // pointer handlers attached to an invisible HTML overlay for simplicity
  return (
    <group>
      <mesh ref={ref} position={position} castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color={'#ff7f50'} metalness={0.1} roughness={0.6} />
      </mesh>

      {/* transparent larger mesh for easy grabbing */}
      <mesh
        position={position}
        onPointerDown={(e) => { e.stopPropagation(); setDragging(true); gl.domElement.style.cursor = 'grabbing'; }}
        onPointerUp={(e) => { e.stopPropagation(); setDragging(false); gl.domElement.style.cursor = 'auto'; }}
        onPointerLeave={() => { setDragging(false); gl.domElement.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

// ------------------ Main Scene ------------------
function Scene({ onScrub, isGlowing }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} castShadow />
      <Suspense fallback={null}>
        {/* bathtub: try glb, fallback to placeholder */}
        <ModelOrFallback path={'/models/bathtub.glb'} fallback={<BathtubPlaceholder />} position={[0, -1.1, 0]} />
        <CrowModel isGlowing={isGlowing} />
      </Suspense>
      <DraggableSponge onScrub={onScrub} />
      <Environment preset="sunset" />
    </>
  );
}

// ------------------ Utility: Model loader with fallback ------------------
import * as THREE from 'three';
function ModelOrFallback({ path, fallback, position = [0,0,0] }) {
  try {
    const gltf = useGLTF(path);
    return <primitive object={gltf.scene} position={position} />;
  } catch (e) {
    return fallback;
  }
}

// ------------------ App Component ------------------
function App() {
  const [scrubs, setScrubs] = useState(0);
  const [isGlowing, setIsGlowing] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [dead, setDead] = useState(false);

  useEffect(() => {
    if (scrubs >= 10) {
      setIsGlowing(true);
      // small celebratory animation using GSAP on document body
      gsap.fromTo('.win-banner', { scale: 0.8, opacity: 0 }, { scale:1, opacity:1, duration: 0.6 });
    }
  }, [scrubs]);

  const handleScrub = () => {
    setScrubs((s) => s + 1);
  };

  const handleAnswer = (ans) => {
    // both yes/no will upset the crow as requested, then 'you died' style overlay
    setShowIntro(false);
    setTimeout(() => {
      setDead(true);
    }, 800);
  };

  return (
    <div className="app-root">
      <div className="hud">
        <div className="title">🫧 BathingCrow</div>
        <div className="scrub-counter">Scrubs: {scrubs} / 10</div>
      </div>

      <Canvas shadows camera={{ position: [0, 1.6, 4], fov: 50 }}>
        <OrbitControls maxPolarAngle={Math.PI / 2} />
        <Scene onScrub={handleScrub} isGlowing={isGlowing} />
      </Canvas>

      {showIntro && (
        <div className="intro-modal">
          <div className="modal-card">
            <h2>കാക്ക കുളിച്ചാൽ കൊക്ക് ആകുമോ?</h2>
            <p>What do you think?</p>
            <div className="modal-actions">
              <button onClick={() => handleAnswer('yes')}>Yes</button>
              <button onClick={() => handleAnswer('no')}>No</button>
            </div>
          </div>
        </div>
      )}
 
     
      

      {isGlowing && (
        <div className="win-banner">✨ Crow Glow-Up! ✨</div>
      )}

      <div className="footer-note">Tip: Drag the orange sponge (right) onto the crow and scrub!</div>
    </div>
  );
}

// ------------------ Render ------------------
const container = document.getElementById('root') || document.body.appendChild(document.createElement('div'));
container.id = 'root';
const root = createRoot(container);
root.render(<App />);

export default App;
