"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { RenderTask } from "pdfjs-dist";

// Configurar worker
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

type Props = {
  pdfUrl: string;
  pagina: number;
  telaCheia?: boolean;
  onTotalPaginas?: (total: number) => void;
};

export default function PdfViewer({ pdfUrl, pagina, telaCheia, onTotalPaginas }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  // Carregar PDF
  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        setCarregando(true);
        setErro("");
        const doc = await pdfjsLib.getDocument(pdfUrl).promise;
        if (!cancelado) {
          setPdfDoc(doc);
          onTotalPaginas?.(doc.numPages);
        }
      } catch {
        if (!cancelado) setErro("Erro ao carregar PDF");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregar();
    return () => { cancelado = true; };
  }, [pdfUrl, onTotalPaginas]);

  // Renderizar página
  const renderizar = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    // Cancelar render anterior se ainda estiver em andamento
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignorar erro de cancelamento
      }
      renderTaskRef.current = null;
    }

    const paginaNum = Math.max(1, Math.min(pagina, pdfDoc.numPages));
    const page = await pdfDoc.getPage(paginaNum);

    const container = containerRef.current;
    if (!container) return;
    const containerWidth = container.clientWidth;
    const containerHeight = telaCheia ? window.innerHeight : container.clientHeight || 600;

    // Calcular escala para caber no container mantendo proporção
    const viewport = page.getViewport({ scale: 1 });
    const scaleW = containerWidth / viewport.width;
    const scaleH = containerHeight / viewport.height;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const scale = Math.min(scaleW, scaleH) * dpr;

    const scaledViewport = page.getViewport({ scale });

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    canvas.style.width = `${scaledViewport.width / dpr}px`;
    canvas.style.height = `${scaledViewport.height / dpr}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const renderTask = page.render({ canvasContext: ctx, viewport: scaledViewport });
    renderTaskRef.current = renderTask;

    try {
      await renderTask.promise;
    } catch (e: unknown) {
      // Ignorar erros de cancelamento (esperados ao trocar de página)
      if (e instanceof Error && e.message?.includes("cancelled")) return;
      // Re-throw outros erros
      throw e;
    }
  }, [pdfDoc, pagina, telaCheia]);

  useEffect(() => {
    renderizar();
    return () => {
      // Cancelar render ao desmontar ou antes de re-renderizar
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { /* ok */ }
        renderTaskRef.current = null;
      }
    };
  }, [renderizar]);

  // Re-renderizar ao mudar tamanho da janela (com debounce)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(timeout);
      timeout = setTimeout(renderizar, 150);
    };
    window.addEventListener("resize", handler);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", handler);
    };
  }, [renderizar]);

  if (erro) return <div className="pdf-erro">{erro}</div>;
  if (carregando) return <div className="pdf-carregando">Carregando apresentação...</div>;

  return (
    <div ref={containerRef} className={`pdf-container ${telaCheia ? "pdf-fullscreen" : ""}`}>
      <canvas ref={canvasRef} className="pdf-canvas" />
    </div>
  );
}
