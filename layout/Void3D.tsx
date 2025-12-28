import React, { useRef, Suspense, memo, useEffect, useState } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, shaderMaterial } from '@react-three/drei';
import { Color, Mesh } from 'three';
import { useHardware } from '../../hooks/useHardware';

// Create shader material
const VoidMaterialImpl = shaderMaterial(
  {
    uTime: 0,
    uColor: new Color(0.8, 0.6, 0.2),
  },
  // Vertex Shader
  `
    varying vec2 vUv;
    varying vec3 vPosition;
    
    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader
  `
    precision mediump float;
    
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;
    varying vec3 vPosition;
    
    // Simplified noise function for better performance
    float noise(vec3 p) {
      return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
    }
    
    void main() {
      // Optimized noise calculation with reduced iterations
      vec3 pos = vPosition * 0.5 + uTime * 0.1;
      float n = noise(pos);
      
      // Simple color mixing
      vec3 color = mix(uColor * 0.3, uColor, n);
      
      // Edge glow effect
      float edge = 1.0 - abs(dot(normalize(vPosition), vec3(0.0, 0.0, 1.0)));
      color += uColor * edge * 0.5;
      
      gl_FragColor = vec4(color, 0.6 + n * 0.2);
    }
  `
);

// Extend THREE namespace
extend({ VoidMaterialImpl });

function VoidSphere() {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<any>(null);
  const { isHighPerformance } = useHardware();

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uTime = state.clock.elapsedTime;
    }
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.001;
      meshRef.current.rotation.y += 0.002;
    }
  });

  return (
    <mesh ref={meshRef}>
      {/* Reduce polygon count for high performance mode */}
      <icosahedronGeometry args={[1, isHighPerformance ? 0 : 1]} />
      <primitive object={new VoidMaterialImpl()} ref={materialRef} transparent />
    </mesh>
  );
}

const Void3D = memo(function Void3DComponent() {
  const { isHighPerformance } = useHardware();
  const [webglSupported, setWebglSupported] = useState(true);

  useEffect(() => {
    // Check WebGL support
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebglSupported(false);
      }
    } catch (e) {
      setWebglSupported(false);
    }
  }, []);

  // Fallback to CSS gradient if WebGL not supported
  if (!webglSupported) {
    return (
      <div className="fixed inset-0 -z-10 opacity-30 bg-gradient-to-br from-black via-gray-900 to-black" />
    );
  }

  return (
    <div className="fixed inset-0 -z-10 opacity-30">
      <Suspense fallback={<div className="fixed inset-0 -z-10 opacity-30 bg-gradient-to-br from-black via-gray-900 to-black" />}>
        <Canvas
          dpr={[1, 1.5]} // Cap pixel density to max 1.5x
          performance={{ min: 0.5 }} // Allow automatic quality downgrade if FPS drops
          camera={{ position: [0, 0, 3], fov: 50 }}
          gl={{
            antialias: false, // Disable for better performance
            alpha: true,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false,
            preserveDrawingBuffer: true,
          }}
          onCreated={({ gl }) => {
            // Handle context loss gracefully
            gl.domElement.addEventListener('webglcontextlost', (event) => {
              event.preventDefault();
              console.log('WebGL Context Lost - Attempting Restore');
            }, false);
            
            // Handle context restoration
            gl.domElement.addEventListener('webglcontextrestored', () => {
              console.log('WebGL Context Restored');
            }, false);
          }}
        >
          <ambientLight intensity={0.3} />
          <pointLight position={[10, 10, 10]} intensity={0.5} />
          
          {/* Only render 3D geometry in high performance mode */}
          {isHighPerformance && <VoidSphere />}
          
          {/* Shader-only fallback for low performance */}
          {!isHighPerformance && (
            <mesh>
              <planeGeometry args={[10, 10]} />
              <primitive object={new VoidMaterialImpl()} transparent />
            </mesh>
          )}
          
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate
            autoRotateSpeed={0.5}
          />
        </Canvas>
      </Suspense>
    </div>
  );
});

export default Void3D;
