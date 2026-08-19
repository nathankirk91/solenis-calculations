import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";

type SignaturePadProps = {
  name: string;
  id?: string;
  required?: boolean;
  value?: string;
  onChange?: (dataUrl: string) => void;
  error?: string;
};

const EXPORT_MAX_WIDTH = 640;
const EXPORT_JPEG_QUALITY = 0.65;

function exportSignature(source: HTMLCanvasElement): string {
  const rect = source.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const scale = Math.min(1, EXPORT_MAX_WIDTH / width);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(width * scale));
  out.height = Math.max(1, Math.round(height * scale));
  const ctx = out.getContext("2d");
  if (!ctx) {
    return source.toDataURL("image/jpeg", EXPORT_JPEG_QUALITY);
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", EXPORT_JPEG_QUALITY);
}

export function SignaturePad({
  name,
  id,
  required,
  value,
  onChange,
  error,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasStrokesRef = useRef(Boolean(value));
  const dataUrlRef = useRef(value ?? "");
  const [dataUrl, setDataUrl] = useState(value ?? "");
  const [hasStrokes, setHasStrokes] = useState(Boolean(value));

  const paintCanvas = useCallback((imageSrc?: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#072635";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);

    const src = imageSrc ?? dataUrlRef.current;
    if (!src) return;
    const image = new Image();
    image.onload = () => {
      ctx.drawImage(image, 0, 0, rect.width, rect.height);
    };
    image.src = src;
  }, []);

  useEffect(() => {
    paintCanvas();
    const onResize = () => paintCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [paintCanvas]);

  function getPos(
    event: React.MouseEvent | React.TouchEvent,
  ): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in event) {
      const touch = event.touches[0];
      if (!touch) return null;
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function startDraw(event: React.MouseEvent | React.TouchEvent) {
    const pos = getPos(event);
    if (!pos) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    drawingRef.current = true;
  }

  function draw(event: React.MouseEvent | React.TouchEvent) {
    if (!drawingRef.current) return;
    const pos = getPos(event);
    if (!pos) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    if (!hasStrokesRef.current) {
      hasStrokesRef.current = true;
      setHasStrokes(true);
    }
  }

  function endDraw() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasStrokesRef.current) {
      const url = exportSignature(canvas);
      dataUrlRef.current = url;
      setDataUrl(url);
      onChange?.(url);
    }
  }

  function clear() {
    hasStrokesRef.current = false;
    dataUrlRef.current = "";
    setHasStrokes(false);
    setDataUrl("");
    onChange?.("");
    paintCanvas("");
  }

  return (
    <div className="grid gap-2">
      <div className="relative overflow-hidden rounded-lg border border-input bg-white">
        <canvas
          ref={canvasRef}
          className="h-32 w-full cursor-crosshair touch-none sm:h-40"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasStrokes && !dataUrl ? (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground/60">
            Sign or initial here
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Use your finger or mouse to sign
        </p>
        {hasStrokes || dataUrl ? (
          <Button type="button" variant="outline" size="sm" onClick={clear}>
            Clear
          </Button>
        ) : null}
      </div>
      <input
        type="hidden"
        name={name}
        id={id}
        value={dataUrl}
        required={required}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
