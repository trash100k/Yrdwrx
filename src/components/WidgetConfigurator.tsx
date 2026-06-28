// @ts-nocheck
import React, { useState, useEffect } from "react";
import { motion, Reorder, AnimatePresence } from "motion/react";
import { GripVertical, Eye, EyeOff, Save, ShieldAlert, FileText, Magnet, CloudDrizzle, Briefcase, Boxes, Bell, LineChart, Palette, Zap } from "lucide-react";

export type WidgetDef = {
  id: string;
  name: string;
  desc: string;
  icon: any;
};

export const WIDGET_LIBRARY: WidgetDef[] = [
  { id: "briefing", name: "AI Morning Brief", desc: "Strategic bullet outlines", icon: Briefcase },
  { id: "weather", name: "Weather shield", desc: "Met delay tracker", icon: CloudDrizzle },
  { id: "crews", name: "Crews monitor", desc: "Site dispatches details", icon: ShieldAlert },
  { id: "inventory", name: "Inventory checklist", desc: "Material reconciliation", icon: Boxes },
  { id: "alerts", name: "Priority metrics", desc: "Safety Compliance logs", icon: Bell },
  { id: "earnings", name: "Area earnings chart", desc: "Capital graphs", icon: LineChart },
  { id: "workspace", name: "Google Space", desc: "Sync Calendar & dispatch", icon: Magnet },
  { id: "tasks", name: "Task Reminders", desc: "Action items & schedules", icon: FileText },
  { id: "macros", name: "Quick Action Macros", desc: "One-click actions", icon: FileText },
  { id: "cockpit_buttons", name: "Easy Mode", desc: "Primary sub-feature launchers", icon: Zap },
  { id: "design", name: "Design Studio", desc: "Spatial imagery", icon: Palette }
];

export default function WidgetConfigurator({ 
  activeWidgets, 
  widgetOrder, 
  onChange 
}: { 
  activeWidgets: Record<string, boolean>; 
  widgetOrder: string[]; 
  onChange: (order: string[], active: Record<string, boolean>) => void;
}) {
  const [items, setItems] = useState<WidgetDef[]>([]);
  const [localActive, setLocalActive] = useState<Record<string, boolean>>(activeWidgets);

  useEffect(() => {
    // Sync external props initially
    const dynamicItems = Object.keys(activeWidgets)
       .filter(id => !WIDGET_LIBRARY.find(w => w.id === id))
       .map(id => ({
          id,
          name: id.replace(/_/g, ' ').toUpperCase(),
          desc: 'Dynamically Generated Feature',
          icon: FileText
       }));

    const fullLibrary = [...WIDGET_LIBRARY, ...dynamicItems];

    const sorted = fullLibrary.filter(w => w.id !== "cockpit_buttons").sort((a, b) => {
      const idxA = widgetOrder.indexOf(a.id);
      const idxB = widgetOrder.indexOf(b.id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
    setItems(sorted);
    setLocalActive(activeWidgets);
  }, [widgetOrder, activeWidgets]);

  const toggleWidget = (id: string) => {
    const next = { ...localActive, [id]: !localActive[id] };
    setLocalActive(next);
    onChange(["cockpit_buttons", ...items.map(i => i.id)], next);
  };

  const handleReorder = (newItems: WidgetDef[]) => {
    setItems(newItems);
    onChange(["cockpit_buttons", ...newItems.map(i => i.id)], localActive);
  };

  const easyModeWidget = WIDGET_LIBRARY.find(w => w.id === "cockpit_buttons");

  return (
    <div className="bg-zinc-950 border border-white/5 molten-edge rounded-[28px] p-6 shadow-2xl">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h3 className="text-xl font-black text-white italic uppercase tracking-tight">
            Dashboard Grid Configuration
          </h3>
          <p className="text-xs text-zinc-500 font-bold mt-1">
            Drag to reorder widgets. Toggle visibility.
          </p>
        </div>
      </div>

      {easyModeWidget && (
        <div className="mb-4 bg-forest-500/10 border-2 border-forest-500/30 rounded-xl p-4 flex items-center justify-between transition-colors shadow-[0_0_15px_rgba(5,168,69,0.1)]">
           <div className="flex items-center gap-4">
             <div className="p-2 rounded-lg bg-forest-500 text-white shadow-lg">
                <easyModeWidget.icon size={18} />
             </div>
             <div>
                <h4 className="text-sm font-black tracking-tight uppercase text-forest-400">
                  {easyModeWidget.name}
                </h4>
                <p className="text-xs md:text-[10px] uppercase tracking-widest text-forest-500/70 font-bold">
                  {easyModeWidget.desc} (Fixed at Top)
                </p>
             </div>
           </div>
           <button 
             type="button"
             onClick={(e) => {
               e.stopPropagation();
               toggleWidget(easyModeWidget.id);
             }}
             className={`p-3 rounded-xl transition-all border-2 ${
               localActive[easyModeWidget.id] 
                 ? "bg-forest-500 text-white hover:bg-forest-400 border-forest-500" 
                 : "bg-transparent text-forest-500 border-forest-500/30 hover:text-white"
             }`}
           >
             {localActive[easyModeWidget.id] ? <Eye size={18} /> : <EyeOff size={18} />}
           </button>
        </div>
      )}

      <Reorder.Group 
        axis="y" 
        values={items} 
        onReorder={handleReorder} 
        className="space-y-3"
      >
        <AnimatePresence>
          {items.map((item) => (
            <Reorder.Item 
              key={item.id} 
              value={item}
              className="bg-black/40 border-2 border-white/5 rounded-xl p-4 flex items-center justify-between cursor-grab active:cursor-grabbing hover:border-white/20 transition-colors"
            >
              <div className="flex items-center gap-4">
                <GripVertical size={20} className="text-zinc-600" />
                <div className={`p-2 rounded-lg ${localActive[item.id] ? "bg-white/10 text-white" : "bg-white/5 text-zinc-600"}`}>
                  <item.icon size={18} />
                </div>
                <div>
                  <h4 className={`text-sm font-bold tracking-tight uppercase ${localActive[item.id] ? "text-white" : "text-zinc-500"}`}>
                    {item.name}
                  </h4>
                  <p className="text-xs md:text-[10px] uppercase tracking-widest text-zinc-600 font-bold">
                    {item.desc}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWidget(item.id);
                }}
                className={`p-3 rounded-xl transition-all border-2 ${
                  localActive[item.id] 
                    ? "bg-white text-black hover:bg-zinc-200 border-white" 
                    : "bg-transparent text-zinc-600 border-zinc-800 hover:text-white"
                }`}
              >
                {localActive[item.id] ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>
    </div>
  );
}
