import { useEffect, useState } from "react";

const STORAGE_KEY = "smp_ui_scale";
const BASE_FONT_SIZE = 16;

type ScaleMode = "auto" | "85" | "90" | "95" | "100" | "110";

function getAutoScale(width: number): number {
  if (width < 1366) return 0.85;
  if (width < 1600) return 0.9;
  if (width < 1920) return 0.95;
  return 1;
}

function resolveScale(mode: ScaleMode): number {
  if (mode === "auto") return getAutoScale(window.innerWidth);
  return Number(mode) / 100;
}

function applyScale(mode: ScaleMode) {
  const scale = resolveScale(mode);
  document.documentElement.style.fontSize = `${BASE_FONT_SIZE * scale}px`;
  document.documentElement.dataset.smpUiScale = mode;
  return Math.round(scale * 100);
}

export default function UiScaleSelector() {
  const [mode, setMode] = useState<ScaleMode>("auto");
  const [effectiveScale, setEffectiveScale] = useState(100);

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) || "auto") as ScaleMode;
    const safeMode: ScaleMode = ["auto", "85", "90", "95", "100", "110"].includes(saved)
      ? saved
      : "auto";

    setMode(safeMode);
    setEffectiveScale(applyScale(safeMode));

    const handleResize = () => {
      if (safeMode === "auto") setEffectiveScale(applyScale("auto"));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleChange = (value: ScaleMode) => {
    setMode(value);
    localStorage.setItem(STORAGE_KEY, value);
    setEffectiveScale(applyScale(value));
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#bfeeff] bg-white px-3 py-2 shadow-sm">
      <div className="text-right leading-tight">
        <div className="text-xs font-semibold text-[#071b36]">Scala interfaccia</div>
        <div className="text-[10px] text-[#5b7282]">Attuale {effectiveScale}%</div>
      </div>
      <select
        aria-label="Scala interfaccia"
        value={mode}
        onChange={(event) => handleChange(event.target.value as ScaleMode)}
        className="h-8 rounded-md border border-[#8cddff] bg-white px-2 text-xs font-medium text-[#0b4f7d] outline-none focus:ring-2 focus:ring-[#8cddff]"
      >
        <option value="auto">Auto</option>
        <option value="85">Compatta 85%</option>
        <option value="90">Compatta 90%</option>
        <option value="95">Compatta 95%</option>
        <option value="100">Standard 100%</option>
        <option value="110">Ampia 110%</option>
      </select>
    </div>
  );
}
