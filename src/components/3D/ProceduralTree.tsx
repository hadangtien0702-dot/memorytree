import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { useGLTF, Sparkles, TransformControls } from '@react-three/drei';

// BVH-accelerated raycasting: without this, every ray tests millions of
// triangles of the tree model and the page freezes for minutes.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree as any;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree as any;
THREE.Mesh.prototype.raycast = acceleratedRaycast as any;
import { employees } from '../../data/employees';
import { EmployeeCard, stringLengthFor, cardCenterOffset, CARD_WIDTH, CARD_SCALE } from './EmployeeCard';
import savedPositions from '../../data/cardPositions.json';

// Bump this key whenever the placement algorithm changes, so old saved
// positions don't keep using the old (overlapping) layout.
const STORAGE_KEY = 'memory-tree-positions-v3';

export function ProceduralTree() {
  const treeGroup = useRef<THREE.Group>(null);
  const { scene } = useGLTF('/dryads_tree.glb');

  const [selectedCard, setSelectedCard] = useState<number | null>(null);

  // Load order: localStorage (manual tweaks in this browser) → the layout
  // saved in src/data/cardPositions.json → random generation as last resort.
  // A saved layout only counts if it has exactly one position per employee;
  // otherwise (e.g. the roster grew) it is ignored and regenerated.
  const [cardPositions, setCardPositions] = useState<THREE.Vector3[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === employees.length) {
          return parsed.map(p => new THREE.Vector3(p.x, p.y, p.z));
        }
      }
    } catch (e) {}
    if (Array.isArray(savedPositions) && savedPositions.length === employees.length) {
      return savedPositions.map(p => new THREE.Vector3(p.x, p.y, p.z));
    }
    return [];
  });

  React.useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  // Generate positions only once if we don't have any saved
  useEffect(() => {
    if (!scene || !treeGroup.current || cardPositions.length > 0) return;

    const TREE_SCALE = 3;
    scene.scale.set(TREE_SCALE, TREE_SCALE, TREE_SCALE);
    scene.updateMatrixWorld(true);

    const meshes: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const name = child.name.toLowerCase();
        if (!name.includes('sky') && !name.includes('dome') && !name.includes('bound') && !name.includes('box')) {
          const mesh = child as THREE.Mesh;
          if (!mesh.geometry.boundsTree) mesh.geometry.computeBoundsTree();
          meshes.push(mesh);
        }
      }
    });

    const isSolidHit = (h: THREE.Intersection) => {
      if (!h.object.visible) return false;
      const mat = (h.object as THREE.Mesh).material;
      if (Array.isArray(mat)) {
        if (mat.some(m => m.opacity === 0 || (m.transparent && m.opacity < 0.1))) return false;
      } else if (mat) {
        if (mat.opacity === 0 || (mat.transparent && mat.opacity < 0.1)) return false;
      }
      return true;
    };

    const attachPoints: THREE.Vector3[] = []; // local space, where the string hooks on
    const cardCenters: THREE.Vector3[] = [];  // local space, card centers (for overlap checks)
    const numCards = employees.length;
    const raycaster = new THREE.Raycaster();
    raycaster.firstHitOnly = true; // BVH fast path: only the closest hit matters
    const upVector = new THREE.Vector3(0, 1, 0);

    const maxRadius = 15.0 * TREE_SCALE;
    // World-space clearance a card needs sideways so it never touches a branch/trunk
    const sideClearance = (CARD_WIDTH * CARD_SCALE) / 2 + 0.5;
    const horizontalDirs = Array.from({ length: 8 }).map((_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    });

    // ~25% of the cards hang from the big branches near the trunk (the inner
    // zone), the rest spread around the outer rim of the canopy.
    const INNER_TARGET = Math.round(numCards * 0.25);
    let innerCount = 0;

    let attempts = 0;
    const MAX_ATTEMPTS = 200000;
    while (attachPoints.length < numCards && attempts < MAX_ATTEMPTS) {
      attempts++;

      // If strict constraints can't fit all 70 cards, gradually relax the
      // spacing requirements instead of giving up with missing cards.
      const relax = attempts > MAX_ATTEMPTS * 0.6 ? 0.7
                  : attempts > MAX_ATTEMPTS * 0.3 ? 0.85
                  : 1;

      // Fill the inner zone first; if it proves too cramped, stop insisting
      // at half the attempt budget and let the rest go to the outer rim.
      const wantInner = innerCount < INNER_TARGET && attempts < MAX_ATTEMPTS * 0.5;

      const angle = Math.random() * Math.PI * 2;
      // Inner cards sample close to the trunk (hanging off the big branches);
      // outer cards bias toward the canopy rim so they stay visible from outside.
      const radius = wantInner
        ? (0.05 + 0.28 * Math.random()) * maxRadius
        : (0.35 + 0.65 * Math.sqrt(Math.random())) * maxRadius;

      // X and Z in treeGroup's local space
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Cast straight up from far below: the FIRST solid hit is the lowest
      // point of the canopy at this spot — the underside of the foliage.
      const localOrigin = new THREE.Vector3(x, -50, z);
      const worldOrigin = treeGroup.current.localToWorld(localOrigin.clone());

      raycaster.set(worldOrigin, upVector);
      const intersects = raycaster.intersectObjects(meshes, false);
      const firstHit = intersects.find(isSolidHit);
      if (!firstHit) continue;

      // Only hang cards from the tree itself (branches/foliage). If the
      // first thing above this spot is a rock, monolith, cloth or talisman,
      // skip it — otherwise cards end up glued to rocks or dangling into them.
      const hitName = firstHit.object.name.toLowerCase();
      if (!hitName.includes('foliage') && !hitName.includes('tree')) continue;

      // Convert to local space for height checks / storage
      const attachLocal = treeGroup.current.worldToLocal(firstHit.point.clone());
      if (attachLocal.y < 1.5 * TREE_SCALE || attachLocal.y > 18.0 * TREE_SCALE) continue;

      // Where the card itself will hang (string + half card below the hook).
      // Everything straight below the attach point is guaranteed clear,
      // because the attach point is the FIRST hit going up from below.
      const len = stringLengthFor(attachLocal.x, attachLocal.z);
      const centerLocal = attachLocal.clone();
      centerLocal.y -= cardCenterOffset(len);

      // Side clearance: cast short rays in 8 horizontal directions from the
      // card center; reject if any branch/trunk is too close sideways.
      const centerWorld = treeGroup.current.localToWorld(centerLocal.clone());
      // Near the trunk space is tighter, so allow cards to sit a bit closer
      // to the wood there — they still must not touch it.
      const clearance = (wantInner ? sideClearance * 0.65 : sideClearance) * relax;
      let blocked = false;
      for (const dir of horizontalDirs) {
        raycaster.set(centerWorld, dir);
        raycaster.far = clearance;
        const sideHits = raycaster.intersectObjects(meshes, false);
        if (sideHits.some(isSolidHit)) { blocked = true; break; }
      }
      raycaster.far = Infinity;
      if (blocked) continue;

      // Overlap check against already-placed cards, using card centers
      // (a card is ~0.75 wide and ~1.0 tall in world units).
      const minCenterDist = 1.8 * relax;
      const minAttachDist = 2.0 * relax;
      let tooClose = false;
      for (let i = 0; i < attachPoints.length; i++) {
        if (attachPoints[i].distanceTo(attachLocal) < minAttachDist ||
            cardCenters[i].distanceTo(centerLocal) < minCenterDist) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      attachPoints.push(attachLocal);
      cardCenters.push(centerLocal);
      if (wantInner) innerCount++;
    }

    console.log(`[MemoryTree] placed ${attachPoints.length}/${numCards} cards (${innerCount} inner) in ${attempts} attempts`);
    setCardPositions(attachPoints);
  }, [scene, cardPositions.length]);

  // The editor buttons live outside the Canvas (in Scene.tsx) and talk to
  // this component through DOM events, so they can sit fixed in a screen corner.
  useEffect(() => {
    const handleExport = () => {
      const json = JSON.stringify(cardPositions.map(p => ({ x: p.x, y: p.y, z: p.z })));
      navigator.clipboard.writeText(json);
      localStorage.setItem(STORAGE_KEY, json);
      alert('Đã lưu thành công và copy tọa độ vào bộ nhớ tạm! Bạn có thể dán vào file JSON nếu muốn hardcode vĩnh viễn.');
    };

    const handleClear = () => {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('memory-tree-positions'); // clean up old key
      setCardPositions([]); // Will trigger regeneration
      setSelectedCard(null);
    };

    window.addEventListener('memorytree:export', handleExport);
    window.addEventListener('memorytree:reset', handleClear);
    return () => {
      window.removeEventListener('memorytree:export', handleExport);
      window.removeEventListener('memorytree:reset', handleClear);
    };
  }, [cardPositions]);

  return (
    <group ref={treeGroup} position={[0, -10, 0]}>
      <primitive object={scene} scale={[3, 3, 3]} position={[0, 0, 0]} />

      <Sparkles
        count={2000}
        scale={[60, 40, 60]}
        position={[0, 20, 0]}
        color="#a0d468"
        size={5}
        speed={0.4}
        opacity={0.6}
      />

      {cardPositions.map((pos, index) => {
        const isSelected = selectedCard === index;
        const employee = employees[index];
        const stringLength = stringLengthFor(pos.x, pos.z);

        const cardNode = (
          <EmployeeCard
            employee={employee}
            position={isSelected ? [0, 0, 0] : [pos.x, pos.y, pos.z]}
            stringLength={stringLength}
            isSelected={isSelected}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCard(index);
            }}
          />
        );

        if (isSelected) {
          return (
            <TransformControls
              key={`tc-${employee.id}`}
              position={[pos.x, pos.y, pos.z]}
              mode="translate"
              onMouseUp={(e: any) => {
                if (e?.target?.object) {
                  const newPos = e.target.object.position.clone();
                  setCardPositions(prev => {
                    const next = [...prev];
                    next[index] = newPos;
                    return next;
                  });
                }
              }}
            >
              {cardNode}
            </TransformControls>
          );
        }

        return <React.Fragment key={employee.id}>{cardNode}</React.Fragment>;
      })}
    </group>
  );
}

useGLTF.preload('/dryads_tree.glb');
