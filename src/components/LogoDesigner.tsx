import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { createUseStyles } from "react-jss";
import logoUrl from "../assets/Fanimaid Logo.svg";

const useStyles = createUseStyles({
  container: {
    margin: "16px auto",
  },
  label: {
    display: "block",
  },
  canvas: {
    display: "block",
    margin: "0 auto",
    border: "1px solid #ccc",
    touchAction: "none",
    backgroundColor: "white",
  },
  colorPicker: {
    display: "flex",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  swatch: {
    width: 32,
    height: 32,
    border: "2px solid #ccc",
    borderRadius: 4,
    cursor: "pointer",
    "&:disabled": {
      cursor: "not-allowed",
      opacity: 0.4,
    },
  },
  activeSwatch: {
    borderColor: "#333",
  },
});

const CANVAS_SIZE = 300;
// The exported image is drawn at this multiple of CANVAS_SIZE so it stays
// sharp when shown larger, e.g. on the banner.
const EXPORT_SCALE = 3;
const FONT_SIZE = 24;
const FONT_FAMILY = "Fanimaid";
const FONT = `${FONT_SIZE}px ${FONT_FAMILY}, sans-serif`;
const fontAt = (scale: number) =>
  `${FONT_SIZE * scale}px ${FONT_FAMILY}, sans-serif`;
const FONT_URL = `${import.meta.env.BASE_URL}Fanimaid-.ttf`;
const LINE_HEIGHT = 30;
// Space kept clear on each side when wrapping the name.
const CANVAS_MARGIN = 20;

const COLORS = [
  { label: "Black", value: "#000000" },
  { label: "Pink", value: "#D94296" },
];

// Drawn at this height; width follows the SVG's 202x128 aspect ratio.
const LOGO_HEIGHT = 120;
const LOGO_WIDTH = (LOGO_HEIGHT * 202) / 128;
const LOGO_GAP = 6;

// x and y are the element's centre; scale multiplies its default size.
type TextElement = {
  type: "text";
  text: string;
  x: number;
  y: number;
  scale: number;
  color: string;
};
type LogoElement = { type: "logo"; x: number; y: number; scale: number };
type Element = TextElement | LogoElement;
type Point = { x: number; y: number };
type Rect = { left: number; top: number; right: number; bottom: number };

// What the pointer is doing between pointerdown and pointerup.
type Drag =
  | {
      kind: "move";
      start: Point;
      origins: Map<number, Point>;
      moved: boolean;
      // Plain click on an already-selected element: if the pointer never
      // moves, narrow the selection to just that element on release.
      collapseTo: number | null;
    }
  | { kind: "marquee"; start: Point; base: number[] }
  | {
      // Dragging a corner handle: every selected element is scaled by how
      // far the pointer is from the grabbed element's centre, relative to
      // where it started.
      kind: "resize";
      center: Point;
      startDistance: number;
      origins: Map<number, number>;
    };

const SELECTION_COLOR = "#3b82f6";
// Gap between an element and its selection outline.
const SELECTION_PADDING = 4;
const HANDLE_SIZE = 8;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

const getPointerPosition = (
  canvas: HTMLCanvasElement,
  e: PointerEvent<HTMLCanvasElement>,
) => {
  const rect = canvas.getBoundingClientRect();
  return {
    x:
      ((e.clientX - rect.left - canvas.clientLeft) * canvas.width) /
      canvas.clientWidth,
    y:
      ((e.clientY - rect.top - canvas.clientTop) * canvas.height) /
      canvas.clientHeight,
  };
};

const getSize = (ctx: CanvasRenderingContext2D, element: Element) => {
  const { scale } = element;
  if (element.type === "logo") {
    return { width: LOGO_WIDTH * scale, height: LOGO_HEIGHT * scale };
  }
  ctx.font = FONT;
  return {
    width: ctx.measureText(element.text).width * scale,
    height: FONT_SIZE * scale,
  };
};

const toRect = (a: Point, b: Point): Rect => ({
  left: Math.min(a.x, b.x),
  top: Math.min(a.y, b.y),
  right: Math.max(a.x, b.x),
  bottom: Math.max(a.y, b.y),
});

const getBounds = (ctx: CanvasRenderingContext2D, element: Element): Rect => {
  const { width, height } = getSize(ctx, element);
  return {
    left: element.x - width / 2,
    top: element.y - height / 2,
    right: element.x + width / 2,
    bottom: element.y + height / 2,
  };
};

// The corners of an element's selection outline, where its resize handles go.
const getHandles = (ctx: CanvasRenderingContext2D, element: Element) => {
  const { left, top, right, bottom } = getBounds(ctx, element);
  const p = SELECTION_PADDING;
  return [
    { x: left - p, y: top - p, cursor: "nwse-resize" },
    { x: right + p, y: top - p, cursor: "nesw-resize" },
    { x: left - p, y: bottom + p, cursor: "nesw-resize" },
    { x: right + p, y: bottom + p, cursor: "nwse-resize" },
  ];
};

const intersects = (a: Rect, b: Rect) =>
  a.left <= b.right &&
  a.right >= b.left &&
  a.top <= b.bottom &&
  a.bottom >= b.top;

// The name's words wrapped to fit maxWidth, with the logo (null) below.
// A single word wider than maxWidth gets a line to itself.
const getLines = (
  ctx: CanvasRenderingContext2D,
  name: string,
  maxWidth: number,
): (string[] | null)[] => {
  const lines: string[][] = [];
  for (const word of name.split(/\s+/).filter(Boolean)) {
    const line = lines[lines.length - 1];
    if (line && ctx.measureText([...line, word].join(" ")).width <= maxWidth) {
      line.push(word);
    } else {
      lines.push([word]);
    }
  }
  return [...lines, null];
};

// Draws the design itself, without any selection UI.
const drawElements = (
  ctx: CanvasRenderingContext2D,
  elements: Element[],
  logo: HTMLImageElement | null,
) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  elements.forEach((element) => {
    if (element.type === "logo") {
      if (logo) {
        const width = LOGO_WIDTH * element.scale;
        const height = LOGO_HEIGHT * element.scale;
        ctx.drawImage(
          logo,
          element.x - width / 2,
          element.y - height / 2,
          width,
          height,
        );
      }
      return;
    }
    ctx.font = fontAt(element.scale);
    ctx.fillStyle = element.color;
    ctx.fillText(element.text, element.x, element.y);
  });
};

type LogoDesignerProps = {
  name: string;
  // Called with a PNG data URL of the design whenever it changes.
  onImageChange?: (dataUrl: string) => void;
};
export const LogoDesigner = ({ name, onImageChange }: LogoDesignerProps) => {
  const classes = useStyles();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onImageChangeRef = useRef(onImageChange);
  const dragRef = useRef<Drag | null>(null);
  const [elements, setElements] = useState<Element[]>([]);
  const [selection, setSelection] = useState<number[]>([]);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [fontLoaded, setFontLoaded] = useState(false);

  // Canvas text doesn't wait for web fonts, so redraw once it's ready.
  useEffect(() => {
    const font = new FontFace(FONT_FAMILY, `url("${FONT_URL}")`);
    font.load().then(
      (loaded) => {
        document.fonts.add(loaded);
        setFontLoaded(true);
      },
      (error) => console.error("Failed to load Fanimaid font", error),
    );
  }, []);

  useEffect(() => {
    const image = new Image();
    image.onload = () => setLogo(image);
    image.src = logoUrl;
  }, []);

  // Lay the elements out in a centred stack whenever the name changes. Also
  // re-runs once the font loads, since word widths depend on it.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.font = FONT;
    const spaceWidth = ctx.measureText(" ").width;
    const centerX = canvas.width / 2;
    const lines = getLines(ctx, name, canvas.width - CANVAS_MARGIN * 2);
    const heights = lines.map((line) =>
      line === null ? LOGO_HEIGHT + LOGO_GAP * 2 : LINE_HEIGHT,
    );
    let top = canvas.height / 2 - heights.reduce((a, b) => a + b, 0) / 2;

    setElements(
      lines.flatMap((line, i): Element[] => {
        const y = top + heights[i] / 2;
        top += heights[i];
        if (line === null) {
          return [{ type: "logo", x: centerX, y, scale: 1 }];
        }

        const widths = line.map((word) => ctx.measureText(word).width);
        const lineWidth =
          widths.reduce((a, b) => a + b, 0) + spaceWidth * (line.length - 1);
        let left = centerX - lineWidth / 2;
        return line.map((text, j) => {
          const x = left + widths[j] / 2;
          left += widths[j] + spaceWidth;
          return {
            type: "text",
            text,
            x,
            y,
            scale: 1,
            color: COLORS[0].value,
          };
        });
      }),
    );
    setSelection([]);
  }, [name, fontLoaded]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    drawElements(ctx, elements, logo);

    ctx.save();
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.fillStyle = "#ffffff";
    const padding = SELECTION_PADDING;
    selection.forEach((index) => {
      const element = elements[index];
      if (!element) return;
      const { left, top, right, bottom } = getBounds(ctx, element);
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(
        left - padding,
        top - padding,
        right - left + padding * 2,
        bottom - top + padding * 2,
      );
      ctx.setLineDash([]);
      getHandles(ctx, element).forEach(({ x, y }) => {
        const half = HANDLE_SIZE / 2;
        ctx.fillRect(x - half, y - half, HANDLE_SIZE, HANDLE_SIZE);
        ctx.strokeRect(x - half, y - half, HANDLE_SIZE, HANDLE_SIZE);
      });
    });

    if (marquee) {
      const { left, top, right, bottom } = marquee;
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = SELECTION_COLOR;
      ctx.fillRect(left, top, right - left, bottom - top);
      ctx.globalAlpha = 1;
      ctx.strokeRect(left, top, right - left, bottom - top);
    }
    ctx.restore();
  }, [elements, selection, marquee, logo, fontLoaded]);

  useEffect(() => {
    onImageChangeRef.current = onImageChange;
  }, [onImageChange]);

  // Export the design from an offscreen canvas so the selection outlines
  // drawn on the visible one aren't included.
  useEffect(() => {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = CANVAS_SIZE * EXPORT_SCALE;
    exportCanvas.height = CANVAS_SIZE * EXPORT_SCALE;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
    drawElements(ctx, elements, logo);
    onImageChangeRef.current?.(exportCanvas.toDataURL("image/png"));
  }, [elements, logo, fontLoaded]);

  const setSelectedColor = (color: string) => {
    setElements((prev) =>
      prev.map((element, i) =>
        selection.includes(i) && element.type === "text"
          ? { ...element, color }
          : element,
      ),
    );
  };

  // Indices of elements touching the rectangle.
  const elementsIn = (rect: Rect) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return [];
    return elements.flatMap((element, i) =>
      intersects(getBounds(ctx, element), rect) ? [i] : [],
    );
  };

  // Returns the index of the topmost element under the point, or -1.
  const hitTest = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return -1;

    for (let i = elements.length - 1; i >= 0; i--) {
      const element = elements[i];
      const { width, height } = getSize(ctx, element);
      if (
        Math.abs(x - element.x) <= width / 2 &&
        Math.abs(y - element.y) <= height / 2
      ) {
        return i;
      }
    }
    return -1;
  };

  // The resize handle under the point, on a selected element, if any.
  const hitHandle = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return null;

    const reach = HANDLE_SIZE / 2 + 2;
    for (const index of selection) {
      const element = elements[index];
      if (!element) continue;
      const handle = getHandles(ctx, element).find(
        (h) => Math.abs(x - h.x) <= reach && Math.abs(y - h.y) <= reach,
      );
      if (handle) return { index, cursor: handle.cursor };
    }
    return null;
  };

  // Click selects, shift-click toggles, and dragging moves the selection.
  // Dragging a corner handle resizes it. Dragging on empty space draws a
  // selection box (shift adds to it).
  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const start = getPointerPosition(canvas, e);
    canvas.setPointerCapture(e.pointerId);

    const handle = hitHandle(start.x, start.y);
    if (handle) {
      const center = {
        x: elements[handle.index].x,
        y: elements[handle.index].y,
      };
      dragRef.current = {
        kind: "resize",
        center,
        startDistance: Math.max(
          Math.hypot(start.x - center.x, start.y - center.y),
          1,
        ),
        origins: new Map(selection.map((i) => [i, elements[i].scale])),
      };
      return;
    }

    const index = hitTest(start.x, start.y);

    if (index === -1) {
      const base = e.shiftKey ? selection : [];
      setSelection(base);
      setMarquee(toRect(start, start));
      dragRef.current = { kind: "marquee", start, base };
      return;
    }

    const alreadySelected = selection.includes(index);
    let next: number[];
    if (e.shiftKey) {
      next = alreadySelected
        ? selection.filter((i) => i !== index)
        : [...selection, index];
    } else {
      next = alreadySelected ? selection : [index];
    }
    setSelection(next);
    if (!next.includes(index)) return;

    canvas.style.cursor = "grabbing";
    dragRef.current = {
      kind: "move",
      start,
      origins: new Map(
        next.map((i) => [i, { x: elements[i].x, y: elements[i].y }]),
      ),
      moved: false,
      collapseTo: alreadySelected && !e.shiftKey ? index : null,
    };
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const point = getPointerPosition(canvas, e);
    const drag = dragRef.current;

    if (!drag) {
      const handle = hitHandle(point.x, point.y);
      if (handle) {
        canvas.style.cursor = handle.cursor;
      } else {
        canvas.style.cursor =
          hitTest(point.x, point.y) === -1 ? "default" : "grab";
      }
      return;
    }

    if (drag.kind === "resize") {
      const distance = Math.hypot(
        point.x - drag.center.x,
        point.y - drag.center.y,
      );
      const factor = distance / drag.startDistance;
      setElements((prev) =>
        prev.map((element, i) => {
          const origin = drag.origins.get(i);
          if (origin === undefined) return element;
          const scale = Math.min(
            Math.max(origin * factor, MIN_SCALE),
            MAX_SCALE,
          );
          return { ...element, scale };
        }),
      );
      return;
    }

    if (drag.kind === "marquee") {
      const rect = toRect(drag.start, point);
      setMarquee(rect);
      setSelection([...new Set([...drag.base, ...elementsIn(rect)])]);
      return;
    }

    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    drag.moved = true;
    setElements((prev) =>
      prev.map((element, i) => {
        const origin = drag.origins.get(i);
        return origin
          ? { ...element, x: origin.x + dx, y: origin.y + dy }
          : element;
      }),
    );
  };

  const handlePointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (drag.kind === "marquee") {
      setMarquee(null);
      return;
    }
    if (drag.kind === "resize") return;
    if (!drag.moved && drag.collapseTo !== null) {
      setSelection([drag.collapseTo]);
    }
    e.currentTarget.style.cursor = "grab";
  };

  const selectedText = selection.flatMap((i) => {
    const element = elements[i];
    return element?.type === "text" ? [element] : [];
  });
  // Highlight a swatch only when every selected word shares that color.
  const selectedColor = selectedText.every(
    (element) => element.color === selectedText[0]?.color,
  )
    ? selectedText[0]?.color
    : undefined;

  return (
    <div className={classes.container}>
      <label className={classes.label}>Logo Designer:</label>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className={classes.canvas}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        Canvas is not supported in your browser
      </canvas>
      <div className={classes.colorPicker}>
        {COLORS.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={selectedColor === value}
            disabled={selectedText.length === 0}
            className={`${classes.swatch} ${
              selectedColor === value ? classes.activeSwatch : ""
            }`}
            style={{ backgroundColor: value }}
            onClick={() => setSelectedColor(value)}
          />
        ))}
      </div>
    </div>
  );
};
