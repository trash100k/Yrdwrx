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
import { cn } from "../lib/utils";

interface MarkupCanvasProps {
  backgroundImage: string | null;
  onSave: (dataUrl: string) => void;
}

export default function MarkupCanvas({
  backgroundImage,
  onSave,
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
    canvas.freeDrawingBrush.color = "#10b981"; // Emerald 500

    setFabricCanvas(canvas);

    const handleResize = () => {
      if (containerRef.current) {
        canvas.setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      canvas.dispose();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!fabricCanvas || !backgroundImage) return;

    fabric.FabricImage.fromURL(backgroundImage).then((img) => {
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
    });
  }, [fabricCanvas, backgroundImage]);

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
          stroke: "#10b981",
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
          stroke: "#10b981",
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
      fabric.FabricImage.fromURL(backgroundImage).then((img) => {
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
    const dataUrl = fabricCanvas.toDataURL({
      format: "jpeg",
      quality: 0.8,
    });
    onSave(dataUrl);
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10">
          <ToolButton
            active={activeTool === "select"}
            onClick={() => setTool("select")}
            icon={<MousePointer2 size={18} />}
            label="Select"
          />
          <ToolButton
            active={activeTool === "pencil"}
            onClick={() => setTool("pencil")}
            icon={<Pencil size={18} />}
            label="Draw"
          />
          <ToolButton
            active={activeTool === "rect"}
            onClick={() => setTool("rect")}
            icon={<Square size={18} />}
            label="Box"
          />
          <ToolButton
            active={activeTool === "circle"}
            onClick={() => setTool("circle")}
            icon={<Circle size={18} />}
            label="Circle"
          />
          <ToolButton
            active={activeTool === "x"}
            onClick={() => setTool("x")}
            icon={<X size={18} />}
            label="Exclude"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={clearCanvas}
            className="p-3 bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-400 rounded-xl transition-all"
            title="Clear Markups"
            aria-label="Clear Markups"
          >
            <Trash2 size={18} />
          </button>
          <button
            onClick={exportCanvas}
            className="px-6 py-3 bg-emerald-500 text-black rounded-xl font-black uppercase tracking-widest text-xs md:text-[10px] shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 transition-all"
          >
            Finalize Vision
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 bg-black/40 rounded-2xl border border-white/10 overflow-hidden relative group"
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
  );
}

function ToolButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-[10px] font-black uppercase tracking-widest transition-all",
        active
          ? "bg-white text-black shadow-lg"
          : "text-zinc-400 hover:text-white hover:bg-white/5",
      )}
    >
      {icon}
      <span className="hidden sm:inline" aria-hidden="true">
        {label}
      </span>
    </button>
  );
}
