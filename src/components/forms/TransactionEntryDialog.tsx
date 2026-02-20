"use client";

import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import { X, ChevronDown, Check, Loader2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAppStore } from "@/stores/useAppStore";
import { useAssets } from "@/hooks/useAssets";
import { useCreateTransaction } from "@/hooks/useTransactions";
import {
  CURRENCIES,
  TRANSACTION_TYPES,
  type Currency,
  type TransactionType,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

// ── Form schema (input types) ───────────────────────────────────────────────

const formSchema = z.object({
  assetId: z.string().uuid("Select a valid asset"),
  type: z.enum(TRANSACTION_TYPES, { message: "Select buy or sell" }),
  quantity: z.number().positive("Quantity must be > 0"),
  pricePerUnit: z.number().positive("Price must be > 0"),
  currency: z.enum(CURRENCIES),
  executedAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
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
  px-3 text-sm text-zinc-200 placeholder:text-zinc-500
  focus:outline-none focus:ring-1 focus:ring-blue-500/50
  disabled:opacity-50`;

// ── Component ───────────────────────────────────────────────────────────────

export default function TransactionEntryDialog() {
  const open = useAppStore((s) => s.isTransactionDialogOpen);
  const close = useAppStore((s) => s.closeTransactionDialog);
  const selectedAssetId = useAppStore((s) => s.selectedAssetId);
  const { data: assets } = useAssets();
  const mutation = useCreateTransaction();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      assetId: selectedAssetId ?? "",
      type: "buy",
      quantity: 0,
      pricePerUnit: 0,
      currency: "USD",
      notes: "",
    },
  });

  // Update assetId when selectedAssetId changes
  React.useEffect(() => {
    if (selectedAssetId) {
      reset((values) => ({ ...values, assetId: selectedAssetId }));
    }
  }, [selectedAssetId, reset]);

  const onSubmit = async (values: FormValues) => {
    await mutation.mutateAsync(values);
    reset();
    close();
  };

  const quantity = watch("quantity");
  const pricePerUnit = watch("pricePerUnit");
  const watchedCurrency = watch("currency");
  const totalAmount = (quantity || 0) * (pricePerUnit || 0);

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
              Record Transaction
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                aria-label="Close dialog"
                className="p-1 rounded-md text-zinc-500 hover:text-zinc-200
                                 hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Record a buy or sell transaction for an asset in your portfolio.
          </Dialog.Description>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Asset Select */}
            <Field label="Asset" error={errors.assetId?.message}>
              <Controller
                control={control}
                name="assetId"
                render={({ field }) => (
                  <Select.Root value={field.value} onValueChange={field.onChange}>
                    <Select.Trigger
                      className={cn(
                        inputClass,
                        "inline-flex items-center justify-between"
                      )}
                    >
                      <Select.Value placeholder="Select asset..." />
                      <Select.Icon>
                        <ChevronDown className="h-4 w-4 text-zinc-500" />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content
                        className="rounded-lg border border-zinc-700 bg-zinc-900
                                   p-1 shadow-xl z-[100] max-h-60 overflow-auto"
                      >
                        <Select.Viewport>
                          {(assets ?? []).map((asset) => (
                            <Select.Item
                              key={asset.id}
                              value={asset.id}
                              className="flex items-center gap-2 rounded-md px-3 py-2
                                         text-sm text-zinc-300 cursor-pointer
                                         data-[highlighted]:bg-zinc-800
                                         data-[highlighted]:text-zinc-100 outline-none"
                            >
                              <Select.ItemIndicator>
                                <Check className="h-3.5 w-3.5 text-blue-400" />
                              </Select.ItemIndicator>
                              <Select.ItemText>
                                <span className="font-mono font-semibold">
                                  {asset.ticker}
                                </span>
                                <span className="text-zinc-500 ml-2">
                                  {asset.name}
                                </span>
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

            {/* Row: Type + Currency */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type" error={errors.type?.message}>
                <Controller
                  control={control}
                  name="type"
                  render={({ field }) => (
                    <Select.Root
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as TransactionType)}
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
                            {TRANSACTION_TYPES.map((type) => (
                              <Select.Item
                                key={type}
                                value={type}
                                className="flex items-center gap-2 rounded-md px-3 py-2
                                           text-sm text-zinc-300 cursor-pointer
                                           data-[highlighted]:bg-zinc-800
                                           data-[highlighted]:text-zinc-100 outline-none"
                              >
                                <Select.ItemIndicator>
                                  <Check className="h-3.5 w-3.5 text-blue-400" />
                                </Select.ItemIndicator>
                                <Select.ItemText className="capitalize">
                                  {type}
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

            {/* Row: Quantity + Price */}
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
              <Field label="Price per Unit" error={errors.pricePerUnit?.message}>
                <input
                  {...register("pricePerUnit", { valueAsNumber: true })}
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className={inputClass}
                />
              </Field>
            </div>

            {/* Total (computed, read-only) */}
            <div className="rounded-lg bg-zinc-900/50 border border-zinc-800 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-zinc-500">
                  Total Amount
                </span>
                <span className="font-mono font-semibold text-zinc-100">
                  {totalAmount.toLocaleString(undefined, {
                    style: "currency",
                    currency: watchedCurrency || "USD",
                  })}
                </span>
              </div>
            </div>

            {/* Notes */}
            <Field label="Notes (optional)" error={errors.notes?.message}>
              <textarea
                {...register("notes")}
                placeholder="Add any notes about this transaction..."
                rows={2}
                className={cn(inputClass, "h-auto py-2 resize-none")}
              />
            </Field>

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
              {mutation.isPending ? "Recording..." : "Record Transaction"}
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
