// 3D waving UAE flag (Three.js). Drawn to the official layout: a vertical red band at the hoist
// (pole side, one quarter of the width) and three equal horizontal stripes: green, white, black.
// Proportion 1:2. Never mirrored, also in right-to-left (Arabic) mode.
// Pauses when off-screen; static under prefers-reduced-motion. Decorative (aria-hidden).
import { useEffect, useRef } from "react";
import { useNearViewport } from "../lib/useNearViewport";
import * as THREE from "three";

const COLORS = { red: "#ef3340", green: "#009739", white: "#ffffff", black: "#1b1b1f" }; // black lifted to charcoal so the stripe stays visible on the dark showcase

function flagTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const band = w / 4;
  g.fillStyle = COLORS.green;
  g.fillRect(band, 0, w - band, h / 3);
  g.fillStyle = COLORS.white;
  g.fillRect(band, h / 3, w - band, h / 3);
  g.fillStyle = COLORS.black;
  g.fillRect(band, (2 * h) / 3, w - band, h / 3 + 1);
  g.fillStyle = COLORS.red;
  g.fillRect(0, 0, band, h);
  // Faint hairline edge so the dark stripe separates from a dark background
  g.strokeStyle = "rgba(255,255,255,0.22)";
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, w - 3, h - 3);
  // Subtle fabric weave so light catches the cloth
  g.globalAlpha = 0.05;
  for (let y = 0; y < h; y += 3) {
    g.fillStyle = y % 6 === 0 ? "#000" : "#fff";
    g.fillRect(0, y, w, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export default function Flag3D({ className = "" }: { className?: string }) {
  const mount = useRef<HTMLDivElement>(null);
  // The WebGL scene only exists while this is on or near the screen (see useNearViewport).
  const near = useNearViewport(mount);

  useEffect(() => {
    const el = mount.current;
    if (!el || !near) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0.4, 0.15, 7.2);

    // Cloth
    const W = 4;
    const H = 2;
    const geo = new THREE.PlaneGeometry(W, H, 80, 40);
    geo.translate(W / 2, 0, 0); // hoist edge at x = 0 (the pole)
    const base = geo.attributes.position.array.slice() as Float32Array;
    const tex = flagTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.62, metalness: 0.02 });
    const cloth = new THREE.Mesh(geo, mat);

    // Gold pole + finial
    const gold = new THREE.MeshStandardMaterial({ color: "#d9b76e", metalness: 0.9, roughness: 0.28 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 4.6, 24), gold);
    pole.position.set(-0.03, -1.25, 0);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), gold);
    finial.position.set(-0.03, 1.08, 0);

    const flag = new THREE.Group();
    flag.add(cloth, pole, finial);
    flag.position.set(-1.9, 0.35, 0);
    flag.rotation.y = -0.32;
    scene.add(flag);

    // Lighting: warm key, cool fill, gold rim
    scene.add(new THREE.AmbientLight("#ffffff", 0.55));
    const key = new THREE.DirectionalLight("#fff4e0", 2.1);
    key.position.set(3, 4, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#cfe3ff", 0.6);
    fill.position.set(-4, -1, 3);
    scene.add(fill);
    const rim = new THREE.PointLight("#d9b76e", 18, 12);
    rim.position.set(-2.5, 1.5, -2);
    scene.add(rim);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const wave = (t: number) => {
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const y = base[i * 3 + 1];
        const k = x / W; // 0 at the pole, 1 at the fly end: the free end moves most
        const z =
          k * (0.32 * Math.sin(x * 1.6 - t * 2.4) + 0.12 * Math.sin(x * 3.1 + y * 1.4 - t * 3.3)) +
          k * k * 0.08 * Math.sin(y * 2.2 - t * 1.7);
        pos.setXYZ(i, x - k * 0.04 * Math.abs(z), y - k * k * 0.05, z);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    };

    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // Gentle sway toward the pointer
    let mx = 0;
    let my = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      my = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { rootMargin: "100px" });
    io.observe(el);

    let raf = 0;
    const clock = new THREE.Clock();
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      const t = clock.getElapsedTime();
      wave(t);
      flag.rotation.y += (-0.32 + mx * 0.18 - flag.rotation.y) * 0.04;
      flag.rotation.x += (my * 0.06 - flag.rotation.x) * 0.04;
      renderer.render(scene, camera);
    };
    if (reduce) {
      wave(1.2);
      renderer.render(scene, camera);
    } else {
      frame();
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      geo.dispose();
      mat.dispose();
      tex.dispose();
      gold.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // release the WebGL context right away
      renderer.domElement.remove();
    };
  }, [near]);

  return <div ref={mount} className={`relative h-full w-full ${className}`} aria-hidden="true" dir="ltr" />;
}
