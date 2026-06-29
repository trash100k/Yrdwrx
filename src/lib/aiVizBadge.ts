// @ts-nocheck

// Returns a NEW data URL with a semi-transparent rounded "pill" badge drawn in the bottom-right
// corner. label defaults to "AI VISUALIZATION". Scales padding/font to the image's longest edge so
// it looks right on any size. On any failure (load error, no 2d ctx), resolve with the ORIGINAL
// dataUrl unchanged (never throw).
export async function burnAiVizBadge(dataUrl: string, label?: string): Promise<string> {
  return new Promise<string>((resolve) => {
    try {
      const text = (label ?? "AI VISUALIZATION").toUpperCase();

      const img = new Image();
      // Only set crossOrigin for non-data URLs so the canvas isn't tainted by remote images.
      if (!dataUrl.startsWith("data:")) {
        img.crossOrigin = "anonymous";
      }

      img.onerror = () => resolve(dataUrl);

      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;

          if (!width || !height) {
            resolve(dataUrl);
            return;
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          const longestEdge = Math.max(width, height);
          const margin = Math.max(6, longestEdge * 0.015);
          const fontSize = Math.max(11, longestEdge * 0.018);
          const letterSpacing = Math.max(0.5, fontSize * 0.08);
          const padX = fontSize * 0.9;
          const padY = fontSize * 0.55;
          const dotRadius = fontSize * 0.28;
          const dotGap = fontSize * 0.5;

          // Configure text rendering so we can measure accurately.
          ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
          ctx.textBaseline = "middle";
          ctx.textAlign = "left";

          // Measure text width manually to account for letter spacing.
          let textWidth = 0;
          for (const ch of text) {
            textWidth += ctx.measureText(ch).width + letterSpacing;
          }
          if (text.length > 0) textWidth -= letterSpacing; // no trailing space

          const contentWidth = dotRadius * 2 + dotGap + textWidth;
          const pillWidth = contentWidth + padX * 2;
          const pillHeight = fontSize + padY * 2;

          const pillX = width - margin - pillWidth;
          const pillY = height - margin - pillHeight;
          const radius = pillHeight / 2;

          // Rounded-rect path for the pill.
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(pillX, pillY, pillWidth, pillHeight, radius);
          } else {
            const x = pillX;
            const y = pillY;
            const w = pillWidth;
            const h = pillHeight;
            const r = Math.min(radius, w / 2, h / 2);
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
          }

          // ~55% black fill.
          ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
          ctx.fill();

          const centerY = pillY + pillHeight / 2;
          let cursorX = pillX + padX;

          // Forest-green dot before the text.
          ctx.beginPath();
          ctx.fillStyle = "#10b981";
          ctx.arc(cursorX + dotRadius, centerY, dotRadius, 0, Math.PI * 2);
          ctx.fill();
          cursorX += dotRadius * 2 + dotGap;

          // White bold uppercase letter-spaced text.
          ctx.fillStyle = "#ffffff";
          for (const ch of text) {
            ctx.fillText(ch, cursorX, centerY);
            cursorX += ctx.measureText(ch).width + letterSpacing;
          }

          resolve(canvas.toDataURL("image/jpeg", 0.92));
        } catch (err) {
          resolve(dataUrl);
        }
      };

      img.src = dataUrl;
    } catch (err) {
      resolve(dataUrl);
    }
  });
}
