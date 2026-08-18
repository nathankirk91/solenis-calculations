import { ArrowLeftIcon, DownloadIcon, Share2Icon } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  DOUBLE_TAP_ZOOM,
  clampPdfZoom,
  scrollAfterZoom,
  touchCenter,
  touchDistance,
  zoomFromPinch,
} from "~/lib/pdf-zoom";

type RecordPdfViewerProps = {
  title: string;
  pdfUrl: string;
  downloadUrl: string;
  backUrl: string;
  filename: string;
};

function PdfScrollView({ pdfUrl }: { pdfUrl: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const baseSizeRef = useRef({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyZoom = useCallback(
    (nextZoom: number, focal: { x: number; y: number }) => {
      const scroller = scrollerRef.current;
      const spacer = spacerRef.current;
      const pages = pagesRef.current;
      const base = baseSizeRef.current;
      if (!scroller || !spacer || !pages || base.width <= 0) {
        return;
      }

      const oldZoom = zoomRef.current;
      const zoom = clampPdfZoom(nextZoom);
      const rect = scroller.getBoundingClientRect();
      const cursorX = focal.x - rect.left;
      const cursorY = focal.y - rect.top;
      const nextLeft = scrollAfterZoom({
        scroll: scroller.scrollLeft,
        cursor: cursorX,
        oldZoom,
        newZoom: zoom,
      });
      const nextTop = scrollAfterZoom({
        scroll: scroller.scrollTop,
        cursor: cursorY,
        oldZoom,
        newZoom: zoom,
      });

      zoomRef.current = zoom;
      spacer.style.width = `${base.width * zoom}px`;
      spacer.style.height = `${base.height * zoom}px`;
      pages.style.transform = `scale(${zoom})`;
      scroller.scrollLeft = nextLeft;
      scroller.scrollTop = nextTop;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const scroller = scrollerRef.current;
    const pages = pagesRef.current;
    const spacer = spacerRef.current;
    if (!scroller || !pages || !spacer) {
      return;
    }

    async function renderPdf() {
      const target = pagesRef.current;
      const layout = spacerRef.current;
      if (!target || !layout) {
        return;
      }

      setLoading(true);
      setError(null);
      target.innerHTML = "";
      zoomRef.current = 1;
      target.style.transform = "scale(1)";

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const response = await fetch(pdfUrl, { credentials: "same-origin" });
        if (!response.ok) {
          throw new Error("Could not load the PDF.");
        }
        const data = await response.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data }).promise;
        const available =
          (scrollerRef.current?.clientWidth || window.innerWidth) - 16;
        const width = Math.max(280, Math.min(available, 768));
        const pixelRatio = window.devicePixelRatio || 1;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) {
            return;
          }
          const page = await pdf.getPage(pageNumber);
          const unscaled = page.getViewport({ scale: 1 });
          const scale = width / unscaled.width;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width * pixelRatio);
          canvas.height = Math.floor(viewport.height * pixelRatio);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.className = "mb-3 block w-full bg-white shadow-sm";
          const context = canvas.getContext("2d");
          if (!context) {
            continue;
          }
          context.scale(pixelRatio, pixelRatio);
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          if (cancelled) {
            return;
          }
          target.appendChild(canvas);
        }

        const baseWidth = target.offsetWidth || width;
        const baseHeight = target.scrollHeight;
        baseSizeRef.current = { width: baseWidth, height: baseHeight };
        layout.style.width = `${baseWidth}px`;
        layout.style.height = `${baseHeight}px`;
        target.style.width = `${baseWidth}px`;
        setLoading(false);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Could not render PDF.",
          );
          setLoading(false);
        }
      }
    }

    renderPdf();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    let pinch: { startDistance: number; startZoom: number } | null = null;
    let lastTap: { time: number; x: number; y: number } | null = null;
    let suppressTap = false;

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length < 2) {
        return;
      }
      const first = event.touches[0];
      const second = event.touches[1];
      if (!first || !second) {
        return;
      }
      suppressTap = true;
      pinch = {
        startDistance: touchDistance(first, second),
        startZoom: zoomRef.current,
      };
    }

    function onTouchMove(event: TouchEvent) {
      if (!pinch || event.touches.length < 2) {
        return;
      }
      event.preventDefault();
      const first = event.touches[0];
      const second = event.touches[1];
      if (!first || !second) {
        return;
      }
      applyZoom(
        zoomFromPinch(
          pinch.startZoom,
          pinch.startDistance,
          touchDistance(first, second),
        ),
        touchCenter(first, second),
      );
    }

    function onTouchEnd(event: TouchEvent) {
      if (event.touches.length >= 2) {
        const first = event.touches[0];
        const second = event.touches[1];
        if (first && second) {
          pinch = {
            startDistance: touchDistance(first, second),
            startZoom: zoomRef.current,
          };
        }
        return;
      }

      pinch = null;
      if (event.touches.length > 0) {
        return;
      }

      const ended = event.changedTouches[0];
      if (!ended) {
        suppressTap = false;
        return;
      }
      if (suppressTap) {
        suppressTap = false;
        lastTap = null;
        return;
      }

      const now = Date.now();
      if (
        lastTap &&
        now - lastTap.time < 280 &&
        Math.hypot(ended.clientX - lastTap.x, ended.clientY - lastTap.y) < 28
      ) {
        applyZoom(zoomRef.current > 1.05 ? 1 : DOUBLE_TAP_ZOOM, {
          x: ended.clientX,
          y: ended.clientY,
        });
        lastTap = null;
      } else {
        lastTap = { time: now, x: ended.clientX, y: ended.clientY };
      }
    }

    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.01);
      applyZoom(zoomRef.current * factor, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: false });
    scroller.addEventListener("touchend", onTouchEnd);
    scroller.addEventListener("touchcancel", onTouchEnd);
    scroller.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("touchcancel", onTouchEnd);
      scroller.removeEventListener("wheel", onWheel);
    };
  }, [applyZoom]);

  return (
    <div
      ref={scrollerRef}
      className="min-h-0 flex-1 overflow-auto overscroll-contain bg-muted/30 px-2 py-3"
      style={{ touchAction: "pan-x pan-y" }}
    >
      {loading ? (
        <p className="px-2 py-4 text-sm text-muted-foreground">Loading PDF…</p>
      ) : null}
      {error ? (
        <p className="px-2 py-4 text-sm text-destructive">{error}</p>
      ) : null}
      <div ref={spacerRef} className="relative mx-auto">
        <div
          ref={pagesRef}
          className="absolute top-0 left-0 origin-top-left will-change-transform"
        />
      </div>
    </div>
  );
}

export function RecordPdfViewer({
  title,
  pdfUrl,
  downloadUrl,
  backUrl,
  filename,
}: RecordPdfViewerProps) {
  const navigate = useNavigate();
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const close = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(backUrl);
  }, [backUrl, navigate]);

  const sharePdf = useCallback(async () => {
    setShareError(null);
    setSharing(true);
    try {
      const response = await fetch(pdfUrl, { credentials: "same-origin" });
      if (!response.ok) {
        throw new Error("Could not load the PDF.");
      }
      const blob = await response.blob();
      const file = new File([blob], filename, { type: "application/pdf" });

      if (
        typeof navigator.share === "function" &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          files: [file],
          title,
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setShareError(
        error instanceof Error ? error.message : "Could not share this PDF.",
      );
    } finally {
      setSharing(false);
    }
  }, [filename, pdfUrl, title]);

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b border-border/70 bg-background/95 px-3 py-2 backdrop-blur-sm">
        <Button type="button" variant="ghost" size="sm" onClick={close}>
          <ArrowLeftIcon data-icon="inline-start" />
          Close
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{title}</h1>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={sharing}
          onClick={sharePdf}
        >
          <Share2Icon data-icon="inline-start" />
          {sharing ? "Sharing…" : "Share"}
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to={downloadUrl} reloadDocument>
            <DownloadIcon data-icon="inline-start" />
            Download
          </Link>
        </Button>
      </header>
      {shareError ? (
        <p className="shrink-0 border-b border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {shareError}
        </p>
      ) : null}
      <PdfScrollView pdfUrl={pdfUrl} />
    </div>
  );
}
