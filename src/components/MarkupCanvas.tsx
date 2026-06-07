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

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MarkupCanvasProps {
  backgroundImage: string | null;
  onSave: (dataUrl: string) => void;
  imageAspectRatio?: number | null;
}

export default function MarkupCanvas({
  backgroundImage,
  onSave,
  imageAspectRatio,
}: MarkupCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
  const [activeTool, setActiveTool] = useState<
    "select" | "pencil" | "rect" | "circle" | "x"
  >("pencil");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      isDrawingMode: true,
    });

    // Configure brush
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.width = 5;
    canvas.freeDrawingBrush.color = "#10b981"; // Green (Emerald)

    setFabricCanvas(canvas);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          canvas.setDimensions({ width, height });
          if (canvas.backgroundImage) {
            const img = canvas.backgroundImage as fabric.Image;
            const scaleX = width / img.width!;
            const scaleY = height / img.height!;
            const scale = Math.min(scaleX, scaleY);
            img.set({
              scaleX: scale,
              scaleY: scale,
              left: (width - img.width! * scale) / 2,
              top: (height - img.height! * scale) / 2,
            });
          }
          canvas.renderAll();
        }
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      canvas.dispose();
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!fabricCanvas || !containerRef.current) return;

    // Dynamically update canvas dimensions to match the raw HTML container's state
    fabricCanvas.setDimensions({
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    if (!backgroundImage) return;

    const isDataUrl = backgroundImage.startsWith("data:");
    const options = isDataUrl ? {} : { crossOrigin: "anonymous" };

    fabric.FabricImage.fromURL(backgroundImage, options).then((img) => {
      // Scale image to fit canvas
      const canvasWidth = fabricCanvas.width!;
      const canvasHeight = fabricCanvas.height!;
      const scaleX = canvasWidth / img.width!;
      const scaleY = canvasHeight / img.height!;
      const scale = Math.min(scaleX, scaleY);

      img.set({
        scaleX: scale,
        scaleY: scale,
        left: (canvasWidth - img.width! * scale) / 2,
        top: (canvasHeight - img.height! * scale) / 2,
        selectable: false,
        evented: false,
      });

      fabricCanvas.backgroundImage = img;
      fabricCanvas.renderAll();
    }).catch((err) => {
      console.error("Failed to load fabric background image:", err);
    });
  }, [fabricCanvas, backgroundImage, imageAspectRatio]);

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
        fabricCanvas.add(group);
        fabricCanvas.setActiveObject(group);
        setActiveTool("select");
        fabricCanvas.off("mouse:down");
      });
    }
  };

  const clearCanvas = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    // Re-render background if it exists
    if (backgroundImage) {
      const isDataUrl = backgroundImage.startsWith("data:");
      const options = isDataUrl ? {} : { crossOrigin: "anonymous" };
      fabric.FabricImage.fromURL(backgroundImage, options).then((img) => {
        const canvasWidth = fabricCanvas.width!;
        const canvasHeight = fabricCanvas.height!;
        const scaleX = canvasWidth / img.width!;
        const scaleY = canvasHeight / img.height!;
        const scale = Math.min(scaleX, scaleY);
        img.set({
          scaleX: scale,
          scaleY: scale,
          left: (canvasWidth - img.width! * scale) / 2,
          top: (canvasHeight - img.height! * scale) / 2,
          selectable: false,
          evented: false,
        });
        fabricCanvas.backgroundImage = img;
        fabricCanvas.renderAll();
      });
    }
  };

  const exportCanvas = () => {
    if (!fabricCanvas) return;
    try {
      const dataUrl = fabricCanvas.toDataURL({
        format: "jpeg",
        quality: 0.8,
      });
      onSave(dataUrl);
    } catch (err) {
      console.warn("toDataURL failed due to browser security restrictions:", err);
      // Resilient fallback: use original background image directly if canvas export is blocked
      if (backgroundImage) {
        onSave(backgroundImage);
      }
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
            colorClass="text-emerald-500/60 hover:text-emerald-400"
            activeColorClass="text-emerald-400 font-bold"
          />
          <ToolButton
            active={activeTool === "rect"}
            onClick={() => setTool("rect")}
            icon={<Square size={16} />}
            label="Box"
            colorClass="text-blue-500/60 hover:text-blue-400"
            activeColorClass="text-blue-400 font-bold"
          />
          <ToolButton
            active={activeTool === "circle"}
            onClick={() => setTool("circle")}
            icon={<Circle size={16} />}
            label="Circle"
            colorClass="text-blue-500/60 hover:text-blue-400"
            activeColorClass="text-blue-400 font-bold"
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
            className="px-5 py-2 bg-emerald-500 text-black rounded-lg font-black uppercase tracking-widest text-[10px] shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 transition-all"
          >
            Finalize Vision
          </button>
        </div>
      </div>

      <div className="flex-1 w-full h-full flex items-center justify-center min-h-0 p-4 relative">
        <div className="relative rounded-2xl border border-white/10 bg-black/40 overflow-hidden shadow-2xl flex items-center justify-center" style={{ maxWidth: '100%', maxHeight: '100%' }}>
          
          <img 
            src={backgroundImage || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'/%3E"}
            className="invisible"
            style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }}
            alt="sizer"
            {...((!backgroundImage || !backgroundImage.startsWith("data:")) ? { crossOrigin: "anonymous" } : {})}
          />

          <div
            ref={containerRef}
            className="absolute inset-0 w-full h-full"
          >
            <canvas ref={canvasRef} />
            {!backgroundImage && (
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-4 pointer-events-none">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                  <MousePointer2
                    size={32}
                    className="text-white/20 animate-bounce"
                  />
                </div>
                <p className="micro-label opacity-40">
                  Awaiting visual input feed...
                </p>
              </div>
            )}
          </div>
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
