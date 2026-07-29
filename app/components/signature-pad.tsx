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

export function SignaturePad({
  name,
  id,
  required,
  value,
  onChange,
  error,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [dataUrl, setDataUrl] = useState(value ?? "");

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    return ctx;
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#072635";
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

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
    const ctx = getCtx();
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  }

  function draw(event: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    const pos = getPos(event);
    if (!pos) return;
    const ctx = getCtx();
    if (!ctx) return;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasStrokes(true);
  }

  function endDraw() {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasStrokes) {
      const url = canvas.toDataURL("image/png");
      setDataUrl(url);
      onChange?.(url);
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    resizeCanvas();
    setHasStrokes(false);
    setDataUrl("");
    onChange?.("");
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
