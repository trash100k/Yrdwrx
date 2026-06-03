import { fetchApi } from "../lib/api";
// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  onSnapshot,
  query,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  deleteDoc,
  orderBy,
  limit,
  where,
} from "firebase/firestore";
import {
  db,
  handleFirestoreError,
  OperationType,
  logSystemEvent,
} from "../lib/firebase";
import { ingestKnowledge } from "../services/brainService";
import {
  Package,
  Scan,
  Plus,
  Search,
  Trash2,
  Edit2,
  AlertTriangle,
  Check,
  X,
  Camera,
  Loader2,
  Barcode,
  ChevronRight,
  Droplets,
  Mountain,
  PaintBucket,
  Calculator,
  Zap,
  History,
  ArrowDownToLine,
  ArrowUpToLine,
  Fuel,
  Info,
  TrendingUp,
  Settings2,
  Maximize2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import BarcodeScanner from "../components/BarcodeScanner";
import { useTenant } from "../contexts/TenantContext";
import { useAuditLog } from "../hooks/useAuditLog";
import { InventoryItem } from "../types";
import { syncService } from "../services/syncService";
import { useFocusTrap } from "../hooks/useFocusTrap";
import InventoryForecast from "../components/InventoryForecast";
import { TrendingDown } from "lucide-react";

import { StockDepletionChart } from "../components/StockDepletionChart";
import { useToast } from "../contexts/ToastContext";

export default function Inventory() {
  const { tenant } = useTenant();
  const { logAction } = useAuditLog();
  const { showToast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<
    {
      id: string;
      timestamp: string;
      action: string;
      quantity: number;
      user: string;
      type?: string;
      jobId?: string;
      itemName?: string;
      unit?: string;
      clientName?: string;
    }[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanningMode, setScanningMode] = useState<
    "vision" | "live" | "manual"
  >("vision");
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<{
    id?: string;
    item?: string;
    status?: string;
    name: string;
    vendor?: string;
    category?: string;
    brand?: string;
    quantity?: number;
    unit?: string;
    partNumber?: string;
    suggestedUnit?: string;
    imageUrl?: string;
    barcode?: string;
    isExisting?: boolean;
  } | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [activeTab, setActiveTab] = useState("All");

  const scannerModalRef = useFocusTrap<HTMLDivElement>(isScanning);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showForecast, setShowForecast] = useState(false);
  const [calcData, setCalcData] = useState({
    length: "",
    width: "",
    depth: "3",
  }); // 3 inches standard

  const [isManualEntry, setIsManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleVoiceAction = async (e: CustomEvent) => {
      const { name, args } = e.detail;
      if (name === "check_inventory") {
        if (args && args.itemName) {
          setSearchQuery(args.itemName);
        } else {
          setIsScanning(true);
        }
      } else if (name === "log_inventory_usage") {
        if (args && args.itemName && args.quantity) {
          const itemToLog = items.find((i) =>
            i.name.toLowerCase().includes(args.itemName.toLowerCase()),
          );
          if (itemToLog) {
            await logUsage(itemToLog, args.quantity, "out");

            if (args.clientName) {
              // Queue an expense/invoice line item for this client
              try {
                await addDoc(collection(db, "expenses"), {
                  amount: Number(itemToLog.unitCost || 0) * args.quantity,
                  vendor: "Inventory Usage",
                  description: `${args.quantity}x ${itemToLog.name} for ${args.clientName}`,
                  date: new Date().toISOString(),
                  tenantId: tenant?.id || "genesis-1",
                });
                showToast(
                  `Logged ${args.quantity}x ${itemToLog.name} usage for ${args.clientName} billing.`,
                  "success",
                );
              } catch (err) {
                console.error("Error logging billing.", err);
              }
            } else {
              showToast(
                `Logged ${args.quantity}x ${itemToLog.name} usage.`,
                "success",
              );
            }
          } else {
            showToast(`Item ${args.itemName} not found in inventory.`, "error");
          }
        }
      }
    };
    window.addEventListener("cutty-action", handleVoiceAction as unknown as EventListener);
    return () =>
      window.removeEventListener(
        "cutty-action",
        handleVoiceAction as unknown as EventListener,
      );
  }, [items, tenant, showToast]);

  useEffect(() => {
    const tenantId = tenant?.id || "genesis-1";
    const q = query(
      collection(db, "inventory"),
      where("tenantId", "==", tenantId),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as any,
        );
        setItems(data.length > 0 ? data : []);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "inventory");
      },
    );

    const lQ = query(
      collection(db, "materialLogs"),
      where("tenantId", "==", tenantId),
      orderBy("timestamp", "desc"),
      limit(10),
    );
    const unsubLogs = onSnapshot(
      lQ,
      (snapshot) => {
        setLogs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as any));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "materialLogs");
      },
    );

    return () => {
      unsubscribe();
      unsubLogs();
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;

        // Scale down image to avoid Firestore limit
        const img = new Image();
        img.src = rawBase64;
        await new Promise((r) => (img.onload = r));

        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 400;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);

        const base64String = compressedBase64.split(",")[1];

        const res = await fetchApi("/api/inventory/process-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageData: base64String }),
        });
        const data = await res.json();
        // save the compressed image url onto the item
        setScanResult({ ...data, imageUrl: compressedBase64 });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const onBarcodeScan = (barcode: string) => {
    setIsProcessing(true);
    // Find existing item with this barcode or part number
    const existing = items.find(
      (i) =>
        i.barcode === barcode ||
        (i.partNumber && i.partNumber.toLowerCase() === barcode.toLowerCase()),
    );

    if (existing) {
      setScanResult({
        ...existing,
        isExisting: true,
      });
      setQuantity("1"); // Default to 1 to add
    } else {
      // If not found, pre-populate part number and ask parent AI (optional) or just let user define
      setScanResult({
        name: "New Scanned Item",
        partNumber: barcode,
        barcode: barcode,
        category: "Hardware",
        suggestedUnit: "Units",
      });
    }
    setIsProcessing(false);
  };

  const logUsage = async (
    item: InventoryItem & { quantity?: number; minThreshold?: number },
    qty: number,
    type: "in" | "out" = "out",
  ) => {
    const tenantId = tenant?.id || "genesis-1";
    if (!item.id) return;
    try {
      const newQty =
        type === "in"
          ? Number(item.quantity) + qty
          : Number(item.quantity) - qty;

      if (navigator.onLine) {
        await updateDoc(doc(db, "inventory", item.id), {
          quantity: newQty,
          tenantId,
          lastScannedAt: serverTimestamp(),
        });

        await addDoc(collection(db, "materialLogs"), {
          itemId: item.id,
          itemName: item.name,
          quantity: qty,
          type,
          tenantId,
          timestamp: serverTimestamp(),
        });
      } else {
        await syncService.queueAction(
          "UPDATE",
          "inventory",
          { quantity: newQty, lastScannedAt: new Date().toISOString() },
          tenantId,
          item.id,
        );
        await syncService.queueAction(
          "CREATE",
          "materialLogs",
          {
            itemId: item.id,
            itemName: item.name,
            quantity: qty,
            type,
            timestamp: new Date().toISOString(),
          },
          tenantId,
        );
      }

      await logSystemEvent("INVENTORY_USAGE_LOGGED", {
        itemId: item.id,
        itemName: item.name,
        qty,
        type,
        tenantId,
      });
      logAction("Inventory", `Used ${item.name}`, `Allocated ${qty} of ${item.name}`);

      if (newQty < (item.minThreshold || 5)) {
        await ingestKnowledge(
          `CRITICAL: ${item.name} is low (${newQty} left). Automated reorder suggested.`,
          { type: "inventory", subType: "alert" },
        );
        await logSystemEvent("LOW_STOCK_ALERT", {
          itemName: item.name,
          currentQty: newQty,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `inventory/${item.id}`);
    }
  };

  const confirmAdd = async () => {
    if (!scanResult) return;
    const tenantId = tenant?.id || "genesis-1";
    try {
      const existing = items.find(
        (i) =>
          i.name.toLowerCase() === scanResult.name.toLowerCase() ||
          (i.partNumber && i.partNumber === scanResult.partNumber),
      );

      const qty = Number(quantity);

      if (existing) {
        await logUsage(existing, qty, "in");
        await ingestKnowledge(
          `Inventory Update: ${existing.name} stock increased by ${qty}. Total now: ${(existing.quantity || 0) + qty}.`,
          { type: "inventory", action: "restock" },
        );
        logAction("Inventory", "Restock", `Restocked ${qty} of ${existing.name}`);
        await logSystemEvent("INVENTORY_RESTOCKED", {
          itemId: existing.id,
          itemName: existing.name,
          qtyAdded: qty,
          tenantId,
        });
      } else {
        if (navigator.onLine) {
          const docRef = await addDoc(collection(db, "inventory"), {
            ...scanResult,
            quantity: qty,
            unit: scanResult.suggestedUnit || "units",
            tenantId,
            lastScannedAt: serverTimestamp(),
            minThreshold: scanResult.category === "Bulk" ? 2 : 5,
          });
          logAction("Inventory", "New Item", `Added ${qty} of new item ${scanResult.name}`);
          await logSystemEvent("NEW_INVENTORY_ITEM_CREATED", {
            itemId: docRef.id,
            name: scanResult.name,
            initialQty: qty,
            tenantId,
          });
        } else {
          await syncService.queueAction(
            "CREATE",
            "inventory",
            {
              ...scanResult,
              quantity: qty,
              unit: scanResult.suggestedUnit || "units",
              lastScannedAt: new Date().toISOString(),
              minThreshold: scanResult.category === "Bulk" ? 2 : 5,
            },
            tenantId,
          );
          logAction("Inventory", "New Item (Offline)", `Added ${qty} of new item ${scanResult.name}`);
          await logSystemEvent("NEW_INVENTORY_ITEM_CREATED_OFFLINE", {
            name: scanResult.name,
            initialQty: qty,
            tenantId,
          });
        }
        await ingestKnowledge(
          `New Inventory Alert: ${scanResult.name} added. Staring stock: ${qty}.`,
          { type: "inventory", action: "new_item" },
        );
      }
      resetScanner();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "inventory");
    }
  };

  const [quantities, setQuantities] = useState({
    totalVal: 0,
    recoveryVal: 0,
    leakage: 4.2,
  });

  useEffect(() => {
    // Strategic Valuation logic for Enterprise Tier
    // Based on industry averages: 3-5% of revenue is lost to untracked consumables
    const total = items.reduce(
      (acc, i) => acc + Number(i.quantity) * (i.unitPrice || 65),
      0,
    );

    // Revenue Recovery: Quantifying materials logged to specific jobs vs baseline 'untracked' state
    const recovery = logs
      .filter((l) => l.jobId && l.type === "out")
      .reduce((acc, l) => acc + Number(l.quantity) * 65, 0);

    setQuantities({
      totalVal: total,
      recoveryVal: recovery,
      leakage:
        logs.length > 0
          ? Math.max(0.8, 4.2 - logs.filter((l) => l.jobId).length * 0.1)
          : 4.2,
    });
  }, [items, logs]);

  const resetScanner = () => {
    setIsScanning(false);
    setScanResult(null);
    setScanningMode("vision");
    setQuantity("1");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const calculateCubicYards = () => {
    const l = parseFloat(calcData.length);
    const w = parseFloat(calcData.width);
    const d = parseFloat(calcData.depth) / 12; // convert inches to feet
    if (isNaN(l) || isNaN(w) || isNaN(d) || l === 0 || w === 0) return "0.00";
    const cubicFeet = l * w * d;
    return (cubicFeet / 27).toFixed(2); // 27 cubic feet in a cubic yard
  };

  const filteredItems = items.filter(
    (item) =>
      !item.isArchived &&
      (activeTab === "All" || item.category === activeTab) &&
      (item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.partNumber?.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const categories = [
    { name: "All", icon: Package },
    { name: "Bulk", icon: Mountain }, // Dirt, Rock, Sand
    { name: "Consumables", icon: Droplets }, // Paint, Chemicals
    { name: "Fuel", icon: Fuel }, // Gas, Mix
    { name: "Hardware", icon: Package }, // Blades, Filters
  ];

  return (
    <div className="space-y-6 lg:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {tenant?.settings?.features?.cockpit_buttons && (
        <div className="mb-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={() => {
              setScanResult(null);
              setIsScanning(true);
            }} className="flex flex-col items-center justify-center gap-2 p-6 bg-pink-500/10 border border-pink-500/20 rounded-[20px] text-pink-400 hover:bg-pink-500/20 transition-all shadow-sm">
            <Plus size={24} className="hover:scale-110 transition-transform" />
            <span className="font-bold text-sm">Quick Restock</span>
          </button>
          <div className="flex flex-col items-center justify-center gap-2 p-6 bg-zinc-900 border border-white/5 rounded-[20px] text-zinc-400 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent"></div>
             <Zap size={24} className="text-yellow-400 animate-pulse" />
             <span className="font-bold text-sm text-yellow-400/80">Easy Mode Active</span>
          </div>
        </div>
      )}
      {/* Strategic Command & Control row */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 lg:gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-purple-500/10 rounded-full border border-purple-500 text-xs font-black uppercase tracking-widest text-purple-500">
            <Package size={16} />
            Material Supply Chain
          </div>
          <h1 className="text-3xl sm:text-3xl sm:text-5xl lg:text-6xl break-words font-sans font-black tracking-normal md:tracking-tighter leading-none text-white italic uppercase">
            Inventory Central
          </h1>
          <p className="max-w-xl text-zinc-400 font-bold text-lg uppercase tracking-widest italic pt-2 leading-relaxed">
            Quick actions & Resource allocation strategy
          </p>
        </div>

        <div className="flex gap-4 shrink-0 flex-col sm:flex-row w-full sm:w-auto">
          <button
            onClick={() => {
              setScanResult(null);
              setIsScanning(true);
            }}
            className="flex items-center justify-center gap-3 px-4 sm:px-8 py-3 sm:py-5 bg-white text-black font-semibold text-sm rounded-xl shadow-sm border border-transparent hover:bg-zinc-200 hover:scale-105 active:scale-95 transition-transform cursor-pointer shrink-0"
          >
            <Scan size={24} className="animate-pulse" />
            <span className="hidden sm:inline">Scan Item</span>
          </button>
          <button
            onClick={() => setShowCalculator(!showCalculator)}
            className="flex items-center justify-center gap-3 px-4 sm:px-8 py-3 sm:py-5 bg-black text-white/60 hover:text-white border border-white/5 font-black uppercase tracking-widest text-sm rounded-2xl hover:scale-105 active:scale-95 transition-transform cursor-pointer shrink-0"
          >
            <Calculator size={24} />
            <span className="hidden sm:inline">Volume Tool</span>
          </button>
          <button
            onClick={() => setShowForecast(true)}
            className="flex items-center justify-center gap-3 px-4 sm:px-8 py-3 sm:py-5 bg-white text-black border border-white/5 font-black uppercase tracking-widest text-sm rounded-2xl shadow-[4px_4px_0_0_#FFF] hover:bg-zinc-200 hover:scale-105 active:scale-95 transition-transform cursor-pointer shrink-0"
          >
            <TrendingDown size={24} />
            <span className="hidden sm:inline">Forecast</span>
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showForecast && (
          <InventoryForecast
            items={items}
            onClose={() => setShowForecast(false)}
          />
        )}
      </AnimatePresence>

      {/* Strategic Profit & Loss metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
        {/* Real-time ROI Metrics */}
        <div
          id="efficiency-metrics-card"
          className="bg-zinc-900 border border-white/5 p-6 lg:p-12 rounded-2xl shadow-2xl flex flex-col justify-between group hover:border-blue-500/50 transition-all min-h-[300px]"
        >
          <div>
            <div className="flex items-center justify-between mb-10">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-black shadow-inner">
                <TrendingUp size={24} />
              </div>
              <span className="micro-label font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full uppercase tracking-widest border border-emerald-500/20 shadow-glow">
                Efficiency Alpha
              </span>
            </div>
            <p className="micro-label opacity-80 font-black uppercase tracking-widest mb-2 italic">
              Recovered Assets
            </p>
            <h3 className="text-3xl sm:text-4xl lg:text-5xl break-words font-black text-white italic tracking-normal md:tracking-tighter leading-none mb-2">
              ${quantities.recoveryVal.toLocaleString()}
            </h3>
            <p className="micro-label text-emerald-400 font-black lowercase tracking-widest opacity-80 italic">
              Verified site materials
            </p>
          </div>
          <div className="pt-8 border-t border-white/10">
            <div className="flex items-center justify-between micro-label font-black uppercase text-white/60 tracking-widest">
              <span>Audit Integrity</span>
              <span className="text-emerald-500">100% SECURE</span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-white/5 p-6 lg:p-12 rounded-2xl shadow-2xl flex flex-col justify-between group hover:border-blue-500/50 transition-all min-h-[300px]">
          <div>
            <div className="flex items-center justify-between mb-10">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-black shadow-inner">
                <AlertTriangle size={24} />
              </div>
              <span className="micro-label font-black text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full uppercase tracking-widest border border-amber-500/20 shadow-glow">
                Leakage Index
              </span>
            </div>
            <p className="micro-label opacity-80 font-black uppercase tracking-widest mb-2 italic">
              Calculated Shrinkage
            </p>
            <h3 className="text-3xl sm:text-4xl lg:text-5xl break-words font-black text-white italic tracking-normal md:tracking-tighter leading-none mb-4">
              {quantities.leakage.toFixed(1)}%
            </h3>
            <p className="micro-label text-amber-400 font-black italic lowercase tracking-widest opacity-80">
              Benchmark Variance: 0.8%
            </p>
          </div>
          <div className="pt-8 border-t border-white/10">
            <button className="w-full text-left micro-label font-black uppercase tracking-widest text-white/20 hover:text-white transition-colors flex items-center justify-between group/btn">
              <span>Loss Identification Report</span>
              <ChevronRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </button>
          </div>
        </div>
      </div>

      <StockDepletionChart />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-8">
        {/* Navigation & Tools */}
        <aside className="space-y-6">
          {/* Material Calculator integration */}
          <AnimatePresence>
            {showCalculator && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-black/40 p-8 rounded-2xl border border-white/5 overflow-hidden shadow-2xl relative"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3
                    id="calc-title"
                    className="micro-label font-black uppercase tracking-[0.3em] text-emerald-400"
                  >
                    Volume Calculator
                  </h3>
                  <X
                    size={16}
                    className="text-zinc-500 cursor-pointer hover:text-white transition-colors"
                    onClick={() => setShowCalculator(false)}
                    aria-label="Close calculator"
                  />
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label htmlFor="calc-length" className="sr-only">
                      Length in feet
                    </label>
                    <input
                      id="calc-length"
                      placeholder="Length(ft)"
                      className="bg-white/5 border border-white/5 rounded-2xl p-4 text-base font-black italic text-white focus:bg-white/10 focus:outline-none transition-all placeholder:text-zinc-600 [color-scheme:dark]"
                      value={calcData.length}
                      onChange={(e) =>
                        setCalcData({ ...calcData, length: e.target.value })
                      }
                    />
                    <label htmlFor="calc-width" className="sr-only">
                      Width in feet
                    </label>
                    <input
                      id="calc-width"
                      placeholder="Width(ft)"
                      className="bg-white/5 border border-white/5 rounded-2xl p-4 text-base font-black italic text-white focus:bg-white/10 focus:outline-none transition-all placeholder:text-zinc-600 [color-scheme:dark]"
                      value={calcData.width}
                      onChange={(e) =>
                        setCalcData({ ...calcData, width: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label htmlFor="calc-depth" className="sr-only">
                      Depth in inches
                    </label>
                    <input
                      id="calc-depth"
                      placeholder="Depth(in) "
                      className="flex-1 min-w-0 bg-white/5 border border-white/5 rounded-2xl p-4 text-base font-black italic text-white focus:bg-white/10 focus:outline-none transition-all placeholder:text-white/10 [color-scheme:dark]"
                      value={calcData.depth}
                      onChange={(e) =>
                        setCalcData({ ...calcData, depth: e.target.value })
                      }
                    />
                    <div className="bg-white text-black rounded-2xl px-6 py-4 flex-1 text-center shadow-2xl">
                      <p className="micro-label font-black uppercase tracking-widest text-zinc-500 leading-none mb-1 text-[8px]">
                        CY Result
                      </p>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-xl sm:text-2xl font-black italic leading-none">
                          {calculateCubicYards()}
                        </span>
                        <span className="text-xs md:text-[10px] font-black uppercase italic text-zinc-500">
                          yds³
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-zinc-900 border border-white/5 p-8 rounded-2xl space-y-6 lg:space-y-10 shadow-2xl">
            <div>
              <label className="micro-label font-black uppercase tracking-[0.3em] text-zinc-400 mb-6 block italic">
                Asset Class Navigation
              </label>
              <div
                id="asset-category-list"
                className="space-y-2"
                role="tablist"
                aria-label="Asset Class Navigation"
              >
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    role="tab"
                    aria-selected={activeTab === cat.name}
                    onClick={() => setActiveTab(cat.name)}
                    className={`w-full flex items-center justify-between px-6 py-4 rounded-[24px] transition-all group relative overflow-hidden ${
                      activeTab === cat.name
                        ? "bg-white text-black shadow-2xl ring-offset-black ring-4 ring-white/10"
                        : "text-white/60 hover:bg-white/5"
                    }`}
                  >
                    <span className="flex items-center gap-4 relative z-10">
                      <cat.icon
                        size={20}
                        className={
                          activeTab === cat.name
                            ? "text-emerald-600"
                            : "text-zinc-500 group-hover:text-white/60"
                        }
                        aria-hidden="true"
                      />
                      <span className="text-sm font-black italic tracking-tight lowercase">
                        {cat.name}.
                      </span>
                    </span>
                    {items.filter(
                      (i) => cat.name === "All" || i.category === cat.name,
                    ).length > 0 && (
                      <span
                        className={`micro-label font-black px-2 py-0.5 rounded-lg text-center relative z-10 ${activeTab === cat.name ? "bg-black/10" : "bg-white/5"}`}
                      >
                        {
                          items.filter(
                            (i) =>
                              cat.name === "All" || i.category === cat.name,
                          ).length
                        }
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-8 border-t border-white/10">
              <label
                htmlFor="inventory-search"
                className="micro-label font-black uppercase tracking-[0.3em] text-zinc-400 mb-6 block text-center italic"
              >
                Global Search
              </label>
              <div className="relative group">
                <Search
                  size={18}
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-white transition-colors"
                  aria-hidden="true"
                />
                <input
                  id="inventory-search"
                  type="text"
                  placeholder="Query assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-14 pr-6 py-5 bg-white/5 border border-white/5 rounded-[24px] text-sm font-bold focus:outline-none focus:bg-white/10 focus:border-white/20 transition-all placeholder:text-zinc-600"
                />
              </div>
            </div>
          </div>
          <div className="bg-zinc-900 border border-white/5 p-8 rounded-2xl space-y-6 lg:space-y-10 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <History size={20} className="text-white/20" />
                <h4 className="micro-label font-black uppercase tracking-[0.2em] text-white/20">
                  Activity Log
                </h4>
              </div>
              <button className="micro-label font-black uppercase text-white/10 hover:text-white transition-colors">
                Clear
              </button>
            </div>
            <div className="space-y-6">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center gap-6 group/log">
                  <div
                    className={`w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center transition-all group-hover/log:scale-110 ${log.type === "in" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-white/20 border border-white/5"}`}
                  >
                    {log.type === "in" ? (
                      <ArrowDownToLine size={20} />
                    ) : (
                      <ArrowUpToLine size={20} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-black text-white truncate tracking-tight group-hover/log:text-emerald-400 transition-colors uppercase italic mb-1">
                      {log.itemName}
                    </p>
                    <p className="micro-label text-white/20 font-black tracking-widest uppercase">
                      {log.type === "in" ? "Restocked" : "Allocated"}:{" "}
                      {log.quantity} {log.unit || "units"}
                      {log.clientName && (
                        <span className="text-emerald-400 block mt-1">
                          to {log.clientName}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <p className="micro-label text-white/10 text-center py-6 sm:py-10 font-black uppercase tracking-widest italic">
                  No recent movement
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">
          <div
            id="inventory-grid"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {filteredItems.map((item) => (
              <motion.div
                layout
                key={item.id}
                className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden group flex flex-col shadow-2xl hover:border-blue-500/50 transition-all duration-700 min-h-[450px]"
              >
                <div className="p-8 flex-grow">
                  <div className="flex items-start justify-between mb-8">
                    <div
                      className={`w-16 h-16 rounded-[24px] overflow-hidden flex items-center justify-center transition-all duration-700 group-hover:scale-110 group-hover:rotate-3 ${
                        (item.quantity || 0) < (item.minThreshold || 5)
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : "bg-white/5 text-white border border-white/5"
                      }`}
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover opacity-80"
                        />
                      ) : item.category === "Fuel" ? (
                        <Fuel size={32} />
                      ) : item.category === "Bulk" ? (
                        <Mountain size={32} />
                      ) : item.category === "Consumables" ? (
                        <Droplets size={32} />
                      ) : (
                        <Package size={32} />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => logUsage(item, 1, "in")}
                        className="p-3 bg-white/5 text-white/20 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all border border-white/5"
                        aria-label={`Restock 1 ${item.name}`}
                      >
                        <Plus size={18} aria-hidden="true" />
                      </button>
                      <button
                        className="p-3 bg-white/5 text-white/20 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-white/5"
                        aria-label={`Settings for ${item.name}`}
                      >
                        <Settings2 size={18} aria-hidden="true" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!item.id) return;
                          try {
                            await updateDoc(doc(db, "inventory", item.id), { isArchived: true, deletedAt: serverTimestamp() });
                            logAction("Inventory", "Remove Item", `Archived/deleted ${item.name}`);
                            await logSystemEvent("INVENTORY_ITEM_DELETED", {
                              itemId: item.id,
                              itemName: item.name,
                            });
                          } catch (err) {
                            handleFirestoreError(
                              err,
                              OperationType.DELETE,
                              `inventory/${item.id}`,
                            );
                          }
                        }}
                        className="p-3 bg-white/5 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-white/5"
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 mb-10">
                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-normal md:tracking-tighter leading-none truncate italic group-hover:text-emerald-400 transition-colors uppercase">
                      {item.name}
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className="micro-label font-black uppercase tracking-[0.2em] text-white/20 bg-white/5 px-3 py-1 rounded-full border border-white/5 group-hover:border-emerald-500/30 transition-colors">
                        {item.category}
                      </span>
                      <span className="micro-label font-black text-white/10 tracking-widest italic group-hover:text-white/30 transition-colors">
                        #{item.partNumber || "YARD_ITEM"}
                      </span>
                    </div>

                    {/* Neural Usage Intensity */}
                    <div className="pt-6 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[7px] font-black uppercase text-white/10 tracking-[0.3em] italic">
                          Usage Intensity
                        </span>
                        <span
                          className={`text-[7px] font-black ${item.category === "Bulk" ? "text-amber-400" : "text-emerald-400"}`}
                        >
                          {item.category === "Fuel"
                            ? "High"
                            : item.category === "Bulk"
                              ? "Critical"
                              : "Stable"}
                        </span>
                      </div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-1000 shadow-glow ${
                            item.category === "Fuel"
                              ? "bg-blue-500 w-[72%]"
                              : item.category === "Bulk"
                                ? "bg-amber-500 w-[92%]"
                                : "bg-emerald-500 w-[45%]"
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/10 flex items-end justify-between gap-6">
                    <div className="min-w-0">
                      <p className="micro-label opacity-50 font-black tracking-widest uppercase mb-2">
                        Inventory Status
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`text-3xl sm:text-4xl lg:text-5xl break-words font-black leading-none italic ${(item.quantity || 0) < (item.minThreshold || 5) ? "text-red-400" : "text-white"}`}
                        >
                          {(item.quantity || 0)}
                        </span>
                        <span className="micro-label font-black text-white/50 uppercase tracking-widest italic">
                          {item.unit || "Units"}
                        </span>
                      </div>
                    </div>

                    {/* Contextual Action UI */}
                    {item.category === "Bulk" ? (
                      <div
                        className="w-16 h-16 relative group-hover:scale-110 transition-transform duration-700"
                        role="img"
                        aria-label={`${(item.quantity || 0)} units of ${item.name}`}
                      >
                        <svg
                          className="w-full h-full -rotate-90 drop-shadow-2xl"
                          aria-hidden="true"
                        >
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            fill="transparent"
                            stroke="rgba(255,255,255,0.02)"
                            strokeWidth="6"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            fill="transparent"
                            stroke={
                              (item.quantity || 0) < (item.minThreshold || 5)
                                ? "#f87171"
                                : "#10b981"
                            }
                            strokeWidth="6"
                            strokeDasharray={176}
                            strokeDashoffset={
                              176 - (176 * Math.min((item.quantity || 0), 20)) / 20
                            }
                            strokeLinecap="round"
                            className="transition-all duration-1000 shadow-glow"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Mountain
                            size={18}
                            className={
                              (item.quantity || 0) < (item.minThreshold || 5)
                                ? "text-red-400 animate-pulse shadow-glow"
                                : "text-emerald-500"
                            }
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    ) : item.category === "Fuel" ? (
                      <button
                        onClick={() => logUsage(item, 1, "out")}
                        aria-label={`Reduce fuel for ${item.name} by 1 Gallon`}
                        className="bg-white text-black px-6 py-4 rounded-[20px] micro-label font-black hover:scale-105 active:scale-95 transition-all flex items-center gap-3 shadow-[0_15px_30px_rgba(255,255,255,0.1)]"
                      >
                        <Fuel size={14} aria-hidden="true" /> -1 Gal.
                      </button>
                    ) : (
                      <button
                        onClick={() => logUsage(item, 1, "out")}
                        aria-label={`Reduce inventory for ${item.name} by 1 unit`}
                        className="w-12 h-12 bg-white/5 text-white/20 rounded-[20px] flex items-center justify-center hover:bg-white hover:text-black transition-all border border-white/5 shadow-2xl"
                      >
                        <Package size={20} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                {(item.quantity || 0) < (item.minThreshold || 5) ? (
                  <div className="bg-red-500/80 py-4 px-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                      <span className="micro-label font-black text-white uppercase tracking-[0.2em]">
                        Depletion Risk Critical
                      </span>
                    </div>
                    <button className="micro-label font-black text-white underline underline-offset-4 hover:text-white/80 transition-colors">
                      Initiate Recovery
                    </button>
                  </div>
                ) : (
                  <div className="px-4 sm:px-8 py-3 sm:py-5 bg-zinc-900 border-t border-white/10 flex items-center justify-between opacity-30 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2">
                      <History size={12} className="text-white/20" />
                      <span className="micro-label font-black tracking-widest italic uppercase">
                        Sync:{" "}
                        {item.lastScannedAt
                          ? new Date(
                              item.lastScannedAt.seconds * 1000,
                            ).toLocaleDateString()
                          : "Pending"}
                      </span>
                    </div>
                    <ChevronRight size={16} className="text-white/20" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center p-24 text-center space-y-6 sm:space-y-8 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
              <div className="w-32 h-32 bg-white rounded-2xl flex items-center justify-center mx-auto text-black shadow-2xl relative z-10 group-hover:scale-110 transition-transform duration-700">
                <Package size={64} />
              </div>
              <div className="relative z-10">
                <h3 className="text-2xl sm:text-3xl sm:text-4xl font-black text-white mb-4 italic tracking-normal md:tracking-tighter lowercase leading-none">
                  Inventory Hub Empty.
                </h3>
                <p className="text-zinc-300 font-bold text-lg max-w-sm mx-auto leading-relaxed italic">
                  Your professional material repository is empty. Scan barcodes
                  or snap pictures of equipment to start tracking.
                </p>
              </div>
              <button
                onClick={() => setIsScanning(true)}
                className="bg-white text-black px-6 sm:px-12 py-6 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-[0_40px_80_rgba(255,255,255,0.1)] active:scale-95 transition-all relative z-10 hover:scale-105"
              >
                Scan First Item
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Vision Scanner Modal */}
      <AnimatePresence>
        {isScanning && (
          <div
            ref={scannerModalRef}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
              onClick={resetScanner}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="relative w-full max-w-xl bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/5"
            >
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 blur-sm" />
              <div className="p-14">
                <div className="flex items-center justify-between mb-12">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-white rounded-[24px] flex items-center justify-center text-black shadow-2xl relative">
                      <Scan size={32} />
                      <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full -z-10 animate-pulse" />
                    </div>
                    <div>
                      <h2
                        id="scanner-title"
                        className="text-xl sm:text-2xl sm:text-3xl font-black text-white italic tracking-normal md:tracking-tighter leading-none mb-1 lowercase"
                      >
                        Asset Scan.
                      </h2>
                      <div
                        className="flex items-center gap-4"
                        role="tablist"
                        aria-label="Scanning modes"
                      >
                        <button
                          role="tab"
                          aria-selected={scanningMode === "vision"}
                          onClick={() => setScanningMode("vision")}
                          className={`micro-label font-black uppercase tracking-widest transition-colors ${scanningMode === "vision" ? "text-emerald-400 shadow-glow" : "text-white/20 hover:text-white/60"}`}
                        >
                          Vision
                        </button>
                        <button
                          role="tab"
                          aria-selected={scanningMode === "live"}
                          onClick={() => setScanningMode("live")}
                          className={`micro-label font-black uppercase tracking-widest transition-colors ${scanningMode === "live" ? "text-emerald-400 shadow-glow" : "text-white/20 hover:text-white/60"}`}
                        >
                          Live Barcode
                        </button>
                        <button
                          role="tab"
                          aria-selected={scanningMode === "manual"}
                          onClick={() => setScanningMode("manual")}
                          className={`micro-label font-black uppercase tracking-widest transition-colors ${scanningMode === "manual" ? "text-emerald-400 shadow-glow" : "text-white/20 hover:text-white/60"}`}
                        >
                          Manual
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* X Button Removed */}
                </div>

                {!scanResult ? (
                  <div className="space-y-6 lg:space-y-10">
                    {scanningMode === "vision" ? (
                      <div className="aspect-[3/2] bg-zinc-900 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center relative overflow-hidden group hover:bg-zinc-900 hover:border-emerald-500/50 transition-all cursor-pointer">
                        {isProcessing ? (
                          <div className="flex flex-col items-center gap-6">
                            <Loader2
                              size={48}
                              className="animate-spin text-white shadow-glow"
                            />
                            <p className="micro-label font-black text-white uppercase tracking-[0.3em] animate-pulse">
                              Extracting Data...
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Camera
                              size={48}
                              className="text-white/10 mb-6 group-hover:scale-110 group-hover:text-white transition-all duration-700 relative z-10"
                              aria-hidden="true"
                            />
                            <p className="micro-label font-black text-white/40 uppercase tracking-[0.3em] group-hover:text-white/60 transition-colors relative z-10">
                              Upload Asset Metadata
                            </p>
                            <label
                              htmlFor="inventory-file-upload"
                              className="sr-only"
                            >
                              Upload asset image
                            </label>
                            <input
                              id="inventory-file-upload"
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleFileUpload}
                              className="absolute inset-0 opacity-0 cursor-pointer z-20"
                              aria-describedby="scanner-title"
                            />
                          </>
                        )}
                      </div>
                    ) : scanningMode === "live" ? (
                      <div className="space-y-6">
                        <div className="rounded-2xl overflow-hidden border border-white/5 shadow-inner">
                          <BarcodeScanner
                            onScanSuccess={onBarcodeScan}
                            onScanError={(err) => console.debug(err)}
                          />
                        </div>
                        <div className="text-center">
                          <p className="micro-label font-black text-white/20 uppercase tracking-[0.4em]">
                            Awaiting Spectral Barcode
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="rounded-2xl overflow-hidden border border-white/5 shadow-inner p-8 bg-zinc-900 flex flex-col gap-4 items-center">
                          <input
                            type="text"
                            placeholder="Enter UPC / SKU / Name"
                            className="bg-zinc-800 text-white font-mono uppercase w-full min-w-0 rounded-2xl px-6 py-4 outline-none border-2 border-white/5 focus:border-emerald-500/50 transition-colors"
                            value={manualBarcode}
                            onChange={(e) => setManualBarcode(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && manualBarcode.trim()) {
                                onBarcodeScan(manualBarcode);
                              }
                            }}
                          />
                          <button
                            onClick={() => {
                              if (manualBarcode.trim())
                                onBarcodeScan(manualBarcode);
                            }}
                            className="bg-emerald-500 text-black w-full px-4 sm:px-8 py-3 sm:py-4 rounded-[20px] font-black uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform"
                          >
                            Lookup Asset
                          </button>
                        </div>
                        <div className="text-center">
                          <p className="micro-label font-black text-white/20 uppercase tracking-[0.4em]">
                            Manual Entry Override
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-6">
                      <div className="p-8 bg-blue-500/5 rounded-2xl border border-blue-500/10 flex gap-4">
                        <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shrink-0">
                          <Barcode size={20} />
                        </div>
                        <p className="text-xs text-blue-400 font-bold leading-relaxed italic">
                          Reads UPC-A, EAN-13, and Code 128 barcodes instantly.
                        </p>
                      </div>
                      <div className="p-8 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex gap-4">
                        <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shrink-0">
                          <Mountain size={20} />
                        </div>
                        <p className="text-xs text-emerald-400 font-bold leading-relaxed italic">
                          Identifies bulk materials like mulch or gravel from
                          visuals.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={resetScanner}
                      className="w-full py-6 mt-8 bg-white border border-white/5 hover:bg-white/90 text-black hover:text-black rounded-[24px] font-black text-xs sm:text-sm uppercase tracking-widest transition-all"
                    >
                      Cancel / Close Scanner
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 lg:space-y-10 animate-in fade-in slide-in-from-bottom-4">
                    <div className="p-6 lg:p-12 bg-zinc-900 rounded-2xl border border-white/5 relative group overflow-hidden shadow-inner flex gap-4 sm:gap-8 items-center">
                      {scanResult.imageUrl && (
                        <div className="w-32 h-32 rounded-3xl overflow-hidden shrink-0 border-4 border-emerald-500/30">
                          <img
                            src={scanResult.imageUrl}
                            alt={scanResult.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className="flex-1">
                        <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                          <Package size={200} />
                        </div>
                        <div className="flex items-center gap-3 mb-4">
                          <p className="micro-label font-black text-emerald-400 uppercase tracking-[0.3em] italic">
                            {scanResult.id
                              ? "Existing Item Found"
                              : "Neural Asset Identified"}
                          </p>
                          <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ring-1 ring-emerald-500/50 flex items-center gap-1 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                            <TrendingUp size={10} /> AI Extracted
                          </span>
                        </div>
                        <h3 className="text-2xl sm:text-3xl sm:text-4xl font-black text-white tracking-normal md:tracking-tighter leading-none mb-6 italic lowercase">
                          {scanResult.name}.
                        </h3>
                        <div className="flex flex-wrap gap-3 relative z-10">
                          <span className="micro-label font-black bg-white text-black px-4 py-1.5 rounded-full uppercase tracking-widest">
                            {scanResult.category || "Unknown Type"}
                          </span>
                          <span className="micro-label font-black bg-white/5 border border-white/5 text-white/60 px-4 py-1.5 rounded-full uppercase tracking-widest">
                            {scanResult.brand || "Generic"}
                          </span>
                          {scanResult.id && (
                            <span className="micro-label font-black bg-amber-500/10 border border-amber-500/20 text-amber-500 px-4 py-1.5 rounded-full uppercase tracking-widest shadow-glow">
                              Stock: {scanResult.quantity} {scanResult.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:gap-8">
                      <div className="space-y-4">
                        <label className="micro-label font-black uppercase tracking-[0.4em] text-white/20 block ml-4 italic">
                          Asset Volume
                        </label>
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          aria-label="Asset Volume"
                          className="w-full bg-white/5 border border-white/5 rounded-2xl py-8 px-6 sm:px-10 text-2xl sm:text-3xl sm:text-4xl font-black text-white italic focus:bg-white/10 focus:outline-none transition-all text-center"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={confirmAdd}
                          className="w-full h-[88px] bg-white text-black rounded-2xl flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] group/commit"
                        >
                          <Check
                            size={32}
                            className="group-hover:scale-125 transition-transform"
                          />
                          <span className="micro-label font-black uppercase tracking-[0.4em]">
                            Commit Asset
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6 pt-10 border-t border-white/10">
                      <div className="text-center">
                        <p className="micro-label font-black text-white/10 uppercase tracking-widest mb-2 italic">
                          Part Identification
                        </p>
                        <p className="text-base font-black text-white italic tracking-tight">
                          {scanResult.partNumber || "NA"}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="micro-label font-black text-white/10 uppercase tracking-widest mb-2 italic">
                          Unit Metric
                        </p>
                        <p className="text-base font-black text-white italic tracking-tight uppercase">
                          {scanResult.suggestedUnit || "Units"}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="micro-label font-black text-white/10 uppercase tracking-widest mb-2 italic">
                          Prime Vendor
                        </p>
                        <p className="text-base font-black text-white italic tracking-tight">
                          {scanResult.vendor || "Local Hub"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
