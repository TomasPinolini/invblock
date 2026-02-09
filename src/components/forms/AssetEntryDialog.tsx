"use client";

import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import { X, ChevronDown, Check, Loader2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAppStore } from "@/stores/useAppStore";
import { useCreateAsset } from "@/hooks/useAssets";
import {
  ASSET_CATEGORIES,
  CURRENCIES,
  CATEGORY_LABELS,
  type AssetCategory,
  type Currency,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

// ── Form schema (input types, before transform) ─────────────────────────────

const formSchema = z.object({
  ticker: z.string().min(1, "Ticker is required").max(20),
  name: z.string().min(1, "Name is required").max(120),
  category: z.enum(ASSET_CATEGORIES, { message: "Select a valid category" }),
  currency: z.enum(CURRENCIES),
  quantity: z.number().nonnegative("Quantity must be >= 0"),
  averagePrice: z.number().nonnegative("Price must be >= 0"),
});

type FormValues = z.infer<typeof formSchema>;

// ── Reusable field wrapper ──────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ── Styled input ────────────────────────────────────────────────────────────

const inputClass = `h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900
  px-3 text-sm text-zinc-200 placeholder:text-zinc-600
  focus:outline-none focus:ring-1 focus:ring-blue-500/50
  disabled:opacity-50`;

// ── Component ───────────────────────────────────────────────────────────────

export default function AssetEntryDialog() {
  const open = useAppStore((s) => s.isAssetDialogOpen);
  const close = useAppStore((s) => s.closeAssetDialog);
  const defaultCategory = useAppStore((s) => s.preferences.defaultCategory);
  const mutation = useCreateAsset();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ticker: "",
      name: "",
      category: defaultCategory,
      currency: "USD",
      quantity: 0,
      averagePrice: 0,
    },
  });

  const onSubmit = async (values: FormValues) => {
    await mutation.mutateAsync({
      ...values,
      ticker: values.ticker.toUpperCase().trim(),
      name: values.name.trim(),
    });
    reset();
    close();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && close()}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm
                     data-[state=open]:animate-in data-[state=closed]:animate-out
                     data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
        />
        {/* Content */}
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2
                     -translate-y-1/2 rounded-2xl border border-zinc-800
                     bg-zinc-950 p-6 shadow-2xl shadow-black/40
                     data-[state=open]:animate-in data-[state=closed]:animate-out
                     data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0
                     data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-semibold text-zinc-100">
              Add Asset
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded-md text-zinc-500 hover:text-zinc-200
                                 hover:bg-zinc-800 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Row: Ticker + Name */}
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <Field label="Ticker" error={errors.ticker?.message}>
                <input
                  {...register("ticker")}
                  placeholder="AAPL"
                  className={inputClass}
                />
              </Field>
              <Field label="Name" error={errors.name?.message}>
                <input
                  {...register("name")}
                  placeholder="Apple Inc."
                  className={inputClass}
                />
              </Field>
            </div>

            {/* Row: Category + Currency (Radix Select) */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category" error={errors.category?.message}>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select.Root
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as AssetCategory)}
                    >
                      <Select.Trigger
                        className={cn(
                          inputClass,
                          "inline-flex items-center justify-between"
                        )}
                      >
                        <Select.Value />
                        <Select.Icon>
                          <ChevronDown className="h-4 w-4 text-zinc-500" />
                        </Select.Icon>
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Content
                          className="rounded-lg border border-zinc-700 bg-zinc-900
                                     p-1 shadow-xl z-[100]"
                        >
                          <Select.Viewport>
                            {ASSET_CATEGORIES.map((cat) => (
                              <Select.Item
                                key={cat}
                                value={cat}
                                className="flex items-center gap-2 rounded-md px-3 py-2
                                           text-sm text-zinc-300 cursor-pointer
                                           data-[highlighted]:bg-zinc-800
                                           data-[highlighted]:text-zinc-100 outline-none"
                              >
                                <Select.ItemIndicator>
                                  <Check className="h-3.5 w-3.5 text-blue-400" />
                                </Select.ItemIndicator>
                                <Select.ItemText>
                                  {CATEGORY_LABELS[cat]}
                                </Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Viewport>
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                  )}
                />
              </Field>

              <Field label="Currency" error={errors.currency?.message}>
                <Controller
                  control={control}
                  name="currency"
                  render={({ field }) => (
                    <Select.Root
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as Currency)}
                    >
                      <Select.Trigger
                        className={cn(
                          inputClass,
                          "inline-flex items-center justify-between"
                        )}
                      >
                        <Select.Value />
                        <Select.Icon>
                          <ChevronDown className="h-4 w-4 text-zinc-500" />
                        </Select.Icon>
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Content
                          className="rounded-lg border border-zinc-700 bg-zinc-900
                                     p-1 shadow-xl z-[100]"
                        >
                          <Select.Viewport>
                            {CURRENCIES.map((cur) => (
                              <Select.Item
                                key={cur}
                                value={cur}
                                className="flex items-center gap-2 rounded-md px-3 py-2
                                           text-sm text-zinc-300 cursor-pointer
                                           data-[highlighted]:bg-zinc-800
                                           data-[highlighted]:text-zinc-100 outline-none"
                              >
                                <Select.ItemIndicator>
                                  <Check className="h-3.5 w-3.5 text-blue-400" />
                                </Select.ItemIndicator>
                                <Select.ItemText>{cur}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Viewport>
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                  )}
                />
              </Field>
            </div>

            {/* Row: Quantity + Average Price */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity" error={errors.quantity?.message}>
                <input
                  {...register("quantity", { valueAsNumber: true })}
                  type="number"
                  step="any"
                  placeholder="0"
                  className={inputClass}
                />
              </Field>
              <Field label="Avg Price" error={errors.averagePrice?.message}>
                <input
                  {...register("averagePrice", { valueAsNumber: true })}
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className={inputClass}
                />
              </Field>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={mutation.isPending}
              className="mt-2 w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-500
                         disabled:opacity-50 text-white text-sm font-medium
                         transition-colors inline-flex items-center justify-center gap-2"
            >
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {mutation.isPending ? "Saving..." : "Add to Portfolio"}
            </button>

            {mutation.isError && (
              <p className="text-xs text-red-400 text-center">
                {mutation.error?.message ?? "Something went wrong"}
              </p>
            )}
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
