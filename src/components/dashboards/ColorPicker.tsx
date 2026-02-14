"use client";

import { GROUP_COLORS, GROUP_COLOR_MAP } from "@/lib/constants";
import type { GroupColor } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: GroupColor;
  onChange: (color: GroupColor) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="grid grid-cols-9 gap-1.5">
      {GROUP_COLORS.map((color) => {
        const colors = GROUP_COLOR_MAP[color];
        const isSelected = color === value;
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              "h-7 w-7 rounded-md border-2 transition-all duration-150",
              colors.dot,
              isSelected
                ? "border-white scale-110 shadow-lg"
                : "border-transparent opacity-70 hover:opacity-100 hover:scale-105"
            )}
            title={color}
            aria-label={color}
            aria-pressed={isSelected}
          />
        );
      })}
    </div>
  );
}
