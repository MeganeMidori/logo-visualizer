import { useEffect, useState } from "react";

// Width of the generated image. The background is scaled to this once on
// load.
const OUTPUT_WIDTH = 2000;

// Wait for edits to pause before re-encoding the image, so dragging on the
// designer stays smooth.
const RENDER_DELAY_MS = 150;

// Where the design goes on the background. The centre is a fraction of the
// background's width and height; the width is a fraction of its width.
export type LogoPlacement = { centerX: number; centerY: number; width: number };

// Draws the design onto the background and returns the result as a PNG data
// URL, or "" until the background has loaded.
export const useCompositeImage = (
  backgroundSrc: string,
  placement: LogoPlacement,
  logoUrl: string,
) => {
  const [background, setBackground] = useState<HTMLCanvasElement | null>(null);
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_WIDTH;
      canvas.height = Math.round(
        (OUTPUT_WIDTH * image.naturalHeight) / image.naturalWidth,
      );
      canvas
        .getContext("2d")
        ?.drawImage(image, 0, 0, canvas.width, canvas.height);
      setBackground(canvas);
    };
    image.src = backgroundSrc;
  }, [backgroundSrc]);

  useEffect(() => {
    if (!background) return;

    const { centerX, centerY, width: logoWidth } = placement;
    let cancelled = false;
    const compose = (logo: HTMLImageElement | null) => {
      const canvas = document.createElement("canvas");
      canvas.width = background.width;
      canvas.height = background.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(background, 0, 0);
      if (logo) {
        const width = canvas.width * logoWidth;
        const height = (width * logo.naturalHeight) / logo.naturalWidth;
        ctx.drawImage(
          logo,
          canvas.width * centerX - width / 2,
          canvas.height * centerY - height / 2,
          width,
          height,
        );
      }
      setImageUrl(canvas.toDataURL("image/png"));
    };

    const timeout = setTimeout(() => {
      if (!logoUrl) {
        compose(null);
        return;
      }
      const logo = new Image();
      logo.onload = () => {
        if (!cancelled) compose(logo);
      };
      logo.src = logoUrl;
    }, RENDER_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [background, placement, logoUrl]);

  return imageUrl;
};
