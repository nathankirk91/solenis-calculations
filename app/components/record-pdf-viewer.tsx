import { ArrowLeftIcon, DownloadIcon, Share2Icon } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useCallback, useState } from "react";

import { Button } from "~/components/ui/button";

type RecordPdfViewerProps = {
  title: string;
  pdfUrl: string;
  downloadUrl: string;
  backUrl: string;
  filename: string;
};

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
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
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
      <iframe
        src={pdfUrl}
        title={title}
        className="min-h-0 flex-1 border-0 bg-white"
      />
    </div>
  );
}
