import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import { Color } from 'three';

const VoidMaterial = shaderMaterial(
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

extend({ VoidMaterial });

// Declare the custom element for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      voidMaterial: any;
    }
  }
}

export default VoidMaterial;
