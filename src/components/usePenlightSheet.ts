import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// The art wraps around the tube like a sleeve: its width runs along the
// tube's length and its height wraps once around the circumference. This
// matches the penlight art's 397.701 x 251.15 proportions.
const ART_ASPECT = 397.701 / 251.15;
const CIRCUMFERENCE = 1;
const RADIUS = CIRCUMFERENCE / (2 * Math.PI);
const LENGTH = ART_ASPECT * CIRCUMFERENCE;

// The tube is drawn from these angles, placed side by side to the right of
// the flat art: the front (middle of the art facing the camera), then the
// back.
const VIEW_ANGLES = [0, Math.PI];

// Each tube view is tall and narrow to fit the upright tube, and as tall as
// the flat art.
const VIEW_ASPECT = 0.3;

// Space between the flat art and the tubes, as a fraction of the art's height.
const GAP = 0.05;

// An upright cylinder with the centre of the art facing the camera. The art
// runs down the tube, so it reads top to bottom.
const createTubeGeometry = () => {
  const geometry = new THREE.CylinderGeometry(
    RADIUS,
    RADIUS,
    LENGTH,
    96,
    1,
    false,
    // Start the seam at the back so the middle of the art faces forward.
    Math.PI,
  );

  // CylinderGeometry maps u around the tube and v along it; swap them so the
  // art's x runs down the tube (its left edge at the top), with the art's top
  // edge on the right. Only the side group (group 0) is changed; the end caps
  // keep their own UVs.
  const uv = geometry.getAttribute("uv");
  const sideCount = geometry.groups[0].count;
  const index = geometry.getIndex()!;
  const sideVertices = new Set<number>();
  for (let i = 0; i < sideCount; i++) {
    sideVertices.add(index.getX(i));
  }
  for (const vertex of sideVertices) {
    const u = uv.getX(vertex);
    const v = uv.getY(vertex);
    uv.setXY(vertex, 1 - v, u);
  }
  uv.needsUpdate = true;
  return geometry;
};

// Sets up a scene with the tube and returns a function that draws it from
// each of VIEW_ANGLES, side by side, onto the renderer's canvas.
const createTubeRenderer = () => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setScissorTest(true);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, VIEW_ASPECT, 0.1, 100);
  camera.position.set(0, 0, 3.4);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xf3c6dc, 2));
  const light = new THREE.DirectionalLight(0xffffff, 1.5);
  light.position.set(1.5, 2, 3);
  scene.add(light);

  const geometry = createTubeGeometry();
  const sleeve = new THREE.MeshStandardMaterial({ roughness: 0.35 });
  const cap = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
  });
  const tube = new THREE.Mesh(geometry, [sleeve, cap, cap]);
  scene.add(tube);

  const render = (art: HTMLImageElement, height: number) => {
    const texture = new THREE.Texture(art);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    sleeve.map?.dispose();
    sleeve.map = texture;
    sleeve.needsUpdate = true;

    // Draw each angle into its own slice of the canvas. The lights stay
    // put, so every view is lit the same way.
    const viewWidth = Math.round(height * VIEW_ASPECT);
    renderer.setSize(viewWidth * VIEW_ANGLES.length, height, false);
    VIEW_ANGLES.forEach((angle, i) => {
      renderer.setViewport(i * viewWidth, 0, viewWidth, height);
      renderer.setScissor(i * viewWidth, 0, viewWidth, height);
      tube.rotation.y = angle;
      renderer.render(scene, camera);
    });
    return renderer.domElement;
  };

  const dispose = () => {
    sleeve.map?.dispose();
    sleeve.dispose();
    cap.dispose();
    geometry.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };

  return { render, dispose };
};

type TubeRenderer = ReturnType<typeof createTubeRenderer>;

// Returns one PNG data URL with the flat penlight art on the left and the
// art wrapped around a 3D tube, seen from two angles, on the right. Returns
// "" until the first render finishes.
export const usePenlightSheet = (artUrl: string) => {
  const tubeRendererRef = useRef<TubeRenderer | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");

  useEffect(() => {
    const tubeRenderer = createTubeRenderer();
    tubeRendererRef.current = tubeRenderer;
    return () => {
      tubeRenderer.dispose();
      tubeRendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!artUrl) return;

    let cancelled = false;
    const art = new Image();
    art.onload = () => {
      const tubeRenderer = tubeRendererRef.current;
      if (cancelled || !tubeRenderer) return;

      const { naturalWidth: artWidth, naturalHeight: height } = art;
      const gap = Math.round(height * GAP);
      // Copy the tubes out straight away: a WebGL canvas may be cleared once
      // control returns to the browser.
      const tubes = tubeRenderer.render(art, height);

      const canvas = document.createElement("canvas");
      canvas.width = artWidth + gap + tubes.width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(art, 0, 0);
      ctx.drawImage(tubes, artWidth + gap, 0);
      setSheetUrl(canvas.toDataURL("image/png"));
    };
    art.src = artUrl;

    return () => {
      cancelled = true;
    };
  }, [artUrl]);

  return artUrl ? sheetUrl : "";
};
