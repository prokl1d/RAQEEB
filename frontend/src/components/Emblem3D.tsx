// 3D gold medallion (Three.js): an onyx-faced gold coin with an icon raised on its face,
// an orbiting gold ring and drifting gold dust. Used as the emblem of each protection feature.
// The icon is drawn from Feather-style SVG paths and turned into gold "tubes" (3D strokes).
// Pauses when off-screen; a single still frame under prefers-reduced-motion. Decorative (aria-hidden).
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

export type EmblemIcon = "shield" | "phone" | "pin";

// 24x24 icon paths (Feather icons, MIT).
const ICONS: Record<EmblemIcon, string[]> = {
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", "M8.5 12l2.5 2.5 4.5-5"],
  phone: [
    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",
    "M15.05 5A5 5 0 0 1 19 8.95",
    "M15.05 1A9 9 0 0 1 23 8.94",
  ],
  pin: ["M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z", "M15 10a3 3 0 1 1-6 0 3 3 0 1 1 6 0z"],
};

const GOLD = "#d9b76e";

/** Feather path data -> gold tube meshes, centred and scaled to `size` world units. */
function iconTubes(icon: EmblemIcon, size: number, radius: number, mat: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${ICONS[icon].map((d) => `<path d="${d}"/>`).join("")}</svg>`;
  const data = new SVGLoader().parse(svg);
  const s = size / 24;
  for (const p of data.paths) {
    for (const sub of p.subPaths) {
      const raw = sub.getPoints(48);
      const pts: THREE.Vector3[] = [];
      for (const v of raw) {
        const q = new THREE.Vector3((v.x - 12) * s, -(v.y - 12) * s, 0);
        if (!pts.length || pts[pts.length - 1].distanceTo(q) > 1e-4) pts.push(q);
      }
      if (pts.length < 2) continue;
      const closed = pts[0].distanceTo(pts[pts.length - 1]) < 1e-3;
      if (closed) pts.pop();
      const curve = new THREE.CatmullRomCurve3(pts, closed, "centripetal");
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, pts.length * 3), radius, 10, closed), mat);
      group.add(tube);
      if (!closed) {
        // round caps
        for (const end of [pts[0], pts[pts.length - 1]]) {
          const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), mat);
          cap.position.copy(end);
          group.add(cap);
        }
      }
    }
  }
  return group;
}

export default function Emblem3D({ icon, className = "" }: { icon: EmblemIcon; className?: string }) {
  const mount = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute("aria-hidden", "true");
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 7.2);

    const gold = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.24 });
    const goldBright = new THREE.MeshStandardMaterial({ color: "#ecd6a3", metalness: 1, roughness: 0.18, emissive: "#3a2c10", emissiveIntensity: 0.25 });
    const onyx = new THREE.MeshStandardMaterial({ color: "#0d0d10", metalness: 0.6, roughness: 0.35 });

    // Coin: a lathe profile gives a bevelled gold rim; the face is an onyx disc set slightly back.
    const R = 1.55;
    const profile = [
      [0, -0.16], [R - 0.08, -0.16], [R, -0.1], [R + 0.02, 0], [R, 0.1], [R - 0.08, 0.16],
      [R - 0.16, 0.16], [R - 0.2, 0.1], [R - 0.22, 0.06], [0, 0.06],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const coinGeo = new THREE.LatheGeometry(profile, 96);
    coinGeo.rotateX(Math.PI / 2);
    const coin = new THREE.Mesh(coinGeo, gold);
    const face = new THREE.Mesh(new THREE.CircleGeometry(R - 0.2, 96), onyx);
    face.position.z = 0.065;
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(R - 0.34, 0.018, 12, 120), goldBright);
    innerRing.position.z = 0.075;
    const glyph = iconTubes(icon, 1.55, 0.065, goldBright);
    glyph.position.z = 0.14;

    const medal = new THREE.Group();
    medal.add(coin, face, innerRing, glyph);
    scene.add(medal);

    // Orbiting ring
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.012, 10, 200), gold);
    orbit.rotation.set(1.15, 0.25, 0);
    scene.add(orbit);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), goldBright);
    scene.add(bead);

    // Gold dust
    const DUST = 70;
    const dustPos = new Float32Array(DUST * 3);
    const seeds = new Float32Array(DUST);
    for (let i = 0; i < DUST; i++) {
      const r = 1.8 + Math.random() * 1.6;
      const a = Math.random() * Math.PI * 2;
      dustPos[i * 3] = Math.cos(a) * r;
      dustPos[i * 3 + 1] = (Math.random() - 0.5) * 4;
      dustPos[i * 3 + 2] = Math.sin(a) * r * 0.6 - 0.6;
      seeds[i] = Math.random() * Math.PI * 2;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dot = document.createElement("canvas");
    dot.width = dot.height = 64;
    const g = dot.getContext("2d")!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,236,190,1)");
    grd.addColorStop(0.4, "rgba(217,183,110,0.5)");
    grd.addColorStop(1, "rgba(217,183,110,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const sprite = new THREE.CanvasTexture(dot);
    const dustMat = new THREE.PointsMaterial({ size: 0.07, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 });
    scene.add(new THREE.Points(dustGeo, dustMat));

    // Lights: warm key, gold rim from behind
    scene.add(new THREE.AmbientLight("#fff6e6", 0.35));
    const key = new THREE.DirectionalLight("#fff1d6", 2.2);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.PointLight(GOLD, 22, 12);
    rim.position.set(-2.5, 1.5, -2);
    scene.add(rim);

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

    let mx = 0;
    let my = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      mx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      my = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { rootMargin: "100px" });
    io.observe(el);

    const pose = (t: number) => {
      medal.rotation.y = Math.sin(t * 0.55) * 0.45 + mx * 0.25;
      medal.rotation.x = Math.sin(t * 0.4) * 0.08 + my * 0.15;
      medal.position.y = Math.sin(t * 0.9) * 0.06;
      orbit.rotation.z = t * 0.25;
      const a = t * 0.8;
      const p = new THREE.Vector3(Math.cos(a) * 2.15, Math.sin(a) * 2.15, 0).applyEuler(orbit.rotation);
      bead.position.copy(p);
    };

    let raf = 0;
    let last = 0;
    const clock = new THREE.Clock();
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) {
        last = clock.getElapsedTime();
        return;
      }
      const t = clock.getElapsedTime();
      const dt = Math.min(0.05, t - last);
      last = t;
      pose(t);
      for (let i = 0; i < DUST; i++) {
        let y = dustPos[i * 3 + 1] + dt * (0.08 + 0.05 * Math.sin(seeds[i]));
        if (y > 2) y = -2;
        dustPos[i * 3 + 1] = y;
      }
      dustGeo.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    };
    if (reduce) {
      pose(0.6);
      renderer.render(scene, camera);
    } else {
      frame();
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) o.geometry.dispose();
      });
      [gold, goldBright, onyx, dustMat].forEach((m) => m.dispose());
      sprite.dispose();
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [icon]);

  return <div ref={mount} className={`relative h-full w-full ${className}`} aria-hidden="true" dir="ltr" />;
}
