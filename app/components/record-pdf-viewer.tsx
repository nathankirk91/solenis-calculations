import { ArrowLeftIcon, DownloadIcon, Share2Icon } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";

type RecordPdfViewerProps = {
  title: string;
  pdfUrl: string;
  downloadUrl: string;
  backUrl: string;
  filename: string;
};

function PdfScrollView({ pdfUrl }: { pdfUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) {
      return;
    }

    async function renderPdf() {
      const target = containerRef.current;
      if (!target) {
        return;
      }

      setLoading(true);
      setError(null);
      target.innerHTML = "";

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
        const width = target.clientWidth || window.innerWidth;
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
          canvas.className = "mx-auto mb-3 block max-w-full bg-white shadow-sm";
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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-muted/30 px-2 py-3 touch-pan-y">
      {loading ? (
        <p className="px-2 py-4 text-sm text-muted-foreground">Loading PDF…</p>
      ) : null}
      {error ? (
        <p className="px-2 py-4 text-sm text-destructive">{error}</p>
      ) : null}
      <div ref={containerRef} className="mx-auto w-full max-w-3xl" />
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
