import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { Employee } from '../../data/employees';

export const CARD_SCALE = 0.5;
export const CARD_WIDTH = 1.5; // local units, before CARD_SCALE
export const CARD_HEIGHT = 2;

const PHOTO_SIZE = 1.3;
// Photo sits near the top of the card, name label below (polaroid style)
const PHOTO_Y = CARD_HEIGHT / 2 - 0.1 - PHOTO_SIZE / 2;
const NAME_Y = -CARD_HEIGHT / 2 + 0.28;

// Deterministic pseudo-random string length derived from the hang point,
// so the same saved position always renders the same string.
export function stringLengthFor(x: number, z: number) {
  const f = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return 1.6 + (f - Math.floor(f)) * 2.0; // 1.6 .. 3.6 (local units)
}

// World-space offset from the attach point down to the card's center.
export function cardCenterOffset(stringLength: number) {
  return (stringLength + CARD_HEIGHT / 2) * CARD_SCALE;
}

export function EmployeeCard({
  employee,
  position,
  stringLength = 1,
  onClick,
  isSelected
}: {
  employee: Employee;
  position: [number, number, number];
  stringLength?: number;
  onClick?: (e: any) => void;
  isSelected?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const initialPosition = useRef(new THREE.Vector3(...position));
  const cardY = -(stringLength + CARD_HEIGHT / 2);

  const photoTexture = useTexture(employee.imageUrl, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    // Photos come in all aspect ratios but the polaroid window is square:
    // crop to the centered square (CSS background-size: cover) instead of
    // stretching, so faces keep their real proportions.
    const img = tex.image as { width: number; height: number };
    if (img && img.width && img.height) {
      const aspect = img.width / img.height;
      if (aspect > 1) {
        tex.repeat.set(1 / aspect, 1);
        tex.offset.set((1 - 1 / aspect) / 2, 0);
      } else {
        tex.repeat.set(1, aspect);
        tex.offset.set(0, (1 - aspect) / 2);
      }
    }
  });

  useFrame((state) => {
    if (!groupRef.current) return;

    // Gentle natural wind, pivoting around the attach point.
    const t = state.clock.getElapsedTime();
    const p = initialPosition.current;
    // Per-card phase so neighbours don't move in lockstep, but the gust
    // term travels across the tree (position-based) like a real breeze.
    const phase = p.x * 0.45 + p.z * 0.3;

    // Slow-breathing gust strength: calm ... stronger puffs (~0.3..1)
    const gust =
      0.65 +
      0.35 * Math.sin(t * 0.22 + phase * 0.15) * Math.sin(t * 0.13 + 1.7);

    // Pendulum sway (two slightly detuned frequencies feel organic)
    const sway = (0.05 + 0.09 * gust);
    groupRef.current.rotation.x =
      Math.sin(t * 1.1 + phase) * sway +
      Math.sin(t * 2.3 + phase * 1.7) * sway * 0.25;
    groupRef.current.rotation.z =
      Math.cos(t * 0.85 + phase * 1.3) * sway * 0.7 +
      Math.cos(t * 1.9 + phase) * sway * 0.2;

    // Slow twist around the string, like a hanging photo turning in the air
    groupRef.current.rotation.y =
      Math.sin(t * 0.5 + phase * 0.8) * 0.28 * gust;
  });

  return (
    <group position={position} scale={[CARD_SCALE, CARD_SCALE, CARD_SCALE]} ref={groupRef} onClick={onClick}>
      {/* Hook/knot where the string is glued onto the branch */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>

      {/* The string. Top is exactly at y=0 (the attach point on the tree) */}
      <mesh position={[0, -stringLength / 2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, stringLength, 4]} />
        <meshStandardMaterial color="#8b5a2b" />
      </mesh>

      {/* Polaroid-style card hanging below the string */}
      <group position={[0, cardY, 0]}>
        {/* Selection highlight */}
        {isSelected && (
          <mesh position={[0, 0, -0.03]}>
            <planeGeometry args={[CARD_WIDTH + 0.2, CARD_HEIGHT + 0.2]} />
            <meshBasicMaterial color="#4d88ff" side={THREE.DoubleSide} />
          </mesh>
        )}

        {/* White card backing, visible from both sides */}
        <mesh>
          <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
          <meshStandardMaterial color="#ffffff" roughness={0.8} side={THREE.DoubleSide} />
        </mesh>

        {/* Photo — front face */}
        <mesh position={[0, PHOTO_Y, 0.01]}>
          <planeGeometry args={[PHOTO_SIZE, PHOTO_SIZE]} />
          <meshStandardMaterial map={photoTexture} roughness={0.6} />
        </mesh>
        {/* Photo — back face, so the card reads correctly from behind too */}
        <mesh position={[0, PHOTO_Y, -0.01]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[PHOTO_SIZE, PHOTO_SIZE]} />
          <meshStandardMaterial map={photoTexture} roughness={0.6} />
        </mesh>

        {/* Name — front and back */}
        <Text
          position={[0, NAME_Y, 0.01]}
          fontSize={0.17}
          color="#333333"
          anchorX="center"
          anchorY="middle"
          maxWidth={CARD_WIDTH - 0.15}
          textAlign="center"
        >
          {employee.name}
        </Text>
        <Text
          position={[0, NAME_Y, -0.01]}
          rotation={[0, Math.PI, 0]}
          fontSize={0.17}
          color="#333333"
          anchorX="center"
          anchorY="middle"
          maxWidth={CARD_WIDTH - 0.15}
          textAlign="center"
        >
          {employee.name}
        </Text>
      </group>
    </group>
  );
}
