import { fetchApi } from "../lib/api";
import { compressImage } from "../lib/imageUtils";
// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import {
  handleFirestoreError,
  OperationType,
  logSystemEvent,
} from "../lib/firebase";
import {
  inventoryRepo,
  materialLogsRepo,
  expensesRepo,
  jobsRepo,
} from "../lib/repos";
import { ingestKnowledge } from "../services/brainService";
import {
  Package,
  Scan,
  Plus,
  Search,
  Trash2,
  Edit2,
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
import { useFocusTrap } from "../hooks/useFocusTrap";
import InventoryForecast from "../components/InventoryForecast";
import { TrendingDown } from "lucide-react";

import { StockDepletionChart } from "../components/StockDepletionChart";
import { useToast } from "../contexts/ToastContext";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";

// Read adapters: merge any custom fields stored in the jsonb `data` column up to
// the top level, and keep a Firestore-compatible `timestamp` on logs (Supabase
// orders/stores by `created_at`).
const adaptItem = (r: any) => ({ ...(r?.data || {}), ...r });
const adaptLog = (r: any) => ({ ...r, timestamp: r?.createdAt });

export default function Inventory() {
  const { tenant } = useTenant();
  const { logAction } = useAuditLog();
  const { showToast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Pending destructive action (inventory item deletion), gated behind a confirm dialog.
  const [pendingDeleteItem, setPendingDeleteItem] = useState<any>(null);
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

  // Per-item edit modal (name / threshold / unit / cost) — wired to the gear button.
  const [editItem, setEditItem] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: "", minThreshold: "", unit: "", unitCost: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  // Jobs (for attributing material usage to a job so Job Costing can pick up the cost).
  const [jobs, setJobs] = useState<any[]>([]);

  // "Log Usage" modal — consume stock and (optionally) attribute it to a job so the
  // material_logs row carries job_id and Job Costing can recover the material cost.
  const [usageItem, setUsageItem] = useState<any>(null);
  const [usageQty, setUsageQty] = useState("1");
  const [usageJobId, setUsageJobId] = useState("");
  const [savingUsage, setSavingUsage] = useState(false);

  const openUsage = (item: any) => {
    setUsageItem(item);
    setUsageQty("1");
    setUsageJobId("");
  };

  const submitUsage = async () => {
    if (!usageItem?.id) return;
    const qty = Number(usageQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      showToast("Enter a quantity greater than zero.", "error");
      return;
    }
    setSavingUsage(true);
    try {
      const job = usageJobId ? jobs.find((j) => j.id === usageJobId) : null;
      await logUsage(usageItem, qty, "out", job);
      showToast(
        job
          ? `Logged ${qty} ${usageItem.unit || "units"} of ${usageItem.name} to ${job.title || "job"}.`
          : `Logged ${qty} ${usageItem.unit || "units"} of ${usageItem.name}.`,
        "success",
      );
      setUsageItem(null);
    } catch (err: any) {
      showToast(err?.message || "Could not log usage.", "error");
    } finally {
      setSavingUsage(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Perform the actual inventory item deletion (soft-delete/archive). Gated by the
  // ConfirmDialog — only called after the user confirms.
  const performDeleteItem = async (item: any) => {
    if (!item?.id) return;
    try {
      await inventoryRepo.archive(item.id);
      logAction("Inventory", "Remove Item", `Archived/deleted ${item.name}`);
      await logSystemEvent("INVENTORY_ITEM_DELETED", {
        itemId: item.id,
        itemName: item.name,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `inventory/${item.id}`);
    }
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditForm({
      name: item.name || "",
      minThreshold: String(item.minThreshold ?? ""),
      unit: item.unit || "",
      unitCost: String(item.unitCost ?? item.unitPrice ?? ""),
    });
  };

  const saveEdit = async () => {
    if (!editItem?.id) return;
    if (!editForm.name.trim()) {
      showToast("Item name is required.", "error");
      return;
    }
    setSavingEdit(true);
    try {
      await inventoryRepo.update(editItem.id, {
        name: editForm.name.trim(),
        minThreshold: Number(editForm.minThreshold) || 0,
        unit: editForm.unit.trim() || "units",
        unitCost: Number(editForm.unitCost) || 0,
      });
      logAction("Inventory", "Edit Item", `Updated details for ${editForm.name}`);
      await logSystemEvent("INVENTORY_ITEM_EDITED", {
        itemId: editItem.id,
        itemName: editForm.name,
      });
      showToast(`Updated ${editForm.name}.`, "success");
      setEditItem(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `inventory/${editItem.id}`);
      showToast(err?.message || "Could not update item.", "error");
    } finally {
      setSavingEdit(false);
    }
  };

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
                await expensesRepo.create({
                  amount: Number(itemToLog.unitCost || 0) * args.quantity,
                  merchant: "Inventory Usage",
                  category: "Materials",
                  date: new Date().toISOString(),
                  data: {
                    description: `${args.quantity}x ${itemToLog.name} for ${args.clientName}`,
                  },
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
    // inventory + material logs are scoped to the tenant by Supabase RLS.
    const unsubscribe = inventoryRepo.subscribe((rows) => {
      setItems((rows || []).map(adaptItem));
      setLoaded(true);
    });

    // materialLogsRepo already returns newest-first (ordered by created_at desc).
    const unsubLogs = materialLogsRepo.subscribe((rows) =>
      setLogs((rows || []).slice(0, 10).map(adaptLog)),
    );

    // Jobs power the usage-attribution picker (so usage logs carry a job_id).
    jobsRepo
      .list()
      .then((rows) => setJobs(rows || []))
      .catch(() => {});

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
      const base64StringWithPrefix = await compressImage(file, 400, 400, 0.6);
      const base64String = base64StringWithPrefix.split(",")[1] || base64StringWithPrefix;

      const res = await fetchApi("/api/inventory/process-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: base64String }),
      });
      const data = await res.json();
      // save the compressed image url onto the item
      setScanResult({ ...data, imageUrl: base64StringWithPrefix });
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
    job?: { id?: string; title?: string; client?: string; customerName?: string } | null,
  ) => {
    const tenantId = tenant?.id || "genesis-1";
    if (!item.id) return;
    try {
      const newQty =
        type === "in"
          ? Number(item.quantity) + qty
          : Number(item.quantity) - qty;

      await inventoryRepo.update(item.id, {
        quantity: newQty,
        lastScannedAt: new Date().toISOString(),
      });

      // Attribute consumption to a job (optional) so Job Costing can recover the
      // material cost. snakeize() maps jobId -> job_id, clientName -> client_name.
      const clientName = job?.client || job?.customerName;
      await materialLogsRepo.create({
        itemId: item.id,
        itemName: item.name,
        quantity: qty,
        type,
        unit: item.unit,
        ...(job?.id ? { jobId: job.id } : {}),
        ...(clientName ? { clientName } : {}),
      });

      logAction("Inventory", type === "in" ? "Stock Added" : "Stock Consumed", `${type === "in" ? "Added" : "Consumed"} ${qty} units of ${item.name}`);

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
        // Strip scanner-only transient keys that aren't inventory columns.
        const {
          id: _scanId,
          item: _scanItem,
          status: _scanStatus,
          isExisting: _scanIsExisting,
          suggestedUnit,
          ...scanFields
        } = scanResult;
        const created = await inventoryRepo.create({
          ...scanFields,
          quantity: qty,
          unit: suggestedUnit || "units",
          lastScannedAt: new Date().toISOString(),
          minThreshold: scanResult.category === "Bulk" ? 2 : 5,
        });
        logAction("Inventory", "New Item", `Added ${qty} of new item ${scanResult.name}`);
        await logSystemEvent("NEW_INVENTORY_ITEM_CREATED", {
          itemId: created?.id,
          name: scanResult.name,
          initialQty: qty,
          tenantId,
        });
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
    valuedItemCount: 0,
    recoveryVal: 0,
  });

  useEffect(() => {
    // Valuation uses each item's real per-unit cost (unitCost / unitPrice).
    // Items with no recorded cost are excluded from the total rather than
    // having a fabricated value assumed for them.
    const unitCostOf = (i: any) => {
      const c = Number(i?.unitCost ?? i?.unitPrice);
      return Number.isFinite(c) && c > 0 ? c : null;
    };
    let total = 0;
    let valuedItemCount = 0;
    for (const i of items) {
      const cost = unitCostOf(i);
      if (cost == null) continue;
      total += Number(i.quantity || 0) * cost;
      valuedItemCount += 1;
    }

    // Revenue Recovery: value of materials logged to specific jobs, using the
    // matching item's real per-unit cost. Logs without a known-cost item are
    // skipped so we never count fabricated dollars.
    const itemById = new Map(items.map((i) => [i.id, i]));
    const recovery = logs
      .filter((l) => l.jobId && l.type === "out")
      .reduce((acc, l) => {
        const cost = unitCostOf(itemById.get((l as any).itemId));
        return cost == null ? acc : acc + Number(l.quantity || 0) * cost;
      }, 0);

    setQuantities({
      totalVal: total,
      valuedItemCount,
      recoveryVal: recovery,
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
            }} className="flex flex-col items-center justify-center gap-2 p-6 bg-ember-500/10 border border-ember-500/20 rounded-[20px] text-ember-400 hover:bg-ember-500/20 transition-all shadow-sm">
            <Plus size={24} className="hover:scale-110 transition-transform" />
            <span className="font-bold text-sm">Quick Restock</span>
          </button>
          <div className="flex flex-col items-center justify-center gap-2 p-6 bg-zinc-900 border border-white/5 molten-edge rounded-[20px] text-zinc-400 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent"></div>
             <Zap size={24} className="text-yellow-400 animate-pulse" />
             <span className="font-bold text-sm text-yellow-400/80">Easy Mode Active</span>
          </div>
        </div>
      )}
      {/* Strategic Command & Control row */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 lg:gap-10 pb-8 border-b-4 border-white/10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-ember-500/10 rounded-full border border-ember-500 text-xs font-black uppercase tracking-widest text-ember-500">
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
          className="bg-zinc-900 border border-white/5 molten-edge p-6 lg:p-12 rounded-2xl shadow-2xl flex flex-col justify-between group hover:border-celtic-500/50 transition-all min-h-[300px]"
        >
          <div>
            <div className="flex items-center justify-between mb-10">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-black shadow-inner">
                <TrendingUp size={24} />
              </div>
              <span className="micro-label font-black text-forest-400 bg-forest-500/10 px-3 py-1.5 rounded-full uppercase tracking-widest border border-forest-500/20 shadow-glow">
                Efficiency Alpha
              </span>
            </div>
            <p className="micro-label opacity-80 font-black uppercase tracking-widest mb-2 italic">
              Recovered Assets
            </p>
            <h3 className="text-3xl sm:text-4xl lg:text-5xl break-words font-black text-white italic tracking-normal md:tracking-tighter leading-none mb-2">
              ${quantities.recoveryVal.toLocaleString()}
            </h3>
            <p className="micro-label text-forest-400 font-black lowercase tracking-widest opacity-80 italic">
              Verified site materials
            </p>
          </div>
          <div className="pt-8 border-t border-white/10">
            <div className="flex items-center justify-between micro-label font-black uppercase text-white/60 tracking-widest">
              <span>Costed Assets</span>
              <span className="text-forest-500">
                {quantities.valuedItemCount} of {items.length}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-white/5 molten-edge p-6 lg:p-12 rounded-2xl shadow-2xl flex flex-col justify-between group hover:border-celtic-500/50 transition-all min-h-[300px]">
          <div>
            <div className="flex items-center justify-between mb-10">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-black shadow-inner">
                <Package size={24} />
              </div>
              <span className="micro-label font-black text-forest-400 bg-forest-500/10 px-3 py-1.5 rounded-full uppercase tracking-widest border border-forest-500/20 shadow-glow">
                On-Hand Value
              </span>
            </div>
            <p className="micro-label opacity-80 font-black uppercase tracking-widest mb-2 italic">
              Inventory Valuation
            </p>
            <h3 className="text-3xl sm:text-4xl lg:text-5xl break-words font-black text-white italic tracking-normal md:tracking-tighter leading-none mb-4">
              {quantities.valuedItemCount > 0
                ? `$${quantities.totalVal.toLocaleString()}`
                : "—"}
            </h3>
            <p className="micro-label text-forest-400 font-black italic lowercase tracking-widest opacity-80">
              {quantities.valuedItemCount > 0
                ? `From ${quantities.valuedItemCount} costed item${quantities.valuedItemCount === 1 ? "" : "s"}`
                : "Add unit costs to value stock"}
            </p>
          </div>
          <div className="pt-8 border-t border-white/10">
            <button
              onClick={() => {
                const tracked = logs.filter((l) => l.jobId && l.type === "out").length;
                const untracked = logs.filter((l) => l.type === "out" && !l.jobId).length;
                showToast(
                  `Material allocation: ${tracked} job-tracked vs ${untracked} untracked • $${quantities.recoveryVal.toLocaleString()} of job-tracked usage costed.`,
                  untracked > tracked ? "warning" : "info",
                );
              }}
              className="w-full text-left micro-label font-black uppercase tracking-widest text-white/20 hover:text-white transition-colors flex items-center justify-between group/btn"
            >
              <span>Allocation Report</span>
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
                    className="micro-label font-black uppercase tracking-[0.3em] text-forest-400"
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

          <div className="bg-zinc-900 border border-white/5 molten-edge p-8 rounded-2xl space-y-6 lg:space-y-10 shadow-2xl">
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
                            ? "text-forest-600"
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
          <div className="bg-zinc-900 border border-white/5 molten-edge p-8 rounded-2xl space-y-6 lg:space-y-10 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <History size={20} className="text-white/20" />
                <h4 className="micro-label font-black uppercase tracking-[0.2em] text-white/20">
                  Activity Log
                </h4>
              </div>
              <button
                onClick={() => {
                  if (!logs.length) return;
                  setLogs([]);
                  showToast("Activity log view cleared.", "info");
                }}
                className="micro-label font-black uppercase text-white/10 hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="space-y-6">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center gap-6 group/log">
                  <div
                    className={`w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center transition-all group-hover/log:scale-110 ${log.type === "in" ? "bg-forest-500/10 text-forest-400 border border-forest-500/20" : "bg-white/5 text-white/20 border border-white/5"}`}
                  >
                    {log.type === "in" ? (
                      <ArrowDownToLine size={20} />
                    ) : (
                      <ArrowUpToLine size={20} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-black text-white truncate tracking-tight group-hover/log:text-forest-400 transition-colors uppercase italic mb-1">
                      {log.itemName}
                    </p>
                    <p className="micro-label text-white/20 font-black tracking-widest uppercase">
                      {log.type === "in" ? "Restocked" : "Allocated"}:{" "}
                      {log.quantity} {log.unit || "units"}
                      {log.clientName && (
                        <span className="text-forest-400 block mt-1">
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
            {!loaded &&
              [...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-zinc-900 border border-white/5 molten-edge rounded-2xl p-8 min-h-[450px] flex flex-col gap-8"
                >
                  <div className="flex items-start justify-between">
                    <Skeleton className="w-16 h-16 rounded-[24px]" />
                    <Skeleton className="h-10 w-28" />
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-7 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <div className="mt-auto pt-8 border-t border-white/10 flex items-end justify-between">
                    <Skeleton className="h-12 w-24" />
                    <Skeleton className="w-16 h-16 rounded-2xl" />
                  </div>
                </div>
              ))}
            {loaded && filteredItems.map((item) => (
              <motion.div
                layout
                key={item.id}
                className="bg-zinc-900 border border-white/5 molten-edge rounded-2xl overflow-hidden group flex flex-col shadow-2xl hover:border-celtic-500/50 transition-all duration-700 min-h-[450px]"
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
                        className="p-3 bg-white/5 text-white/20 hover:text-forest-400 hover:bg-forest-500/10 rounded-xl transition-all border border-white/5"
                        aria-label={`Restock 1 ${item.name}`}
                      >
                        <Plus size={18} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => openEdit(item)}
                        className="p-3 bg-white/5 text-white/20 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-white/5"
                        aria-label={`Edit ${item.name}`}
                      >
                        <Settings2 size={18} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => setPendingDeleteItem(item)}
                        className="p-3 bg-white/5 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-white/5"
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 mb-10">
                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-normal md:tracking-tighter leading-none truncate italic group-hover:text-forest-400 transition-colors uppercase">
                      {item.name}
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className="micro-label font-black uppercase tracking-[0.2em] text-white/20 bg-white/5 px-3 py-1 rounded-full border border-white/5 group-hover:border-forest-500/30 transition-colors">
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
                          className={`text-[7px] font-black ${item.category === "Bulk" ? "text-amber-400" : "text-forest-400"}`}
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
                              ? "bg-celtic-500 w-[72%]"
                              : item.category === "Bulk"
                                ? "bg-amber-500 w-[92%]"
                                : "bg-forest-500 w-[45%]"
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
                                : "text-forest-500"
                            }
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    ) : item.category === "Fuel" ? (
                      <button
                        onClick={() => openUsage(item)}
                        aria-label={`Log fuel usage for ${item.name}`}
                        className="bg-white text-black px-6 py-4 rounded-[20px] micro-label font-black hover:scale-105 active:scale-95 transition-all flex items-center gap-3 shadow-[0_15px_30px_rgba(255,255,255,0.1)]"
                      >
                        <Fuel size={14} aria-hidden="true" /> Log Use
                      </button>
                    ) : (
                      <button
                        onClick={() => openUsage(item)}
                        aria-label={`Log usage for ${item.name}`}
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
                    <button
                      onClick={async () => {
                        const threshold = item.minThreshold || 5;
                        const reorderQty = Math.max(threshold * 2 - (item.quantity || 0), threshold);
                        try {
                          await ingestKnowledge(
                            `REORDER REQUEST: ${item.name} is at ${item.quantity || 0} ${item.unit || "units"} (below ${threshold}). Suggested reorder: ${reorderQty} ${item.unit || "units"}.`,
                            { type: "inventory", subType: "reorder", itemId: item.id },
                          );
                          logAction("Inventory", "Initiate Recovery", `Reorder requested for ${item.name} (${reorderQty})`);
                          await logSystemEvent("INVENTORY_REORDER_REQUESTED", {
                            itemId: item.id,
                            itemName: item.name,
                            reorderQty,
                          });
                          showToast(`Reorder logged: ${reorderQty} ${item.unit || "units"} of ${item.name}.`, "success");
                        } catch (err: any) {
                          showToast(err?.message || "Could not initiate recovery.", "error");
                        }
                      }}
                      className="micro-label font-black text-white underline underline-offset-4 hover:text-white/80 transition-colors"
                    >
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
                              item.lastScannedAt.seconds
                                ? item.lastScannedAt.seconds * 1000
                                : item.lastScannedAt,
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

          {loaded && filteredItems.length === 0 && (
            <EmptyState
              icon={Package}
              title={
                searchQuery || activeTab !== "All"
                  ? "No matching assets"
                  : "Inventory hub empty"
              }
              description={
                searchQuery || activeTab !== "All"
                  ? "No items match your current search or category filter. Adjust the filter or scan a new asset."
                  : "Your professional material repository is empty. Scan barcodes or snap pictures of equipment to start tracking."
              }
              action={{
                label: "Scan First Item",
                onClick: () => {
                  setScanResult(null);
                  setIsScanning(true);
                },
              }}
            />
          )}
        </div>
      </div>

      {/* Item Edit Modal */}
      <AnimatePresence>
        {editItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
              onClick={() => !savingEdit && setEditItem(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-forest-500/10 rounded-xl flex items-center justify-center text-forest-400">
                    <Settings2 size={20} />
                  </div>
                  <h2 className="text-xl font-black text-white italic uppercase tracking-tight">Edit Asset</h2>
                </div>
                <button
                  onClick={() => !savingEdit && setEditItem(null)}
                  className="text-zinc-500 hover:text-white transition-colors"
                  aria-label="Close edit"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Low Stock Threshold</label>
                    <input
                      type="number"
                      value={editForm.minThreshold}
                      onChange={(e) => setEditForm((f) => ({ ...f, minThreshold: e.target.value }))}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Unit</label>
                    <input
                      type="text"
                      value={editForm.unit}
                      onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                      placeholder="units"
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500 placeholder:text-zinc-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Unit Cost ($)</label>
                  <input
                    type="number"
                    value={editForm.unitCost}
                    onChange={(e) => setEditForm((f) => ({ ...f, unitCost: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500 placeholder:text-zinc-600"
                  />
                </div>
                <div className="pt-2 flex gap-3">
                  <button
                    onClick={() => setEditItem(null)}
                    disabled={savingEdit}
                    className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black uppercase tracking-widest text-sm transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={savingEdit}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-forest-600 hover:bg-forest-500 text-white rounded-xl font-black uppercase tracking-widest text-sm transition-colors disabled:opacity-50"
                  >
                    {savingEdit ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    Save
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Log Usage Modal — consume stock and attribute it to a job (optional) */}
      <AnimatePresence>
        {usageItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
              onClick={() => !savingUsage && setUsageItem(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-forest-500/10 rounded-xl flex items-center justify-center text-forest-400">
                    <ArrowUpToLine size={20} />
                  </div>
                  <h2 className="text-xl font-black text-white italic uppercase tracking-tight">Log Usage</h2>
                </div>
                <button
                  onClick={() => !savingUsage && setUsageItem(null)}
                  className="text-zinc-500 hover:text-white transition-colors"
                  aria-label="Close usage"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="micro-label font-black uppercase tracking-widest text-white/40 mb-6 italic">
                {usageItem.name} · {(usageItem.quantity || 0)} {usageItem.unit || "units"} on hand
              </p>

              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
                    Quantity Used
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={usageQty}
                    onChange={(e) => setUsageQty(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
                    Attribute to Job (optional)
                  </label>
                  <select
                    value={usageJobId}
                    onChange={(e) => setUsageJobId(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-forest-500 [color-scheme:dark]"
                  >
                    <option value="">No job — general usage</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {(j.title || "Untitled job")}
                        {(j.client || j.customerName) ? ` — ${j.client || j.customerName}` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-[10px] font-bold text-white/30 italic">
                    Linking a job lets Job Costing attribute this material cost.
                  </p>
                </div>
                <div className="pt-2 flex gap-3">
                  <button
                    onClick={() => setUsageItem(null)}
                    disabled={savingUsage}
                    className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black uppercase tracking-widest text-sm transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitUsage}
                    disabled={savingUsage}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-forest-600 hover:bg-forest-500 text-white rounded-xl font-black uppercase tracking-widest text-sm transition-colors disabled:opacity-50"
                  >
                    {savingUsage ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    Log Usage
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-forest-500 via-celtic-500 to-ember-500 blur-sm" />
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
                          className={`micro-label font-black uppercase tracking-widest transition-colors ${scanningMode === "vision" ? "text-forest-400 shadow-glow" : "text-white/20 hover:text-white/60"}`}
                        >
                          Vision
                        </button>
                        <button
                          role="tab"
                          aria-selected={scanningMode === "live"}
                          onClick={() => setScanningMode("live")}
                          className={`micro-label font-black uppercase tracking-widest transition-colors ${scanningMode === "live" ? "text-forest-400 shadow-glow" : "text-white/20 hover:text-white/60"}`}
                        >
                          Live Barcode
                        </button>
                        <button
                          role="tab"
                          aria-selected={scanningMode === "manual"}
                          onClick={() => setScanningMode("manual")}
                          className={`micro-label font-black uppercase tracking-widest transition-colors ${scanningMode === "manual" ? "text-forest-400 shadow-glow" : "text-white/20 hover:text-white/60"}`}
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
                      <div className="aspect-[3/2] bg-zinc-900 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center relative overflow-hidden group hover:bg-zinc-900 hover:border-forest-500/50 transition-all cursor-pointer">
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
                            <div className="absolute inset-0 bg-gradient-to-br from-forest-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
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
                            className="bg-zinc-800 text-white font-mono uppercase w-full min-w-0 rounded-2xl px-6 py-4 outline-none border-2 border-white/5 focus:border-forest-500/50 transition-colors"
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
                            className="bg-forest-500 text-black w-full px-4 sm:px-8 py-3 sm:py-4 rounded-[20px] font-black uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform"
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
                      <div className="p-8 bg-celtic-500/5 rounded-2xl border border-celtic-500/10 flex gap-4">
                        <div className="w-10 h-10 bg-celtic-600 text-white rounded-xl flex items-center justify-center shrink-0">
                          <Barcode size={20} />
                        </div>
                        <p className="text-xs text-celtic-400 font-bold leading-relaxed italic">
                          Reads UPC-A, EAN-13, and Code 128 barcodes instantly.
                        </p>
                      </div>
                      <div className="p-8 bg-forest-500/5 rounded-2xl border border-forest-500/10 flex gap-4">
                        <div className="w-10 h-10 bg-forest-600 text-white rounded-xl flex items-center justify-center shrink-0">
                          <Mountain size={20} />
                        </div>
                        <p className="text-xs text-forest-400 font-bold leading-relaxed italic">
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
                        <div className="w-32 h-32 rounded-3xl overflow-hidden shrink-0 border-4 border-forest-500/30">
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
                          <p className="micro-label font-black text-forest-400 uppercase tracking-[0.3em] italic">
                            {scanResult.id
                              ? "Existing Item Found"
                              : "Neural Asset Identified"}
                          </p>
                          <span className="bg-forest-500/20 text-forest-400 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ring-1 ring-forest-500/50 flex items-center gap-1 shadow-[0_0_15px_rgba(5,168,69,0.3)]">
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

      <ConfirmDialog
        isOpen={!!pendingDeleteItem}
        onClose={() => setPendingDeleteItem(null)}
        onConfirm={() => performDeleteItem(pendingDeleteItem)}
        title="Delete inventory item?"
        description={`This removes "${pendingDeleteItem?.name || "this item"}" from your inventory. This can't be undone.`}
        confirmText="Delete"
        danger
      />
    </div>
  );
}
