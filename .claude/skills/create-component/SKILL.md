---
name: create-component
description: Create a new React component following project conventions — dark theme, TypeScript props, responsive design, accessibility, and lucide icons. Use when adding a new UI component.
user-invocable: true
argument-hint: [component-name] [description]
allowed-tools: Write, Read, Grep, Glob
---

# Create Component

Create a new component: `$ARGUMENTS`

## Before You Start

1. Check `src/components/` for similar components to follow patterns
2. Determine the right subdirectory:
   - `portfolio/` — Dashboard-related (tables, cards, charts)
   - `forms/` — Dialogs and form inputs
   - `layout/` — Header, navigation, structural
   - `history/` — Operations/trade history
   - `mep/` — MEP dollar related
   - `ui/` — Reusable primitives (Toast, Skeleton, ErrorBoundary)
3. Read the component that's closest to what you're building

## Component Template

```tsx
"use client";

import { cn } from "@/lib/utils";

interface MyComponentProps {
  /** Description of prop */
  value: string;
  /** Optional className override */
  className?: string;
}

export default function MyComponent({ value, className }: MyComponentProps) {
  return (
    <div className={cn("rounded-xl border border-zinc-800 bg-zinc-900/50 p-3", className)}>
      {/* Component content */}
    </div>
  );
}
```

## Design System Reference

### Colors (Dark Theme)
```
Background:     bg-zinc-950 (page), bg-zinc-900/50 (cards)
Text primary:   text-zinc-100, text-zinc-50 (headings)
Text secondary: text-zinc-400, text-zinc-500
Text muted:     text-zinc-600
Borders:        border-zinc-800, border-zinc-800/60
Positive:       text-emerald-400, bg-emerald-500/10
Negative:       text-red-400, bg-red-500/10
Accent:         text-blue-400, bg-blue-600
Warning:        text-amber-500
```

### Card Pattern
```tsx
<div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
  {/* Header */}
  <div className="flex items-center gap-2 text-zinc-500 mb-1.5">
    <MyIcon className="h-3.5 w-3.5" />
    <span className="text-[10px] uppercase tracking-wider">Label</span>
  </div>
  {/* Value */}
  <p className="text-lg font-bold font-mono text-zinc-50">
    {formatCurrency(value, "USD")}
  </p>
</div>
```

### Typography
```
Headings:       text-lg font-bold text-zinc-100
Labels:         text-[10px] uppercase tracking-wider text-zinc-500
Numbers/Prices: font-mono font-semibold
Body:           text-sm text-zinc-300
Badges:         text-xs font-medium px-2 py-0.5 rounded-full
```

### Interactive Elements
```tsx
// Button (primary)
<button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg
  bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
  <MyIcon className="h-4 w-4" />
  Label
</button>

// Button (ghost)
<button className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200
  hover:bg-zinc-800 transition-colors">
  <MyIcon className="h-4 w-4" />
</button>

// Input
<input className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900
  px-3 text-sm text-zinc-200 placeholder:text-zinc-600
  focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
```

### Loading States
```tsx
// Spinner
import { Loader2 } from "lucide-react";
<Loader2 className="h-4 w-4 animate-spin text-zinc-500" />

// Skeleton
<div className="h-4 w-20 animate-pulse rounded bg-zinc-800" />
```

### Responsive Patterns
```tsx
// Hide on mobile
<div className="hidden sm:block">Desktop only</div>

// Grid responsive
<div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">

// Table column hide on mobile
<th className="hidden sm:table-cell">Column</th>
```

### Icons
Import from `lucide-react`. Common sizes:
- Small: `h-3 w-3` or `h-3.5 w-3.5`
- Medium: `h-4 w-4`
- Large: `h-5 w-5`

### Conditional Loading / Error / Empty States

Follow this pattern from existing components:

```tsx
// Don't show if not connected
if (!status?.connected) return null;

// Loading
if (isLoading) {
  return (
    <div className="flex items-center justify-center p-6">
      <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
    </div>
  );
}

// Error — silent hide or show message
if (error || !data) return null;

// Empty state
if (data.length === 0) {
  return (
    <div className="text-center text-zinc-600 py-12">
      No items found.
    </div>
  );
}

// Render data
return <div>...</div>;
```

## Accessibility Checklist

- [ ] All icon-only buttons have `aria-label`
- [ ] Interactive elements are focusable (use `<button>`, not `<div onClick>`)
- [ ] Color is not the only indicator (add icons/text alongside color)
- [ ] Form inputs have associated labels
- [ ] Modals trap focus and close on Escape

## Checklist

- [ ] File starts with `"use client";` (if it uses hooks, state, or event handlers)
- [ ] TypeScript props interface defined and exported
- [ ] Uses `cn()` from `@/lib/utils` for conditional classes
- [ ] Follows dark theme color palette
- [ ] Responsive: works on mobile (375px) and desktop
- [ ] Loading, error, and empty states handled
- [ ] Icon-only buttons have `aria-label`
- [ ] Uses `font-mono` for numbers/prices
- [ ] Placed in correct subdirectory under `src/components/`
- [ ] Default export (matches project convention)
