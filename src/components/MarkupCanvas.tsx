// @ts-nocheck

import React, { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import {
  Pencil,
  Square,
  Circle,
  Trash2,
  Undo,
  MousePointer2,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { regionFromBBox } from "../lib/canvasGeometry";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Emitted on finalize: the clean photo, a flattened composite (for the analysis pass),
// and the SEMANTIC regions the user marked (normalized 0..1) — circles/boxes = "add",
// the X tool = "remove". The placement engine uses `clean` + `regions`, never the
// annotation-burned composite.
export interface MarkupPayload {
  clean: string | null;
  composite: string;
  regions: Array<{ id: string; shape: "circle" | "rect"; cx: number; cy: number; r?: number; x?: number; y?: number; w?: number; h?: number; intent: "add" | "remove" }>;
}

interface MarkupCanvasProps {
  backgroundImage: string | null;
  onSave: (payload: MarkupPayload) => void;
  imageAspectRatio?: number | null;
}

export default function MarkupCanvas({
  backgroundImage,
  onSave,
  imageAspectRatio,
}: MarkupCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
  const [activeTool, setActiveTool] = useState<
    "select" | "pencil" | "rect" | "circle" | "x"
  >("pencil");
  const containerRef = useRef<HTMLDivElement>(null);

  // ARCHITECTURE: the photo is a plain <img> with object-contain (the browser scales it
  // perfectly), and the fabric canvas sits on top as a TRANSPARENT drawing layer sized to the
  // same box. Export composites photo + drawings. This replaced fabric's backgroundImage,
  // which rendered the photo half-size in a quadrant regardless of scale math ("pixel lock").
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, { isDrawingMode: true, enableRetinaScaling: false });
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.width = 5;
    canvas.freeDrawingBrush.color = "#10b981";

    // Keep the drawing canvas exactly the size of its container (the displayed photo box).
    const fit = () => {
      const el = containerRef.current;
      if (!el) return;
      const W = el.clientWidth, H = el.clientHeight;
      if (!W || !H) return;
      canvas.setDimensions({ width: W, height: H });
      canvas.requestRenderAll();
    };
    (canvas as any)._fit = fit;
    setFabricCanvas(canvas);

    const resizeObserver = new ResizeObserver(() => fit());
    resizeObserver.observe(containerRef.current);
    fit();

    return () => {
      canvas.dispose();
      resizeObserver.disconnect();
    };
  }, []);

  const setTool = (tool: "select" | "pencil" | "rect" | "circle" | "x") => {
    setActiveTool(tool);
    if (!fabricCanvas) return;

    fabricCanvas.isDrawingMode = tool === "pencil";

    // Stop any active listeners if we were drawing shapes
    fabricCanvas.off("mouse:down");

    if (tool === "rect") {
      fabricCanvas.on("mouse:down", (options) => {
        const pointer = fabricCanvas.getScenePoint(options.e);
        const rect = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 50,
          height: 50,
          fill: "transparent",
          stroke: "#3b82f6", // Blue for "that"
          strokeWidth: 4,
          rx: 10,
          ry: 10,
        });
        (rect as any).regionMeta = { shape: "rect", intent: "add" };
        fabricCanvas.add(rect);
        fabricCanvas.setActiveObject(rect);
        setActiveTool("select");
        fabricCanvas.off("mouse:down");
      });
    } else if (tool === "circle") {
      fabricCanvas.on("mouse:down", (options) => {
        const pointer = fabricCanvas.getScenePoint(options.e);
        const circle = new fabric.Circle({
          left: pointer.x,
          top: pointer.y,
          radius: 30,
          fill: "transparent",
          stroke: "#3b82f6", // Blue for "that"
          strokeWidth: 4,
        });
        (circle as any).regionMeta = { shape: "circle", intent: "add" };
        fabricCanvas.add(circle);
        fabricCanvas.setActiveObject(circle);
        setActiveTool("select");
        fabricCanvas.off("mouse:down");
      });
    } else if (tool === "x") {
      fabricCanvas.on("mouse:down", (options) => {
        const pointer = fabricCanvas.getScenePoint(options.e);
        const group = new fabric.Group([
          new fabric.Line([-20, -20, 20, 20], { stroke: '#ef4444', strokeWidth: 8 }),
          new fabric.Line([20, -20, -20, 20], { stroke: '#ef4444', strokeWidth: 8 })
        ], {
           left: pointer.x,
           top: pointer.y,
        });
        (group as any).regionMeta = { shape: "rect", intent: "remove" };
        fabricCanvas.add(group);
        fabricCanvas.setActiveObject(group);
        setActiveTool("select");
        fabricCanvas.off("mouse:down");
      });
    }
  };

  const clearCanvas = () => {
    if (!fabricCanvas) return;
    // Drawings only live on the fabric layer now; the photo is a separate <img>, so a plain
    // clear() wipes the markup and leaves the photo untouched.
    fabricCanvas.clear();
    fabricCanvas.requestRenderAll();
  };

  const exportCanvas = () => {
    if (!fabricCanvas) return;
    try {
      const el = containerRef.current;
      const W = el ? el.clientWidth : fabricCanvas.getWidth();
      const H = el ? el.clientHeight : fabricCanvas.getHeight();
      const out = document.createElement("canvas");
      out.width = W; out.height = H;
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("no 2d ctx");
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, W, H);
      // 1) photo, object-contain (matches the on-screen <img>)
      const imgEl = imgRef.current;
      if (imgEl && imgEl.naturalWidth) {
        const s = Math.min(W / imgEl.naturalWidth, H / imgEl.naturalHeight);
        const dw = imgEl.naturalWidth * s, dh = imgEl.naturalHeight * s;
        ctx.drawImage(imgEl, (W - dw) / 2, (H - dh) / 2, dw, dh);
      }
      // 2) markup drawings on top (fabric's canvas element, transparent bg)
      const drawEl = (fabricCanvas as any).lowerCanvasEl || canvasRef.current;
      if (drawEl) ctx.drawImage(drawEl, 0, 0, W, H);
      const composite = out.toDataURL("image/jpeg", 0.85);

      // Build SEMANTIC regions from the tagged shapes (normalized to the displayed photo).
      const regions: MarkupPayload["regions"] = [];
      try {
        const natW = imgEl?.naturalWidth || W;
        const natH = imgEl?.naturalHeight || H;
        let idx = 0;
        for (const o of fabricCanvas.getObjects()) {
          const meta = (o as any).regionMeta;
          if (!meta) continue; // freehand pencil = sketch only, not a placement region
          const br = o.getBoundingRect();
          const nr = regionFromBBox(
            meta.shape,
            { left: br.left, top: br.top, width: br.width, height: br.height },
            natW,
            natH,
            W,
            H,
          );
          regions.push({ id: `r${++idx}`, intent: meta.intent, ...nr });
        }
      } catch (e) {
        console.warn("Region extraction failed:", e);
      }

      onSave({ clean: backgroundImage, composite, regions });
    } catch (err) {
      console.warn("Composite export failed; falling back to the original photo:", err);
      if (backgroundImage) onSave({ clean: backgroundImage, composite: backgroundImage, regions: [] });
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full w-full min-h-0">
      <div className="flex items-center justify-between px-2 shrink-0">
        <div className="flex items-center gap-4">
          <ToolButton
            active={activeTool === "select"}
            onClick={() => setTool("select")}
            icon={<MousePointer2 size={16} />}
            label="Select"
            colorClass="text-zinc-400 hover:text-white"
            activeColorClass="text-white"
          />
          <ToolButton
            active={activeTool === "pencil"}
            onClick={() => setTool("pencil")}
            icon={<Pencil size={16} />}
            label="Draw"
            colorClass="text-forest-500/60 hover:text-forest-400"
            activeColorClass="text-forest-400 font-bold"
          />
          <ToolButton
            active={activeTool === "rect"}
            onClick={() => setTool("rect")}
            icon={<Square size={16} />}
            label="Box"
            colorClass="text-celtic-500/60 hover:text-celtic-400"
            activeColorClass="text-celtic-400 font-bold"
          />
          <ToolButton
            active={activeTool === "circle"}
            onClick={() => setTool("circle")}
            icon={<Circle size={16} />}
            label="Circle"
            colorClass="text-celtic-500/60 hover:text-celtic-400"
            activeColorClass="text-celtic-400 font-bold"
          />
          <ToolButton
            active={activeTool === "x"}
            onClick={() => setTool("x")}
            icon={<X size={16} />}
            label="Exclude"
            colorClass="text-red-500/60 hover:text-red-400"
            activeColorClass="text-red-400 font-bold"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={clearCanvas}
            className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-zinc-500 hover:text-red-400 transition-colors"
            title="Clear Markups"
            aria-label="Clear Markups"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Clear</span>
          </button>
          <button
            onClick={exportCanvas}
            className="px-5 py-2 bg-forest-500 text-black rounded-lg font-black uppercase tracking-widest text-[10px] shadow-[0_0_20px_rgba(5,168,69,0.3)] hover:scale-105 active:scale-95 transition-all"
          >
            Finalize Vision
          </button>
        </div>
      </div>

      {/* Definite-size workspace: the photo is a plain object-contain <img> (perfect browser
          scaling), with the transparent fabric drawing canvas overlaid on top. */}
      <div className="flex-1 w-full min-h-0 p-1 sm:p-4 relative">
        <div
          ref={containerRef}
          className="relative w-full h-full rounded-2xl border border-white/10 bg-black/40 overflow-hidden shadow-2xl"
          style={{ touchAction: 'none' }}
        >
          {backgroundImage && (
            <img
              ref={imgRef}
              src={backgroundImage}
              alt="Yard photo"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
              {...(!backgroundImage.startsWith("data:") ? { crossOrigin: "anonymous" } : {})}
            />
          )}
          <canvas ref={canvasRef} className="absolute inset-0" />
          {!backgroundImage && (
            <div className="absolute inset-0 flex items-center justify-center flex-col gap-4 pointer-events-none">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                <MousePointer2 size={32} className="text-white/20 animate-bounce" />
              </div>
              <p className="micro-label opacity-40">Awaiting visual input feed...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  icon,
  label,
  colorClass,
  activeColorClass,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  colorClass: string;
  activeColorClass: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-colors",
        active ? activeColorClass : colorClass
      )}
    >
      {icon}
      <span className="hidden sm:inline" aria-hidden="true">
        {label}
      </span>
    </button>
  );
}
