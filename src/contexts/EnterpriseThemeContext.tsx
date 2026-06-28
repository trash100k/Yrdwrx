import { safeStorage } from '../lib/storage';
// @ts-nocheck

import React, { createContext, useContext, useState, useEffect } from "react";

export type SpacingMode = "standard" | "compact" | "spacious";
export type VisualContrast =
  | "classic-obsidian"
  | "high-contrast"
  | "glowing-ambient"
  | "outdoor-light";
export type DisplayFontFamily = "Outfit" | "Inter" | "Space Grotesk";
export type TouchTargetMode = "touch-friendly" | "sleek-compact";
export type LabelCasing = "uppercase" | "sentence" | "lowercase";

export interface EnterpriseDesignSystem {
  spacingMode: SpacingMode;
  visualContrast: VisualContrast;
  displayFont: DisplayFontFamily;
  touchTargetMode: TouchTargetMode;
  labelCasing: LabelCasing;
  showLayoutGuidelines: boolean;
}

interface EnterpriseThemeContextType {
  themeSettings: EnterpriseDesignSystem;
  updateThemeSetting: <K extends keyof EnterpriseDesignSystem>(
    key: K,
    value: EnterpriseDesignSystem[K],
  ) => void;
  resetToDefaults: () => void;
  getSpacingClasses: () => string;
  getInnerContainerClasses: () => string;
  getFontFamilyClass: () => string;
  getLabelCaseClass: () => string;
  getCardThemeClass: () => string;
}

const defaultSettings: EnterpriseDesignSystem = {
  spacingMode: "standard",
  visualContrast: "classic-obsidian",
  displayFont: "Outfit",
  touchTargetMode: "touch-friendly",
  labelCasing: "uppercase",
  showLayoutGuidelines: false,
};

const EnterpriseThemeContext = createContext<
  EnterpriseThemeContextType | undefined
>(undefined);

export function EnterpriseThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [themeSettings, setThemeSettings] = useState<EnterpriseDesignSystem>(
    () => {
      const saved = safeStorage.getItem("enterprise-theme-settings");
      if (saved) {
        try {
          return { ...defaultSettings, ...JSON.parse(saved) };
        } catch (e) {
          return defaultSettings;
        }
      }
      return defaultSettings;
    },
  );

  useEffect(() => {
    safeStorage.setItem(
      "enterprise-theme-settings",
      JSON.stringify(themeSettings),
    );

    // Dynamically apply body contrast class if needed
    const body = document.body;
    body.classList.remove("enterprise-high-contrast", "enterprise-ambient", "theme-light");
    
    if (themeSettings.visualContrast === "high-contrast") {
      body.classList.add("enterprise-high-contrast");
    } else if (themeSettings.visualContrast === "glowing-ambient") {
      body.classList.add("enterprise-ambient");
    } else if (themeSettings.visualContrast === "outdoor-light") {
      body.classList.add("theme-light");
    }
  }, [themeSettings]);

  const updateThemeSetting = <K extends keyof EnterpriseDesignSystem>(
    key: K,
    value: EnterpriseDesignSystem[K],
  ) => {
    setThemeSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetToDefaults = () => {
    setThemeSettings(defaultSettings);
  };

  const getInnerContainerClasses = () => {
    switch (themeSettings.spacingMode) {
      case 'compact': return 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8';
      case 'spacious': return 'w-full px-4 sm:px-6 lg:px-12';
      case 'standard': default: return 'max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8';
    }
  };

  const getSpacingClasses = () => {
    switch (themeSettings.spacingMode) {
      case "compact":
        return "w-full space-y-6 pb-12 pt-4";
      case "spacious":
        return "w-full space-y-12 pb-32 pt-12 text-lg";
      case "standard":
      default:
        return "w-full space-y-10 pb-20 pt-8";
    }
  };

  const getFontFamilyClass = () => {
    switch (themeSettings.displayFont) {
      case "Inter":
        return "font-sans-inter";
      case "Space Grotesk":
        return "font-sans-space";
      case "Outfit":
      default:
        return "font-sans-outfit";
    }
  };

  const getLabelCaseClass = () => {
    switch (themeSettings.labelCasing) {
      case "sentence":
        return "normal-case tracking-normal";
      case "lowercase":
        return "lowercase tracking-wider";
      case "uppercase":
      default:
        return "uppercase tracking-[0.2em]";
    }
  };

  const getCardThemeClass = () => {
    switch (themeSettings.visualContrast) {
      case "high-contrast":
        return "bg-zinc-950/90 border-2 border-white/20 shadow-none";
      case "glowing-ambient":
        return "bg-forest-950/20 backdrop-blur-3xl border border-forest-500/20 shadow-[0_20px_50px_rgba(5,168,69,0.08)]";
      case "classic-obsidian":
      default:
        return "bg-zinc-950/40 backdrop-blur-xl border border-white/10 shadow-2xl";
    }
  };

  return (
    <EnterpriseThemeContext.Provider
      value={{
        themeSettings,
        updateThemeSetting,
        resetToDefaults,
        getSpacingClasses,
        getInnerContainerClasses,
        getFontFamilyClass,
        getLabelCaseClass,
        getCardThemeClass,
      }}
    >
      <div
        className={`${getFontFamilyClass()} ${
          themeSettings.showLayoutGuidelines ? "show-layout-guidelines" : ""
        }`}
      >
        {children}
      </div>
    </EnterpriseThemeContext.Provider>
  );
}

export function useEnterpriseTheme() {
  const context = useContext(EnterpriseThemeContext);
  if (!context) {
    throw new Error(
      "useEnterpriseTheme must be used within an EnterpriseThemeProvider",
    );
  }
  return context;
}
