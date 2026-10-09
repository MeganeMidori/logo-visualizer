import { useEffect, useState } from "react";

// Copies of the image are stamped around a circle to build the outline; more
// steps give a smoother edge on thick outlines.
const OUTLINE_STEPS = 32;

// Wait for edits to pause before re-encoding, so dragging on the designer
// stays smooth.
const RENDER_DELAY_MS = 150;

// Returns the image at imageUrl with a solid outline around its opaque
// pixels, as a PNG data URL the same size as the original. Thickness is in
// the image's own pixels. Returns "" until the first render finishes.
export const useOutlinedImage = (
  imageUrl: string,
  thickness: number,
  color: string,
) => {
  const [outlinedUrl, setOutlinedUrl] = useState("");

  useEffect(() => {
    if (!imageUrl) return;

    let cancelled = false;
    const render = (image: HTMLImageElement) => {
      const { naturalWidth: width, naturalHeight: height } = image;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Stamp shifted copies at the full and half radius so thin shapes
      // don't leave gaps, then recolor everything drawn to the outline color.
      for (const radius of [thickness, thickness / 2]) {
        for (let i = 0; i < OUTLINE_STEPS; i++) {
          const angle = (i / OUTLINE_STEPS) * Math.PI * 2;
          ctx.drawImage(
            image,
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
          );
        }
      }
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(image, 0, 0);
      setOutlinedUrl(canvas.toDataURL("image/png"));
    };

    const timeout = setTimeout(() => {
      const image = new Image();
      image.onload = () => {
        if (!cancelled) render(image);
      };
      image.src = imageUrl;
    }, RENDER_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [imageUrl, thickness, color]);

  return imageUrl ? outlinedUrl : "";
};
