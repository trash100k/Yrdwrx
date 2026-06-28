// @ts-nocheck
import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Lightweight conceptual 3D preview of a yard design.
 * Self-contained Three.js scene. Derives placeholder plantings / beds /
 * hardscape from the AI `result` (estimatedMaterials + identifiedAreas).
 */
export default function Design3D({ result, image }: any) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let frameId = 0;
    let controls: OrbitControls | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const disposables: Array<{ dispose?: () => void }> = [];

    try {
      const width = container.clientWidth || 600;
      const height = container.clientHeight || 420;

      // ---- Renderer ----
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      container.appendChild(renderer.domElement);

      // ---- Scene + sky-ish background ----
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0e1512);
      scene.fog = new THREE.Fog(0x0e1512, 28, 70);

      // ---- Camera ----
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
      camera.position.set(14, 11, 16);

      // ---- Controls ----
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 6;
      controls.maxDistance = 48;
      controls.maxPolarAngle = Math.PI / 2.05; // don't go under the ground
      controls.target.set(0, 1, 0);
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.8;

      // pause auto-rotate on user interaction
      controls.addEventListener("start", () => {
        if (controls) controls.autoRotate = false;
      });

      // ---- Lighting ----
      const hemi = new THREE.HemisphereLight(0xbfe6ff, 0x16301f, 0.9);
      scene.add(hemi);

      const dir = new THREE.DirectionalLight(0xffffff, 1.1);
      dir.position.set(12, 20, 8);
      dir.castShadow = true;
      dir.shadow.mapSize.set(1024, 1024);
      scene.add(dir);

      scene.add(new THREE.AmbientLight(0x405040, 0.35));

      // ---- Ground plane (green yard) ----
      const groundGeo = new THREE.PlaneGeometry(40, 40);
      const groundMat = new THREE.MeshStandardMaterial({
        color: 0x2f7d3a,
        roughness: 1,
        metalness: 0,
      });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);
      disposables.push(groundGeo, groundMat);

      // subtle grid for depth
      const grid = new THREE.GridHelper(40, 40, 0x10b981, 0x0c3a22);
      (grid.material as THREE.Material).opacity = 0.18;
      (grid.material as THREE.Material).transparent = true;
      grid.position.y = 0.01;
      scene.add(grid);

      // ---- House box at the back ----
      const houseGroup = new THREE.Group();
      const houseGeo = new THREE.BoxGeometry(12, 5, 6);
      const houseMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.9 });
      const house = new THREE.Mesh(houseGeo, houseMat);
      house.position.set(0, 2.5, -13);
      house.castShadow = true;
      house.receiveShadow = true;
      houseGroup.add(house);
      disposables.push(houseGeo, houseMat);

      // roof (pyramid)
      const roofGeo = new THREE.ConeGeometry(8.4, 3, 4);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b4a36, roughness: 1 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(0, 6.5, -13);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      houseGroup.add(roof);
      disposables.push(roofGeo, roofMat);
      scene.add(houseGroup);

      // ---- Shared geometries/materials for placeholders ----
      const shrubGeo = new THREE.SphereGeometry(0.85, 14, 12);
      const shrubMat = new THREE.MeshStandardMaterial({ color: 0x3fa34d, roughness: 0.85 });
      const treeFoliageGeo = new THREE.ConeGeometry(1.3, 3.4, 12);
      const treeFoliageMat = new THREE.MeshStandardMaterial({ color: 0x2e8b4f, roughness: 0.9 });
      const trunkGeo = new THREE.CylinderGeometry(0.18, 0.24, 1.4, 8);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d27, roughness: 1 });
      const mulchGeo = new THREE.BoxGeometry(3.2, 0.3, 2.2);
      const mulchMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1 });
      const paverGeo = new THREE.BoxGeometry(3.4, 0.18, 3.4);
      const paverMat = new THREE.MeshStandardMaterial({ color: 0x8a8d91, roughness: 0.7, metalness: 0.05 });
      disposables.push(
        shrubGeo, shrubMat, treeFoliageGeo, treeFoliageMat, trunkGeo, trunkMat,
        mulchGeo, mulchMat, paverGeo, paverMat,
      );

      const makeShrub = () => {
        const m = new THREE.Mesh(shrubGeo, shrubMat);
        m.position.y = 0.85;
        m.castShadow = true;
        const g = new THREE.Group();
        g.add(m);
        return g;
      };
      const makeTree = () => {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.7;
        trunk.castShadow = true;
        const foliage = new THREE.Mesh(treeFoliageGeo, treeFoliageMat);
        foliage.position.y = 2.7;
        foliage.castShadow = true;
        g.add(trunk, foliage);
        return g;
      };
      const makeMulch = () => {
        const m = new THREE.Mesh(mulchGeo, mulchMat);
        m.position.y = 0.15;
        m.receiveShadow = true;
        const g = new THREE.Group();
        g.add(m);
        return g;
      };
      const makePaver = () => {
        const m = new THREE.Mesh(paverGeo, paverMat);
        m.position.y = 0.09;
        m.receiveShadow = true;
        m.castShadow = true;
        const g = new THREE.Group();
        g.add(m);
        return g;
      };

      // ---- Decide what to place from the AI result ----
      type Spec = { kind: "shrub" | "tree" | "mulch" | "paver" };
      const specs: Spec[] = [];

      const materials: any[] = Array.isArray(result?.estimatedMaterials)
        ? result.estimatedMaterials
        : [];
      const areas: any[] = Array.isArray(result?.identifiedAreas)
        ? result.identifiedAreas
        : [];

      const classify = (text: string): Spec["kind"] | null => {
        const t = (text || "").toLowerCase();
        if (/(tree|maple|oak|pine|birch|arbor)/.test(t)) return "tree";
        if (/(shrub|plant|flower|bush|hedge|perennial|grass|sod|garden|bed)/.test(t)) return "shrub";
        if (/(mulch|soil|compost|topsoil|bark)/.test(t)) return "mulch";
        if (/(paver|stone|patio|hardscape|walkway|path|concrete|gravel|pad|deck)/.test(t)) return "paver";
        return null;
      };

      materials.forEach((m) => {
        const kind = classify(`${m?.item || ""} ${m?.quantity || ""}`);
        if (kind) specs.push({ kind });
      });
      areas.forEach((a) => {
        const kind = classify(`${a?.description || ""} ${a?.suggestion || ""}`);
        if (kind) specs.push({ kind });
      });

      // fallbacks if nothing classified
      if (specs.length === 0) {
        specs.push(
          { kind: "shrub" }, { kind: "shrub" }, { kind: "tree" },
          { kind: "mulch" }, { kind: "paver" },
        );
      }

      // cap so the scene stays light
      const placed = specs.slice(0, 14);

      // ---- Arrange placeholders on the plane (spiral-ish layout) ----
      const placedObjects: THREE.Object3D[] = [];
      placed.forEach((spec, i) => {
        let obj: THREE.Object3D;
        if (spec.kind === "tree") obj = makeTree();
        else if (spec.kind === "mulch") obj = makeMulch();
        else if (spec.kind === "paver") obj = makePaver();
        else obj = makeShrub();

        // golden-angle spread across a usable region in front of the house
        const angle = i * 2.399963;
        const radius = 3 + Math.sqrt(i) * 2.6;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius * 0.7 - 2; // bias toward front
        obj.position.x = THREE.MathUtils.clamp(x, -16, 16);
        obj.position.z = THREE.MathUtils.clamp(z, -9, 15);
        // slight random rotation/scale variety
        obj.rotation.y = (i % 5) * 0.6;
        const s = 0.85 + ((i * 37) % 30) / 100;
        obj.scale.setScalar(s);
        scene.add(obj);
        placedObjects.push(obj);
      });

      // ---- Resize handling ----
      const handleResize = () => {
        if (!renderer) return;
        const w = container.clientWidth || width;
        const h = container.clientHeight || height;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(container);
      } else {
        window.addEventListener("resize", handleResize);
      }

      // ---- Animation loop ----
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        if (controls) controls.update();
        if (renderer) renderer.render(scene, camera);
      };
      animate();

      // ---- Cleanup ----
      return () => {
        cancelAnimationFrame(frameId);
        if (resizeObserver) resizeObserver.disconnect();
        else window.removeEventListener("resize", handleResize);
        if (controls) controls.dispose();
        disposables.forEach((d) => {
          try {
            d.dispose && d.dispose();
          } catch {}
        });
        scene.traverse((o: any) => {
          if (o.geometry?.dispose) o.geometry.dispose();
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m: any) => m?.dispose && m.dispose());
          }
        });
        if (renderer) {
          renderer.dispose();
          if (renderer.domElement && renderer.domElement.parentNode === container) {
            container.removeChild(renderer.domElement);
          }
        }
      };
    } catch (err: any) {
      console.error("Design3D init error:", err);
      setWebglError(err?.message || "Unable to initialize 3D preview.");
      // best-effort cleanup of anything created before the throw
      return () => {
        if (frameId) cancelAnimationFrame(frameId);
        if (controls) controls.dispose();
        if (renderer) {
          try {
            renderer.dispose();
            if (renderer.domElement?.parentNode) {
              renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
          } catch {}
        }
      };
    }
    // re-run when the design result changes
  }, [result]);

  return (
    <div className="w-full h-full flex flex-col gap-3">
      <div className="relative flex-1 min-h-[360px] rounded-2xl overflow-hidden border border-white/10 bg-black/60">
        <div ref={containerRef} className="absolute inset-0" />
        {webglError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 gap-3 bg-black/70">
            <p className="text-sm font-black italic uppercase tracking-wider text-white/80">
              3D Preview Unavailable
            </p>
            <p className="text-[10px] uppercase tracking-widest font-black text-white/40 max-w-xs">
              {webglError}
            </p>
          </div>
        )}
      </div>
      <p className="text-center text-[10px] uppercase tracking-[0.2em] font-black text-forest-400/80">
        Conceptual 3D preview — drag to explore.
      </p>
    </div>
  );
}
