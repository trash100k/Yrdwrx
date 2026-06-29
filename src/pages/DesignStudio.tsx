import { fetchApi } from "../lib/api";
import { compressImage } from "../lib/imageUtils";
// @ts-nocheck
import { safeStorage } from '../lib/storage';
// @ts-nocheck
import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTenant } from "../contexts/TenantContext";
import { useRole } from "../hooks/useRole";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useToast } from "../contexts/ToastContext";
import { useWorkspaceOutbox } from "../contexts/WorkspaceOutboxContext";
import { DesignDatabasePanel } from "../components/DesignDatabasePanel";
import { useAuditLog } from "../hooks/useAuditLog";
import { motion, AnimatePresence } from "motion/react";
import {
  Camera,
  Sparkles,
  Mic,
  MicOff,
  ChevronRight,
  Image as ImageIcon,
  Trees,
  CheckCircle2,
  CloudLightning,
  Map,
  Activity,
  Plus,
  X,
  Target,
  AlertTriangle,
  BrainCircuit,
  Lock,
  Save,
  Database,
  Send,
  RefreshCw,
  Users,
  Download,
  Undo2,
  Redo2,
  Leaf
} from "lucide-react";
import MarkupCanvas from "../components/MarkupCanvas";
import BeforeAfterSlider from "../components/BeforeAfterSlider";
import Design3D from "../components/Design3D";
import { designVisionsRepo, designCatalogRepo, customersRepo } from "../lib/repos";
import { auth } from "../lib/firebase";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { playVoice } from "../lib/playVoice";
import { burnAiVizBadge } from "../lib/aiVizBadge";
import { resolveZone } from "../lib/plantIntelligence";
import SuggestedPalette from "../components/design/SuggestedPalette";
import {
  historyInit,
  historyPush,
  historyUndo,
  historyRedo,
  historyCurrent,
  canUndo,
  canRedo,
  buildProvenance,
} from "../lib/designSession";

interface DesignResult {
  identifiedAreas: Array<{
    id: string;
    description: string;
    suggestion: string;
  }>;
  visionSummary: string;
  estimatedMaterials: Array<{
    item: string;
    quantity: string;
    estimatedCost: number;
    geoSpatialVolume?: string;
  }>;
  strategicValue: string;
  approvalRequired?: boolean;
  botanicalViolations?: Array<{
    issue: string;
    severity: string;
    reason: string;
  }>;
  tiers?: {
    good: any;
    better: any;
    best: any;
  };
}

// Load an <img> for canvas compositing (anonymous CORS only for remote URLs).
function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.src = src;
  });
}

// Map a free w/h ratio to the nearest aspect-ratio enum the image model accepts.
function nearestAspect(ratio: number): string {
  const opts: Array<[string, number]> = [
    ["1:1", 1], ["4:3", 4 / 3], ["3:4", 3 / 4], ["3:2", 3 / 2], ["2:3", 2 / 3],
    ["16:9", 16 / 9], ["9:16", 9 / 16], ["5:4", 5 / 4], ["4:5", 4 / 5],
  ];
  let best = "4:3", bestD = Infinity;
  for (const [label, val] of opts) {
    const d = Math.abs(Math.log(ratio / val));
    if (d < bestD) { bestD = d; best = label; }
  }
  return best;
}

// THE GUARANTEE: composite the full-frame model output back over the byte-identical
// original through a feathered mask of the marked regions — so everything OUTSIDE the
// regions stays pixel-identical (no scene drift). Client-side; no server dependency.
async function compositeRegions(cleanUrl: string, renderUrl: string, regs: any[]): Promise<string> {
  const [base, gen] = await Promise.all([loadImageEl(cleanUrl), loadImageEl(renderUrl)]);
  const W = base.naturalWidth || base.width;
  const H = base.naturalHeight || base.height;
  if (!W || !H) return renderUrl;
  const out = document.createElement("canvas");
  out.width = W; out.height = H;
  const ctx = out.getContext("2d");
  if (!ctx) return renderUrl;
  // 1) the untouched original underneath
  ctx.drawImage(base, 0, 0, W, H);
  // 2) a feathered white mask of all regions
  const mask = document.createElement("canvas");
  mask.width = W; mask.height = H;
  const mctx = mask.getContext("2d");
  if (!mctx) return renderUrl;
  const feather = Math.max(8, Math.round(Math.max(W, H) * 0.012));
  for (const r of regs || []) {
    const cx = (r.cx ?? ((r.x ?? 0) + (r.w ?? 0) / 2)) * W;
    const cy = (r.cy ?? ((r.y ?? 0) + (r.h ?? 0) / 2)) * H;
    if (r.shape === "circle") {
      const rad = Math.max(6, (r.r || 0.08) * Math.max(W, H));
      const g = mctx.createRadialGradient(cx, cy, Math.max(1, rad - feather), cx, cy, rad + feather);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      mctx.fillStyle = g;
      mctx.beginPath();
      mctx.arc(cx, cy, rad + feather, 0, Math.PI * 2);
      mctx.fill();
    } else {
      const w = (r.w || 0.2) * W;
      const h = (r.h || 0.2) * H;
      const x = (r.x ?? (r.cx - (r.w || 0.2) / 2)) * W;
      const y = (r.y ?? (r.cy - (r.h || 0.2) / 2)) * H;
      mctx.save();
      (mctx as any).filter = `blur(${feather}px)`;
      mctx.fillStyle = "white";
      mctx.fillRect(x, y, w, h);
      mctx.restore();
    }
  }
  // 3) model output, clipped to the mask
  const layer = document.createElement("canvas");
  layer.width = W; layer.height = H;
  const lctx = layer.getContext("2d");
  if (!lctx) return renderUrl;
  lctx.drawImage(gen, 0, 0, W, H);
  lctx.globalCompositeOperation = "destination-in";
  lctx.drawImage(mask, 0, 0);
  // 4) masked model output over the original
  ctx.drawImage(layer, 0, 0);
  return out.toDataURL("image/jpeg", 0.9);
}

// Phase 3 "Precise" mode (crop-and-paste-back v2): send only the cropped neighborhood
// around a single region to the model, region-composite within the crop, then paste the
// crop back into the original. Less global drift + lower token cost than full-frame.
async function cropPlaceRender(base: string, region: any, opts: { description?: string; zone?: number }): Promise<any> {
  const baseImg = await loadImageEl(base);
  const W = baseImg.naturalWidth || baseImg.width;
  const H = baseImg.naturalHeight || baseImg.height;
  if (!W || !H) return null;
  const cx = (region.cx ?? 0.5) * W;
  const cy = (region.cy ?? 0.5) * H;
  const rPx = region.r ? region.r * Math.max(W, H) : region.w ? (region.w * W) / 2 : 0.12 * Math.max(W, H);
  const pad = Math.max(rPx * 2.2, Math.min(W, H) * 0.18);
  const x0 = Math.max(0, Math.round(cx - pad));
  const y0 = Math.max(0, Math.round(cy - pad));
  const x1 = Math.min(W, Math.round(cx + pad));
  const y1 = Math.min(H, Math.round(cy + pad));
  const cw = x1 - x0, ch = y1 - y0;
  if (cw < 8 || ch < 8) return null;

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = cw; cropCanvas.height = ch;
  const cctx = cropCanvas.getContext("2d");
  if (!cctx) return null;
  cctx.drawImage(baseImg, x0, y0, cw, ch, 0, 0, cw, ch);
  const cropUrl = cropCanvas.toDataURL("image/jpeg", 0.92);

  // The object goes at the crop's center; radius relative to the crop.
  const cropRegion = { id: "c", intent: "add", shape: "circle", cx: (cx - x0) / cw, cy: (cy - y0) / ch, r: rPx / Math.max(cw, ch), label: region.label };
  const res = await fetchApi("/api/design/place-objects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: cropUrl, regions: [cropRegion], description: opts.description, zone: opts.zone }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error || !data.imageUrl) return null;
  if (data.mock) return { mock: true };

  // Region-composite within the crop so only the marked area changes, then hard-paste the
  // crop back (its non-region pixels equal the original base at that location, so edges align).
  const editedCrop = await compositeRegions(cropUrl, data.imageUrl, [cropRegion]).catch(() => data.imageUrl);
  const editedImg = await loadImageEl(editedCrop);
  const out = document.createElement("canvas");
  out.width = W; out.height = H;
  const octx = out.getContext("2d");
  if (!octx) return null;
  octx.drawImage(baseImg, 0, 0, W, H);
  octx.drawImage(editedImg, 0, 0, editedImg.naturalWidth || cw, editedImg.naturalHeight || ch, x0, y0, cw, ch);
  return { image: out.toDataURL("image/jpeg", 0.92) };
}

export default function DesignStudio() {
  const location = useLocation();
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const { addLog } = useWorkspaceOutbox();
  const { role } = useRole();
  const { logAction } = useAuditLog();
  const [image, setImage] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (image) {
      const img = new Image();
      img.onload = () => {
        setImageAspectRatio(img.width / img.height);
      };
      img.src = image;
    } else {
      setImageAspectRatio(null);
    }
  }, [image]);
  const [result, setResult] = useState<DesignResult | null>(null);
  const [mockupImage, setMockupImage] = useState<string | null>(null);
  const [isGeneratingMockup, setIsGeneratingMockup] = useState(false);
  const { transcript: hookTranscript, isListening: isRecording, startListening, stopListening, setTranscript: setHookTranscript } = useSpeechRecognition();
  const [transcript, setTranscript] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [overriddenViolations, setOverriddenViolations] = useState(false);

  const [isGeneratingTiers, setIsGeneratingTiers] = useState(false);
const [activeTier, setActiveTier] = useState<"standard" | "good" | "better" | "best">("standard");
  const [activeView, setActiveView] = useState<"studio" | "database">("studio");
  const [activeTab, setActiveTab] = useState<"scribble" | "compare" | "preview3d">("scribble");

  useEffect(() => {
    if (hookTranscript) {
      setTranscript(hookTranscript);
    }
  }, [hookTranscript]);

  const toggleRecording = () => {
    if (isRecording) {
      stopListening();
      if (transcript.length > 10) {
        showToast("Voice notes captured.", "success");
      }
    } else {
      startListening();
      setTranscript("");
      showToast("Listening... speak your design notes.", "success");
    }
  };

  useEffect(() => {
    if (!safeStorage.getItem("cutty-design-studio-onboarding")) {
      setShowOnboarding(true);
    }
  }, []);

  const closeOnboarding = () => {
    safeStorage.setItem("cutty-design-studio-onboarding", "true");
    setShowOnboarding(false);
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeCustomer, setActiveCustomer] = useState<{
    name?: string;
    id?: string;
    firstName?: string;
    lastName?: string;
    address?: string;
    email?: string;
    data?: any;
  } | null>(null);

  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  // All customers, so a vision can be attached to a client right here (not only when
  // the agent navigates in with a preloaded customer).
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [isSendingToClient, setIsSendingToClient] = useState(false);
  // Region-aware placement: the clean photo + the semantic regions the user marked, plus a
  // per-region label ("what goes here"). Drives the /api/design/place-objects render.
  const [cleanImage, setCleanImage] = useState<string | null>(null);
  const [regions, setRegions] = useState<any[]>([]);
  const [regionLabels, setRegionLabels] = useState<Record<string, string>>({});
  // Pre-badge composite of the latest render, so "Refine" iterates on the clean result
  // (the spec's invariant: feed the composited HEAD back, never the badged display image).
  const [lastComposite, setLastComposite] = useState<string | null>(null);
  // Render history for undo/redo across iterations.
  const [history, setHistory] = useState(() => historyInit());
  const [designZone, setDesignZone] = useState<number | "">("");
  const [designSnap, setDesignSnap] = useState(true);
  const [designPrecise, setDesignPrecise] = useState(false);
  const [isPdfing, setIsPdfing] = useState(false);

  // Resolve a working USDA zone (contractor can override) so the AI places zone-appropriate
  // plants — from the tenant's configured zone, else the customer's ZIP, else their state.
  useEffect(() => {
    const addr = activeCustomer?.address || activeCustomer?.data?.address || "";
    const zip = (String(addr).match(/\b(\d{5})(?:-\d{4})?\b/) || [])[1];
    const state = activeCustomer?.data?.state || (activeCustomer as any)?.state;
    const r = resolveZone({ explicit: (tenant?.settings as any)?.zone ?? null, zip, state });
    if (r.zone) setDesignZone(r.zone);
  }, [activeCustomer?.id, tenant]);

  useEffect(() => {
    if (!tenant) return;
    const unsub = designCatalogRepo.subscribe((rows: any[]) => {
      setCatalogItems(rows || []);
    });
    return unsub;
  }, [tenant]);

  useEffect(() => {
    if (!tenant) return;
    customersRepo.list().then((rows: any[]) => setAllCustomers(rows || [])).catch(() => {});
  }, [tenant]);

  const customerLabel = (c: any) =>
    (c?.name ||
      `${c?.firstName || c?.first_name || ""} ${c?.lastName || c?.last_name || ""}`.trim() ||
      c?.companyName ||
      c?.company_name ||
      "Unnamed client").trim();

  // Preload the customer handed in via router state (e.g. from the agent's
  // "design for <client>" action, which navigates here with { state: { customer } }).
  // The agent passes a repo-shaped customer (snake_case top-level + a `.data` jsonb),
  // so normalize to the camelCase shape activeCustomer/the header expect.
  useEffect(() => {
    const c = location.state?.customer;
    if (c) {
      const firstName = c.firstName || c.first_name || "";
      const lastName = c.lastName || c.last_name || "";
      const normalized = {
        ...c,
        id: c.id,
        firstName,
        lastName,
        name:
          c.name ||
          `${firstName} ${lastName}`.trim() ||
          c.company_name ||
          c.companyName ||
          "",
        address: c.address || c.data?.address || "",
      };
      setActiveCustomer(normalized);
      setTranscript(
        `Suggest a design for ${firstName || "this client"}'s yard...`,
      );
    }
  }, [location.state]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await compressImage(file, 1200, 1200, 0.8);
        
        setImage(base64);
        setActiveTab("scribble");
        
        // Also capture the original natural aspect ratio
        const img = new Image();
        img.onload = () => {
          setImageAspectRatio(img.width / img.height);
        };
        img.src = base64;
      } catch (err) {
        console.error("Image compression error:", err);
      }
    }
  };

  const generateMockup = async () => {
    if (!image || !result) return;
    setIsGeneratingMockup(true);
    try {
        const description = (result.identifiedAreas || []).map(a => a.suggestion).join(". ");
        const placeRegions = (regions || []).filter((r: any) => r.intent === "add" || r.intent === "remove");

        // Region-aware path: place each marked object exactly where it was drawn, then
        // composite client-side so the rest of the scene stays pixel-identical.
        if (placeRegions.length) {
          const base = cleanImage || image;

          // Phase 3 Precise mode: single-region crop-and-paste-back (less drift, lower cost).
          if (designPrecise && placeRegions.length === 1 && placeRegions[0].intent === "add") {
            const r0 = { ...placeRegions[0], label: regionLabels[placeRegions[0].id] || "" };
            const cp = await cropPlaceRender(base, r0, { description: transcript || description, zone: designZone || undefined });
            if (!cp) { showToast("Couldn't render the precise placement. Try again.", "error"); return; }
            if (cp.mock) {
              showToast("Preview echoes your photo — AI rendering needs a Gemini key.", "info");
              setMockupImage(base); setActiveTab("compare"); return;
            }
            setLastComposite(cp.image);
            const badgedCp = await burnAiVizBadge(cp.image).catch(() => cp.image);
            setMockupImage(badgedCp);
            setHistory((h) => historyPush(h, { image: badgedCp, composite: cp.image, regions: [r0], labels: regionLabels, ts: Date.now() }));
            setActiveTab("compare");
            showToast("Precise render ready — swipe to compare.", "success");
            return;
          }

          let regs = placeRegions.map((r: any) => ({ ...r, label: regionLabels[r.id] || "" }));

          // Smart snap: refine each "add" region to the real surface under its center
          // (best-effort; mock mode / no box -> keep the user's drawn region).
          if (designSnap) {
            regs = await Promise.all(
              regs.map(async (r: any) => {
                if (r.intent !== "add") return r;
                try {
                  const sres = await fetchApi("/api/design/segment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image: base, cx: r.cx, cy: r.cy }),
                  });
                  const sd = await sres.json().catch(() => ({}));
                  if (sres.ok && sd?.box) {
                    const b = sd.box;
                    return { ...r, shape: "rect", x: b.x, y: b.y, w: b.w, h: b.h, cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
                  }
                } catch { /* keep drawn region */ }
                return r;
              }),
            );
          }

          const baseDesc = transcript || description;
          const MAX = 2;
          let attempt = 0, lastJudge: any = null, composited: any = null;
          while (attempt < MAX) {
            const fixHint = attempt > 0 && lastJudge?.fixHint ? ` Improve: ${lastJudge.fixHint}` : "";
            const response = await fetchApi("/api/design/place-objects", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image: base,
                regions: regs,
                description: baseDesc + fixHint,
                aspectRatio: imageAspectRatio ? nearestAspect(imageAspectRatio) : undefined,
                zone: designZone || undefined,
              }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data?.error) {
              showToast(data?.error || "Couldn't render the placement. Try again.", "error");
              return;
            }
            if (data.mock) {
              showToast("Preview echoes your photo — AI rendering needs a Gemini key.", "info");
              setMockupImage(base);
              setActiveTab("compare");
              return;
            }
            if (!data.imageUrl) {
              showToast("No preview image was returned.", "error");
              return;
            }
            composited = await compositeRegions(base, data.imageUrl, regs).catch(() => data.imageUrl);
            // Auto-verify; retry once with the judge's fix hint (mock judge -> PASS).
            try {
              const jres = await fetchApi("/api/design/judge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ beforeImage: base, afterImage: composited, instruction: baseDesc }),
              });
              lastJudge = await jres.json().catch(() => ({ verdict: "PASS" }));
            } catch {
              lastJudge = { verdict: "PASS" };
            }
            if (lastJudge?.verdict === "PASS" || lastJudge?.mock || attempt >= MAX - 1) break;
            attempt++;
          }

          setLastComposite(composited);
          const badged = await burnAiVizBadge(composited).catch(() => composited);
          setMockupImage(badged);
          setHistory((h) => historyPush(h, { image: badged, composite: composited, regions: regs, labels: regionLabels, ts: Date.now() }));
          setActiveTab("compare");
          if (lastJudge && lastJudge.verdict && lastJudge.verdict !== "PASS" && !lastJudge.mock) {
            showToast("Render ready — quality check flagged it; try Variation or Refine.", "warning");
          } else {
            showToast("Render ready — swipe to compare.", "success");
          }
          return;
        }

        // Fallback: whole-image restyle when no regions were marked.
        const response = await fetchApi("/api/design/generate-mockup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: image, description })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data?.error) {
          showToast(data?.error || "Couldn't render the preview. Try again.", "error");
          return;
        }
        if (data.mock) {
          showToast("Preview shows your original photo — AI rendering needs a Gemini key.", "info");
        }
        if (data.imageUrl) {
          const finalImg = data.mock ? data.imageUrl : await burnAiVizBadge(data.imageUrl).catch(() => data.imageUrl);
          setLastComposite(data.imageUrl);
          setMockupImage(finalImg);
          if (!data.mock) setHistory((h) => historyPush(h, { image: finalImg, composite: data.imageUrl, ts: Date.now() }));
          setActiveTab("compare");
          if (!data.mock) showToast("Render ready — swipe the slider to compare.", "success");
        } else {
          showToast("No preview image was returned.", "error");
        }
    } catch(e) {
        console.error(e);
        showToast("Network error during preview render.", "error");
    } finally {
        setIsGeneratingMockup(false);
    }
  };

  // MarkupCanvas finalize: stash the clean photo + semantic regions for the placement
  // render, then run the analysis pass on the annotated composite (unchanged behavior).
  const handleFinalize = (payload: any) => {
    setCleanImage(payload?.clean || image);
    setRegions(Array.isArray(payload?.regions) ? payload.regions : []);
    processDesign(payload?.composite || image);
  };

  const processDesign = async (markedUpImage: string) => {
    setIsProcessing(true);
    setResult(null);
    setMockupImage(null);
    setOverriddenViolations(false);

    try {
      const response = await fetchApi("/api/design/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: markedUpImage,
          prompt:
            transcript ||
            "Suggest a design transformation for this yard based on the markup.",
          role: role,
          settings: {
            ...tenant?.settings?.subFeatures,
            customInstallRules: tenant?.settings?.customInstallRules,
            designCatalog: catalogItems,
            serviceCatalog: tenant?.settings?.serviceCatalog,
            inventory: catalogItems,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.error) {
        const msg = data?.error || `Design analysis failed (${response.status}).`;
        showToast(
          /gemini|quota|key|limit/i.test(msg)
            ? msg
            : "Couldn't analyze the design. Try again.",
          "error",
        );
        return;
      }
      if (!data.identifiedAreas?.length && !data.visionSummary) {
        showToast(
          "No suggestions came back — add some markup or voice notes and retry.",
          "info",
        );
      }
      setResult(data);
      if (data.identifiedAreas?.length && (tenant?.settings as any)?.voiceEnabled !== false) {
        let textToSpeek = "Here is the plan. ";
        data.identifiedAreas.slice(0, 2).forEach((a: any) => {
          textToSpeek += a.suggestion + ". ";
        });
        playVoice(textToSpeek);
      }
    } catch (error) {
      console.error("Design Processing Error:", error);
      showToast("Network error during design analysis.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const generateTiers = async () => {
    if (!result) return;
    setIsGeneratingTiers(true);
    try {
      const response = await fetchApi("/api/design/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baselineResult: result,
          settings: {
            ...tenant?.settings?.subFeatures,
            customInstallRules: tenant?.settings?.customInstallRules,
            designCatalog: catalogItems,
            serviceCatalog: tenant?.settings?.serviceCatalog,
            inventory: catalogItems,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.error || !data?.tiers) {
        showToast(data?.error || "Couldn't generate Good/Better/Best packages.", "error");
        return;
      }
      setResult((prev: any) => ({
        ...prev,
        tiers: data.tiers,
      }));
      setActiveTier("better");
      showToast("Good / Better / Best packages ready.", "success");
    } catch (error) {
      console.error("Design Tiers Error:", error);
      showToast("Network error generating packages.", "error");
    } finally {
      setIsGeneratingTiers(false);
    }
  };

  const canSeeCosts = role !== "employee" && role !== "foreman";

  // Running estimated total. When tiers exist and an explicit tier is selected,
  // prefer the tier's totalCost; otherwise sum the active material list.
  const activeMaterials =
    result?.tiers && activeTier !== "standard"
      ? result.tiers[activeTier]?.estimatedMaterials || []
      : result?.estimatedMaterials || [];

  const materialsTotal = activeMaterials.reduce(
    (sum: number, m: any) => sum + (Number(m?.estimatedCost) || 0),
    0,
  );

  const tierTotal =
    result?.tiers && activeTier !== "standard"
      ? Number(result.tiers[activeTier]?.totalCost) || 0
      : 0;

  const estimatedTotal = tierTotal || materialsTotal;

  const formatCurrency = (n: number) =>
    `$${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const [isSavingVision, setIsSavingVision] = useState(false);

  const handleSaveToQuote = async () => {
    if (!result) return;
    setIsSavingVision(true);
    try {
      await designVisionsRepo.create({
        customer_id: activeCustomer?.id ?? null,
        summary: result.visionSummary,
        proposal: {
          ...result,
          provenance: buildProvenance({
            model: "gemini-2.5-flash-image",
            prompt: transcript,
            zone: designZone || null,
            regionCount: (regions || []).length,
            ts: Date.now(),
          }),
        },
        before_url: image,
        after_url: mockupImage,
      });
      showToast("Design vision saved to quote.", "success");
    } catch (err) {
      console.error("Save vision error:", err);
      showToast("Could not save vision. Check connection.", "error");
    } finally {
      setIsSavingVision(false);
    }
  };

  // Email the design vision straight to the attached client (uses the server email path;
  // honest when email isn't configured — saved/simulated rather than faking a send).
  const handleSendToClient = async () => {
    if (!result) return;
    const email = activeCustomer?.email || activeCustomer?.data?.email;
    if (!email) {
      showToast("Attach a client with an email first (top of page).", "error");
      return;
    }
    setIsSendingToClient(true);
    try {
      const lines: string[] = [];
      lines.push(`Hi ${activeCustomer?.firstName || customerLabel(activeCustomer)},`);
      lines.push("");
      lines.push(result.visionSummary || "Here is the design vision for your yard.");
      if (canSeeCosts && estimatedTotal > 0) {
        lines.push("");
        lines.push(`Estimated investment: ${formatCurrency(estimatedTotal)}`);
      }
      if (activeMaterials.length) {
        lines.push("");
        lines.push("Highlights:");
        activeMaterials.slice(0, 8).forEach((m: any) => lines.push(`• ${m.item} (${m.quantity})`));
      }
      lines.push("");
      lines.push(`— ${tenant?.name || "YardWorx"}`);
      const res = await fetchApi("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject: `Your yard design from ${tenant?.name || "YardWorx"}`,
          text: lines.join("\n"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.sent) {
        showToast("Design sent to the client.", "success");
        addLog({ type: "email", recipient: email, subject: "Yard design", content: result.visionSummary || "Design vision" });
      } else if (data.simulated) {
        showToast("Email isn't configured yet — drafted to your outbox instead.", "info");
        addLog({ type: "email", recipient: email, subject: "Yard design", content: result.visionSummary || "Design vision" }, "draft");
      } else {
        showToast(data.error || "Couldn't send the design.", "error");
      }
    } catch (err) {
      console.error("Send design error:", err);
      showToast("Network error sending the design.", "error");
    } finally {
      setIsSendingToClient(false);
    }
  };

  // Download the rendered "after" image (or the saved vision) so it can be shared offline.
  const downloadMockup = () => {
    if (!mockupImage) return;
    try {
      const a = document.createElement("a");
      a.href = mockupImage;
      a.download = `YardWorx-Design-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      showToast("Couldn't download the image.", "error");
    }
  };

  // Iterate: make the current render the new base, so the next placement composites onto
  // it (place object after object). Uses the pre-badge composite so badges never compound.
  const refineOnRender = () => {
    const head = lastComposite || mockupImage;
    if (!head) return;
    setCleanImage(head);
    setImage(head);
    setMockupImage(null);
    setRegions([]);
    setRegionLabels({});
    setResult((prev: any) => prev); // keep the analysis/materials context
    setActiveTab("scribble");
    showToast("Mark new spots on this design to keep refining.", "info");
  };

  const stepHistory = (dir: "undo" | "redo") => {
    const nh = dir === "undo" ? historyUndo(history) : historyRedo(history);
    setHistory(nh);
    const snap = historyCurrent(nh);
    if (snap) {
      setMockupImage(snap.image);
      setLastComposite(snap.composite || null);
      setActiveTab("compare");
    }
  };

  // Apply a zone-grounded palette: fill empty marked spots with the picks (in order) and
  // merge the priced items into the materials list so the estimate reflects the design.
  const applyPalette = (palette: any) => {
    const addRegs = (regions || []).filter((r: any) => r.intent === "add");
    setRegionLabels((prev) => {
      const next = { ...prev };
      (palette?.labels || []).forEach((lbl: string, i: number) => {
        const r = addRegs[i];
        if (r && !next[r.id]) next[r.id] = lbl;
      });
      return next;
    });
    const palItems = (palette?.items || []).map(({ item, qty }: any) => ({
      item: item.name,
      quantity: `${qty} ${item.unit || "each"}`,
      estimatedCost: (Number(item.unitPrice) || 0) * qty,
    }));
    setResult((prev: any) =>
      prev ? { ...prev, estimatedMaterials: [...(prev.estimatedMaterials || []), ...palItems] } : prev,
    );
    showToast("Palette applied to your spots + materials.", "success");
  };

  // Branded before/after + itemized proposal PDF the contractor hands the client.
  const handleProposalPdf = async () => {
    if (!result) return;
    setIsPdfing(true);
    try {
      const clientName =
        activeCustomer?.name ||
        `${activeCustomer?.firstName || ""} ${activeCustomer?.lastName || ""}`.trim();
      const res = await fetchApi("/api/design/proposal-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beforeImage: cleanImage || image,
          afterImage: mockupImage,
          visionSummary: result.visionSummary,
          materials: activeMaterials,
          total: estimatedTotal,
          clientName,
          tenantName: tenant?.name,
          strategicValue: result.strategicValue,
        }),
      });
      if (!res.ok) {
        showToast("Couldn't generate the proposal PDF.", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "design-proposal.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Proposal PDF downloaded.", "success");
    } catch (e) {
      console.error("proposal pdf error", e);
      showToast("Network error generating the proposal PDF.", "error");
    } finally {
      setIsPdfing(false);
    }
  };

  // Read back this client's previously-saved visions so they aren't write-only.
  const [savedVisions, setSavedVisions] = useState<any[]>([]);
  useEffect(() => {
    if (!activeCustomer?.id) {
      setSavedVisions([]);
      return;
    }
    let active = true;
    designVisionsRepo
      .list()
      .then((rows: any[]) => {
        if (active) setSavedVisions((rows || []).filter((r) => r.customerId === activeCustomer.id));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activeCustomer?.id, isSavingVision]);

  const reopenVision = (v: any) => {
    if (!v) return;
    setResult(v.proposal || null);
    setImage(v.beforeUrl || null);
    setMockupImage(v.afterUrl || null);
    showToast("Loaded saved vision.", "success");
  };

  const [isSavingDrive, setIsSavingDrive] = useState(false);

  const handleSaveToDrive = async () => {
    if (!result) return;
    if (!auth) {
      showToast("Google integration isn't configured yet.", "error");
      return;
    }
    setIsSavingDrive(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/drive.file");
      const authResult = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(authResult);
      if (!credential?.accessToken) throw new Error("No token");

      const filename = `YardWorx-Design-${Date.now()}.json`;
      const content = JSON.stringify(result, null, 2);

      const res = await fetchApi("/api/integration/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          accessToken: credential.accessToken, 
          filename, 
          content, 
          mimeType: "application/json" 
        })
      });

      if (!res.ok) throw new Error("Drive upload failed");
      addLog({ type: "backup", recipient: "Google Drive", subject: "Design Backup", content: "Design exported successfully." });
    } catch (err: any) {
      console.error(err);
      addLog({ type: "backup", recipient: "Google Drive", subject: "Design Backup", content: err.message }, "failed");
    } finally {
      setIsSavingDrive(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-12">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-5 lg:gap-10 pb-5 sm:pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-forest-500/10 rounded-full border border-forest-500 text-xs font-black uppercase tracking-widest text-forest-500">
            <div className="w-2 h-2 bg-forest-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
            Design Studio Ready
          </div>
          <h1 className="text-3xl sm:text-3xl sm:text-5xl lg:text-6xl break-words font-sans font-black tracking-normal md:tracking-tighter leading-none text-white italic uppercase">
            Yard Designer
          </h1>
          <p className="max-w-xl text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2 leading-relaxed">
            {activeCustomer
              ? `Architecting transformation for ${activeCustomer.firstName} ${activeCustomer.lastName}'s property at ${activeCustomer.address}.`
              : "Upload a photo of the yard, mark what you want changed, and let YardWorx help you design."}
          </p>

          {activeView === "studio" && (
            <div className="flex items-center gap-2 max-w-xl">
              <Users size={14} className="text-forest-400 shrink-0" />
              <label htmlFor="design-client-picker" className="sr-only">Attach a client</label>
              <select
                id="design-client-picker"
                value={activeCustomer?.id || ""}
                onChange={(e) => {
                  const c = allCustomers.find((x) => x.id === e.target.value);
                  if (!c) { setActiveCustomer(null); return; }
                  const firstName = c.firstName || c.first_name || "";
                  const lastName = c.lastName || c.last_name || "";
                  setActiveCustomer({
                    ...c,
                    id: c.id,
                    firstName,
                    lastName,
                    name: customerLabel(c),
                    address: c.address || c.data?.address || "",
                    email: c.email || c.data?.email || "",
                  });
                }}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white/80 uppercase tracking-widest focus:border-forest-500/40 focus:outline-none"
              >
                <option value="">No client attached</option>
                {allCustomers.map((c) => (
                  <option key={c.id} value={c.id}>{customerLabel(c)}</option>
                ))}
              </select>
            </div>
          )}

          {activeCustomer?.id && savedVisions.length > 0 && (
            <div className="mt-4 max-w-xl">
              <p className="text-[10px] font-black uppercase tracking-widest text-forest-400 mb-2">
                Saved visions for this client — tap to reopen
              </p>
              <div className="flex flex-wrap gap-2">
                {savedVisions.slice(0, 6).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => reopenVision(v)}
                    title={v.summary || "Saved vision"}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-forest-500/40 hover:bg-forest-500/10 text-xs font-bold text-white/80 transition-all max-w-[240px] truncate"
                  >
                    {(v.summary || "Vision").slice(0, 44)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(role === "admin" || role === "owner") && (
            <div className="flex bg-black p-1 rounded-2xl border-2 border-white/10 mt-8 w-fit">
              <button
                onClick={() => setActiveView("studio")}
                className={`py-2 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                  activeView === "studio" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
                }`}
              >
                Studio UI
              </button>
              <button
                onClick={() => setActiveView("database")}
                className={`flex items-center gap-2 py-2 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                  activeView === "database" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
                }`}
              >
                <Database size={14} /> Catalog DB
              </button>
            </div>
          )}
        </div>

        {activeView === "studio" && (
          <div className="flex gap-4 shrink-0">
            {!image && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-5 bg-white text-black font-semibold text-sm rounded-xl shadow-sm border border-transparent hover:bg-zinc-200 hover:scale-105 active:scale-95 transition-transform cursor-pointer shrink-0"
              >
                <Camera size={24} />
                Upload Photo
              </button>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
          </div>
        )}
      </header>

      {activeView === "database" ? (
        <DesignDatabasePanel />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Step progression tracking line */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-2xl border border-white/5 text-sm">
            {/* Step 1 */}
            <div className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-black ${!image ? "bg-forest-500 text-black shadow-[0_0_15px_rgba(5,168,69,0.3)] animate-pulse" : "bg-white/10 text-white/40"}`}>1</span>
              <div>
                <span className={`font-black uppercase tracking-widest text-[10px] block ${!image ? "text-white" : "text-zinc-500"}`}>Step 1: Point & Shoot</span>
              </div>
            </div>
            <div className="hidden sm:block text-zinc-800 text-xs font-mono">─────────</div>
            {/* Step 2 */}
            <div className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-black ${image && !result ? "bg-forest-500 text-black shadow-[0_0_15px_rgba(5,168,69,0.3)] animate-pulse" : "bg-white/10 text-white/40"}`}>2</span>
              <div>
                <span className={`font-black uppercase tracking-widest text-[10px] block ${image && !result ? "text-white" : "text-zinc-500"}`}>Step 2: Scribble & Talk</span>
              </div>
            </div>
            <div className="hidden sm:block text-zinc-800 text-xs font-mono">─────────</div>
            {/* Step 3 */}
            <div className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-black ${result ? "bg-forest-500 text-black shadow-[0_0_15px_rgba(5,168,69,0.3)] animate-pulse" : "bg-white/10 text-white/40"}`}>3</span>
              <div>
                <span className={`font-black uppercase tracking-widest text-[10px] block ${result ? "text-white" : "text-zinc-500"}`}>Step 3: Reveal Comparison</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
            {/* Workspace Matrix */}
            <div className="xl:col-span-8 flex flex-col gap-6">
              {/* Workspace Navigation Header */}
              {image && (
                <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10 w-fit shrink-0 gap-2">
                  <button
                    onClick={() => setActiveTab("scribble")}
                    className={`py-2 px-5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                      activeTab === "scribble" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
                    }`}
                  >
                    ✏️ Tracing & Scribbles
                  </button>
                  {mockupImage && (
                    <button
                      onClick={() => setActiveTab("compare")}
                      className={`py-2 px-5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                        activeTab === "compare" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
                      }`}
                    >
                      ✨ Interactive Slider
                    </button>
                  )}
                  {result && (
                    <button
                      onClick={() => setActiveTab("preview3d")}
                      className={`py-2 px-5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                        activeTab === "preview3d" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
                      }`}
                    >
                      ✨ 3D Preview
                    </button>
                  )}
                </div>
              )}

              <div className={`flex-1 bg-black/40 rounded-2xl border border-white/5 p-2 sm:p-6 relative overflow-hidden transition-all flex flex-col min-h-[65vh] xl:min-h-[600px]`}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-forest-500/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />

                <div className="flex-1 relative flex items-center justify-center min-h-0">
                  {!image ? (
                    <div 
                      className="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-xl hover:border-forest-500/20 hover:bg-white/[0.02] cursor-pointer transition-all text-center p-8 group"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="w-20 h-20 bg-forest-500/10 rounded-3xl flex items-center justify-center border border-forest-500/20 group-hover:scale-110 transition-transform text-forest-400 mb-6 shadow-[0_10px_30px_rgba(5,168,69,0.1)]">
                        <Camera size={36} />
                      </div>
                      <h3 className="text-xl font-black italic uppercase tracking-wider text-white mb-2">📸 Point & Shoot</h3>
                      <p className="text-zinc-500 text-xs max-w-xs font-bold uppercase tracking-wider leading-relaxed mb-6">
                        Snap or upload a photo of the client's current yard here to start scribbling.
                      </p>
                      <span className="px-6 py-3.5 bg-white text-black text-xs font-black uppercase tracking-widest rounded-xl shadow-lg transition-transform active:scale-95">
                        Choose Photo
                      </span>
                    </div>
                  ) : activeTab === "preview3d" && result ? (
                    <div className="absolute inset-0 p-1">
                      <Design3D result={result} image={image} />
                    </div>
                  ) : activeTab === "compare" && mockupImage ? (
                    <BeforeAfterSlider beforeImage={image} afterImage={mockupImage} imageAspectRatio={imageAspectRatio} />
                  ) : (
                    <MarkupCanvas backgroundImage={image} onSave={handleFinalize} imageAspectRatio={imageAspectRatio} />
                  )}

                  <AnimatePresence>
                    {isProcessing && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm rounded-xl"
                      >
                        <div className="w-16 h-16 border-4 border-forest-500/20 border-t-forest-500 rounded-full animate-spin shadow-[0_0_15px_rgba(5,168,69,0.2)]" />
                        <p className="mt-6 font-black uppercase tracking-[0.2em] text-forest-400 text-xs">
                          Gemini Analyzing Scene...
                        </p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mt-2">formulating geo-spatial materials</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Voice Interface Dock */}
              {image && (
                <div className="h-28 bg-zinc-900 border border-white/5 molten-edge rounded-2xl p-4 flex items-center gap-6 shrink-0 transition-all">
                  <button
                    onClick={toggleRecording}
                    aria-label={
                      isRecording
                        ? "Stop recording voice notes"
                        : "Capture voice notes"
                    }
                    className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all ${
                      isRecording
                        ? "bg-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                        : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
                  </button>

                  <div className="flex-1">
                    <p className="micro-label text-zinc-500 mb-2 uppercase tracking-widest font-black flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-zinc-600'}`} />
                      Explain Your Intent & talk to Gemini
                    </p>
                    <label htmlFor="voice-notes-input" className="sr-only">
                      Voice notes transcript
                    </label>
                    <input
                      id="voice-notes-input"
                      type="text"
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      placeholder={
                        isRecording
                          ? "Listening to site requirements... speak now..."
                          : "Explain design intent... press the Mic to dictate..."
                      }
                      className="w-full bg-transparent border-none p-0 text-base font-bold italic text-white placeholder:text-zinc-500 focus:ring-0 focus:outline-none"
                    />
                  </div>

                  {isRecording && (
                    <div className="flex items-center gap-1.5 px-6">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <motion.div
                          key={i}
                          animate={{ height: [10, 32, 10] }}
                          transition={{
                            duration: 0.5,
                            repeat: Infinity,
                            delay: i * 0.1,
                          }}
                          className="w-1 bg-red-500 rounded-full"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Intelligence Panel */}
            <aside className="xl:col-span-4 flex flex-col gap-6 min-w-0">
              {/* Design Results Nodes */}
              <div className="flex-1 bg-zinc-900/50 border border-white/5 rounded-2xl p-6 overflow-y-auto no-scrollbar relative min-h-[500px]">
                <AnimatePresence mode="wait">
                  {isProcessing ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col items-center justify-center gap-4 text-center p-6"
                    >
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-forest-500/20 border-t-forest-500 rounded-full animate-spin" />
                        <Sparkles
                          size={20}
                          className="absolute inset-0 m-auto text-forest-400 animate-pulse"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-black italic text-white uppercase tracking-wider mb-1">
                          Synthesizing Design...
                        </p>
                        <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">
                          Assembling material catalogs
                        </p>
                      </div>
                    </motion.div>
                  ) : result ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-8"
                    >
                      <div>
                        <p className="micro-label text-forest-400 uppercase tracking-widest font-black mb-4 flex items-center gap-2">
                          <ImageIcon size={14} /> Identified Areas
                        </p>
                        <div className="space-y-3">
                          {(result.identifiedAreas || []).map((area, idx) => (
                            <div
                              key={idx}
                              className="p-4 bg-white/5 border border-white/5 rounded-2xl group"
                            >
                              <p className="text-xs font-black text-white italic mb-1 uppercase tracking-tight">
                                {area.description}
                              </p>
                              <p className="text-[11px] text-white/40 font-medium leading-relaxed uppercase tracking-widest">
                                {area.suggestion}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="micro-label text-forest-400 uppercase tracking-widest font-black mb-4 flex items-center gap-2">
                          <CloudLightning size={14} /> Design Vision
                        </p>
                        <p className="text-xs font-bold italic text-white leading-relaxed tracking-normal p-4 bg-white/5 rounded-xl border border-white/5 uppercase">
                          {result.visionSummary || "No vision summary generated."}
                        </p>

                        {result.botanicalViolations && result.botanicalViolations.length > 0 && !overriddenViolations && (
                          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <div className="flex items-center gap-3 mb-3">
                              <AlertTriangle size={18} className="text-red-500" />
                              <p className="text-xs font-bold text-red-500 uppercase tracking-wider">Botanical Violations</p>
                            </div>
                            <ul className="space-y-3 mb-4">
                              {result.botanicalViolations.map((v, idx) => (
                                <li key={idx} className="text-xs bg-black/40 p-3 rounded-lg border border-red-500/10">
                                  <span className="font-bold text-red-400 block mb-1">{v.issue}</span>
                                  <span className="text-[10px] text-red-400/70 block">{v.reason}</span>
                                </li>
                              ))}
                            </ul>
                            {role === "owner" ? (
                              <button
                                onClick={() => {
                                  setOverriddenViolations(true);
                                  logAction(
                                    "Design Studio", 
                                    "Override Botanical Constraints", 
                                    `Owner bypassed ${result.botanicalViolations?.length} botanical violations`
                                  );
                                }}
                                className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-black text-[10px] uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2"
                              >
                                <Lock size={12} /> Override & Approve
                              </button>
                            ) : (
                              <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 font-medium">
                                <span className="font-bold">Admin Override Required:</span> Owners must override to bypass.
                              </div>
                            )}
                          </div>
                        )}

                        {result.approvalRequired && (
                          <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold text-amber-500">Pending Review</p>
                              <p className="text-[10px] text-amber-500/70">Awaiting financial review from admin.</p>
                            </div>
                            <button className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-[9px] uppercase tracking-widest rounded-lg transition-colors shrink-0">
                              Submit
                            </button>
                          </div>
                        )}
                      </div>

                      {(!result.botanicalViolations || result.botanicalViolations.length === 0 || overriddenViolations) && (
                        <>
                          {regions.filter((r: any) => r.intent === "add").length > 0 && !mockupImage && (
                            <div className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-3">
                              <p className="micro-label text-forest-400 uppercase tracking-widest font-black flex items-center gap-2">
                                <Target size={14} /> Place In Each Spot
                              </p>
                              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold leading-relaxed">
                                Name what goes in each marked spot, then hit Reveal — we place it exactly there and keep the rest of the photo untouched.
                              </p>
                              <div className="flex items-center gap-2 pb-1">
                                <span className="text-[9px] font-black uppercase tracking-widest text-forest-400">USDA Zone</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={13}
                                  value={designZone}
                                  onChange={(e) => setDesignZone(e.target.value ? Number(e.target.value) : "")}
                                  placeholder="—"
                                  className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs font-bold text-white/90 text-center focus:border-forest-500/40 focus:outline-none"
                                />
                                <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">plants matched to this zone</span>
                                <button
                                  type="button"
                                  onClick={() => setDesignSnap((s) => !s)}
                                  title="Snap each spot to the real surface under it before rendering"
                                  className={`ml-auto px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${designSnap ? "bg-forest-500 text-black" : "bg-white/5 text-white/50 border border-white/10"}`}
                                >
                                  Smart Snap {designSnap ? "On" : "Off"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDesignPrecise((s) => !s)}
                                  title="Precise mode: edit only a crop around a single spot (less drift). Single spot only."
                                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${designPrecise ? "bg-forest-500 text-black" : "bg-white/5 text-white/50 border border-white/10"}`}
                                >
                                  Precise {designPrecise ? "On" : "Off"}
                                </button>
                              </div>
                              {regions.map((r: any, i: number) =>
                                r.intent === "add" ? (
                                  <input
                                    key={r.id}
                                    value={regionLabels[r.id] || ""}
                                    onChange={(e) =>
                                      setRegionLabels((p) => ({ ...p, [r.id]: e.target.value }))
                                    }
                                    placeholder={`Spot ${i + 1}: e.g. Japanese Maple, 6ft`}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white/90 placeholder:text-zinc-600 focus:border-forest-500/40 focus:outline-none"
                                  />
                                ) : (
                                  <div
                                    key={r.id}
                                    className="text-[10px] text-red-400/80 uppercase tracking-widest font-black flex items-center gap-2"
                                  >
                                    <X size={12} /> Remove area {i + 1}
                                  </div>
                                ),
                              )}
                              <details className="pt-1">
                                <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-forest-400 flex items-center gap-1.5">
                                  <Leaf size={12} /> Suggest a zone-fit palette
                                </summary>
                                <div className="pt-3">
                                  <SuggestedPalette
                                    zone={designZone || null}
                                    onApply={applyPalette}
                                  />
                                </div>
                              </details>
                            </div>
                          )}

                          {/* Reveal mockup rendering */}
                          <div className="flex flex-col gap-4">
                            {mockupImage ? (
                              <div className="p-4 bg-forest-500/10 border border-forest-500/20 rounded-2xl space-y-3 text-forest-400">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 size={16} />
                                  <span className="text-[10px] font-black uppercase tracking-widest">Render Ready</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => setActiveTab("compare")}
                                    className="flex-1 px-3 py-2 bg-forest-500 text-black hover:bg-forest-400 rounded-xl text-[10px] font-black uppercase transition-all shadow-[0_0_15px_rgba(5,168,69,0.2)]"
                                  >
                                    Open Slider
                                  </button>
                                  <button
                                    onClick={generateMockup}
                                    disabled={isGeneratingMockup}
                                    title="Generate a fresh variation"
                                    className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 disabled:opacity-50"
                                  >
                                    {isGeneratingMockup ? (
                                      <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    ) : (
                                      <RefreshCw size={12} />
                                    )}
                                    Variation
                                  </button>
                                  {canUndo(history) && (
                                    <button
                                      onClick={() => stepHistory("undo")}
                                      title="Undo to the previous render"
                                      className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5"
                                    >
                                      <Undo2 size={12} /> Undo
                                    </button>
                                  )}
                                  {canRedo(history) && (
                                    <button
                                      onClick={() => stepHistory("redo")}
                                      title="Redo"
                                      className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5"
                                    >
                                      <Redo2 size={12} /> Redo
                                    </button>
                                  )}
                                  <button
                                    onClick={downloadMockup}
                                    title="Download the after image"
                                    className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5"
                                  >
                                    <Download size={12} /> Save
                                  </button>
                                  <button
                                    onClick={refineOnRender}
                                    title="Keep designing on top of this render"
                                    className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5"
                                  >
                                    <Sparkles size={12} /> Refine
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={generateMockup}
                                disabled={isGeneratingMockup}
                                className="w-full py-5 bg-gradient-to-r from-forest-500 to-forest-500 text-black border border-transparent rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(5,168,69,0.35)] hover:scale-[1.02] active:scale-95 duration-200"
                              >
                                {isGeneratingMockup ? (
                                    <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Formulating High-Res Render...</>
                                ) : (
                                    <><Sparkles size={16} /> Boom! Reveal Slider Design</>
                                )}
                              </button>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <p className="micro-label text-forest-400 uppercase tracking-widest font-black flex items-center gap-2">
                                <Trees size={14} /> Materials Needed
                              </p>
                              
                              {tenant?.settings?.subFeatures?.semanticStyleLearning && (
                                <span className="flex items-center gap-1 px-2.5 py-0.5 bg-celtic-500/10 text-celtic-400 border border-celtic-500/20 rounded-md text-[8px] font-black uppercase tracking-widest">
                                  <BrainCircuit size={10} /> Style Sync
                                </span>
                              )}
                            </div>
                            
                            {tenant?.settings?.subFeatures?.semanticStyleLearning && (
                              <div className="mb-4 p-3 bg-black/40 border border-white/5 rounded-xl text-[11px] text-white/50 leading-relaxed font-bold">
                                <span className="text-white">YardWorx Custom Rule:</span><br/>
                                <span className="italic opacity-80 mt-1 block border-l-2 border-forest-500/50 pl-2">
                                  "{tenant?.settings?.customInstallRules || 'No custom rules applied.'}"
                                </span>
                              </div>
                            )}

                            {result.tiers && (
                              <div className="flex bg-black p-1 rounded-2xl border-2 border-white/10 mb-6 shrink-0 overflow-x-auto shadow-inner">
                                <button
                                  onClick={() => setActiveTier("good")}
                                  className={`flex-1 py-2.5 px-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
                                    activeTier === "good" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
                                  }`}
                                >
                                  Good (Budget)
                                </button>
                                <button
                                  onClick={() => setActiveTier("better")}
                                  className={`flex-1 py-2.5 px-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
                                    activeTier === "better" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
                                  }`}
                                >
                                  Better (Standard)
                                </button>
                                <button
                                  onClick={() => setActiveTier("best")}
                                  className={`flex-1 py-2.5 px-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
                                    activeTier === "best" ? "bg-white text-black shadow-md scale-[1.02]" : "text-white/40 hover:text-white"
                                  }`}
                                >
                                  Best (Premium)
                                </button>
                              </div>
                            )}

                            <div className="space-y-2.5">
                              {activeMaterials.length === 0 && (
                                <p className="text-[10px] text-white/30 uppercase tracking-widest font-black p-3.5 bg-white/5 rounded-xl">
                                  No materials estimated yet.
                                </p>
                              )}
                              {activeMaterials.map((material: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-3.5 bg-white/5 border-l-2 border-forest-500/40 rounded-xl"
                                >
                                  <div>
                                    <p className="text-xs font-black uppercase text-white tracking-widest">
                                      {material.item}
                                    </p>
                                    <p className="text-[9px] font-medium text-white/40 uppercase tracking-widest">
                                      {material.quantity}
                                    </p>
                                    {material.geoSpatialVolume && tenant?.settings?.subFeatures?.visionAnalysis !== false && (
                                      <p className="border border-forest-500/20 text-forest-400 bg-forest-500/10 px-2 py-0.5 mt-1.5 inline-block rounded-md text-[8px] font-black uppercase tracking-[0.2em]">
                                        AI Geo-Spatial Vol: {material.geoSpatialVolume}
                                      </p>
                                    )}
                                  </div>
                                  {canSeeCosts && (
                                    <span className="text-sm font-black italic text-white font-mono">
                                      {formatCurrency(material.estimatedCost)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>

                            {!result.tiers && canSeeCosts && (
                              <div className="mt-4 flex justify-end">
                                <button 
                                  onClick={generateTiers}
                                  disabled={isGeneratingTiers}
                                  className="text-[9px] border border-amber-500/35 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 font-black uppercase tracking-[0.15em] px-3.5 py-2 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                  {isGeneratingTiers ? (
                                    <>
                                      <div className="w-3 h-3 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                                      Generating Packages...
                                    </>
                                  ) : (
                                    <>
                                      <BrainCircuit size={12} /> Good/Better/Best Tiers
                                    </>
                                  )}
                                </button>
                              </div>
                            )}

                            {result.tiers && activeTier !== "standard" && result.tiers[activeTier]?.description && (
                              <div className="mt-4 p-4 bg-white/5 border border-white/5 rounded-2xl text-[11px] text-white/70 italic leading-relaxed">
                                {result.tiers[activeTier].description}
                              </div>
                            )}
                          </div>

                          {canSeeCosts && estimatedTotal > 0 && (
                            <div className="mt-2 p-5 bg-gradient-to-br from-forest-500/15 to-forest-500/5 border-2 border-forest-500/30 rounded-2xl flex items-center justify-between shadow-[0_0_30px_rgba(5,168,69,0.12)]">
                              <div>
                                <p className="micro-label text-forest-400 uppercase tracking-widest font-black mb-1">
                                  Estimated Total
                                </p>
                                <p className="text-[9px] text-white/40 uppercase tracking-widest font-black">
                                  {result.tiers && activeTier !== "standard"
                                    ? `${activeTier} package`
                                    : `${activeMaterials.length} materials`}
                                </p>
                              </div>
                              <span className="text-3xl font-black italic text-white font-mono leading-none">
                                {formatCurrency(estimatedTotal)}
                              </span>
                            </div>
                          )}

                          <div className="pt-6 border-t border-white/5">
                            <p className="micro-label text-forest-400 uppercase tracking-widest font-black mb-2 flex items-center justify-between">
                              <span>ROI Valuation</span>
                              {canSeeCosts && tierTotal > 0 && (
                                <span className="text-amber-400 font-mono">Total Est: {formatCurrency(tierTotal)}</span>
                              )}
                            </p>
                            <p className="text-xs font-black italic text-white uppercase tracking-normal md:tracking-tighter leading-snug">
                              {result.strategicValue || "Valuation pending material analysis."}
                            </p>
                          </div>

                          <div className="flex flex-col gap-3.5 pt-4">
                            <button
                              onClick={handleSaveToQuote}
                              disabled={isSavingVision}
                              className="w-full bg-white text-black py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl hover:scale-[1.02] active:scale-95 duration-150 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                              {isSavingVision ? (
                                <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Saving Vision...</>
                              ) : (
                                <><Save size={14} /> Save to Quote</>
                              )}
                            </button>
                            <button
                              onClick={handleSendToClient}
                              disabled={isSendingToClient || !activeCustomer?.email}
                              title={activeCustomer?.email ? "Email this design to the client" : "Attach a client with an email first"}
                              className="w-full bg-forest-500/15 text-forest-300 py-4 rounded-xl border border-forest-500/30 font-black uppercase tracking-widest text-xs hover:bg-forest-500/25 active:scale-95 duration-150 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              {isSendingToClient ? (
                                <><div className="w-4 h-4 border-2 border-forest-400/30 border-t-forest-400 rounded-full animate-spin" /> Sending...</>
                              ) : (
                                <><Send size={14} /> Send Design to Client</>
                              )}
                            </button>
                            <button
                              onClick={handleProposalPdf}
                              disabled={isPdfing}
                              title="Download a branded before/after proposal PDF"
                              className="w-full bg-white/5 text-white/80 py-4 rounded-xl border border-white/10 font-black uppercase tracking-widest text-xs hover:bg-white/10 active:scale-95 duration-150 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              {isPdfing ? (
                                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Building PDF...</>
                              ) : (
                                <><Download size={14} /> Download Proposal PDF</>
                              )}
                            </button>
                            <button
                              onClick={handleSaveToDrive}
                              disabled={isSavingDrive}
                              className="w-full bg-celtic-500/10 text-celtic-400 py-4 rounded-xl border border-celtic-500/20 font-black uppercase tracking-widest text-xs hover:bg-celtic-500/20 active:scale-95 duration-150 transition-all flex items-center justify-center gap-2"
                            >
                              {isSavingDrive ? (
                                <div className="w-4 h-4 border-2 border-celtic-400/30 border-t-celtic-400 rounded-full animate-spin" />
                              ) : (
                                <Save size={14} />
                              )}
                              Upload Blueprint to Google Drive
                            </button>
                          </div>
                        </>
                      )}
                    </motion.div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-4 opacity-40">
                      <ImageIcon size={40} className="text-white/20" />
                      <div className="space-y-2">
                        <h4 className="text-lg font-black italic text-white uppercase tracking-wider">
                          Heuristics Awaiting Input
                        </h4>
                        <p className="text-[10px] leading-relaxed uppercase tracking-[0.15em] max-w-xs mx-auto">
                          Choose a site photo, markup drawing zones and specify your design parameters to formulate bidding guides.
                        </p>
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* Floating Action Node */}
      {activeView === "studio" && (
        <button
          onClick={() => { if (image) { setRegions([]); setCleanImage(image); processDesign(image); } }}
          aria-label="Process design transformation"
          className={`fixed bottom-12 right-12 w-20 h-20 bg-forest-500 text-black rounded-3xl shadow-2xl flex items-center justify-center transition-all ${image ? "scale-100 opacity-100 rotate-0" : "scale-0 opacity-0 rotate-180"}`}
        >
          <Plus size={32} />
        </button>
      )}

      {/* Onboarding Modal */}
      <AnimatePresence>
        {showOnboarding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-zinc-900 border-4 border-forest-500/20 rounded-2xl p-8 sm:p-12 shadow-2xl relative"
            >
              <button 
                onClick={closeOnboarding}
                className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors"
                aria-label="Close Onboarding"
              >
                <X size={24} />
              </button>
              
              <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 text-center sm:text-left">
                <div className="w-20 h-20 shrink-0 bg-forest-500/10 rounded-3xl flex items-center justify-center text-forest-400 border border-forest-500/20">
                  <BrainCircuit size={40} />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black italic text-white uppercase tracking-normal md:tracking-tighter mb-1">YardWorx Logic Engine</h2>
                  <p className="text-forest-400 font-bold uppercase tracking-widest text-xs md:text-[11px] bg-forest-500/10 inline-block px-3 py-1 rounded-md">Semantic Style Learning Active</p>
                </div>
              </div>
              
              <div className="space-y-6 text-white/70 leading-relaxed text-sm mb-10 text-center sm:text-left">
                <p>
                  Welcome to the AI Design Studio. Unlike generic AI tools, YardWorx uses <span className="text-white font-bold">Semantic Style Learning</span> to adopt your specific installation methods and bidding logic automatically.
                </p>
                <div className="bg-black/40 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                    <Target size={20} className="text-forest-400 shrink-0 mt-1 sm:mt-0" />
                    <div>
                      <h3 className="text-white font-black uppercase tracking-widest text-xs md:text-[11px] mb-1">Geo-Spatial Calculation</h3>
                      <p className="text-xs text-white/50">Draw on the canvas. AI analyzes the physical area to estimate precise yardage matching your real-world practices.</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                    <Trees size={20} className="text-forest-400 shrink-0 mt-1 sm:mt-0" />
                    <div>
                      <h3 className="text-white font-black uppercase tracking-widest text-xs md:text-[11px] mb-1">Actionable Nuance</h3>
                      <p className="text-xs text-white/50">YardWorx reads your <span className="text-white">Custom Installation Heuristics</span> from settings to select your preferred plant spacing, soils, and material volumes.</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                    <Map size={20} className="text-forest-400 shrink-0 mt-1 sm:mt-0" />
                    <div>
                      <h3 className="text-white font-black uppercase tracking-widest text-xs md:text-[11px] mb-1">Hallucination Busters</h3>
                      <p className="text-xs text-white/50">It prevents impossible requests (e.g. planting a tree in a driveway) using strong physics constraints.</p>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={closeOnboarding}
                className="w-full bg-forest-500 text-black py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-[0_0_40px_rgba(5,168,69,0.3)] hover:scale-[1.02] active:scale-95 transition-all"
              >
                Acknowledge & Start Designing
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
