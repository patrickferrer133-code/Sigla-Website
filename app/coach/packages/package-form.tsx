"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPackageAction, updatePackageAction, type PackageFormState } from "./actions";

const initialPackageFormState: PackageFormState = { status: "idle" };

type PackageDefaults = {
  title: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingPeriod: string;
  inclusions: string[] | null;
  slotLimit: number | null;
  trialDays: number | null;
};

export function PackageForm({ packageId, defaults }: { packageId?: string; defaults?: PackageDefaults }) {
  const action = packageId ? updatePackageAction.bind(null, packageId) : createPackageAction;
  const [state, formAction, isPending] = useActionState<PackageFormState, FormData>(action, initialPackageFormState);
  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor={fieldId("title")} className="text-xs text-muted-foreground">Title</Label>
        <Input id={fieldId("title")} name="title" defaultValue={defaults?.title} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={fieldId("description")} className="text-xs text-muted-foreground">Description</Label>
        <Textarea id={fieldId("description")} name="description" rows={2} defaultValue={defaults?.description ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor={fieldId("price")} className="text-xs text-muted-foreground">Price (₱)</Label>
          <Input
            id={fieldId("price")}
            name="price"
            type="number"
            min={0}
            step={0.01}
            placeholder="1500.00"
            defaultValue={defaults ? (defaults.priceCents / 100).toFixed(2) : undefined}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={fieldId("billingPeriod")} className="text-xs text-muted-foreground">Billing period</Label>
          <select
            id={fieldId("billingPeriod")}
            name="billingPeriod"
            defaultValue={defaults?.billingPeriod ?? "monthly"}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="one_time">One-time</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="per_12_weeks">Per 12 weeks</option>
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={fieldId("inclusions")} className="text-xs text-muted-foreground">Inclusions (one per line)</Label>
        <Textarea id={fieldId("inclusions")} name="inclusions" rows={3} defaultValue={defaults?.inclusions?.join("\n") ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor={fieldId("slotLimit")} className="text-xs text-muted-foreground">Slot limit (optional)</Label>
          <Input id={fieldId("slotLimit")} name="slotLimit" type="number" min={1} defaultValue={defaults?.slotLimit ?? undefined} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={fieldId("trialDays")} className="text-xs text-muted-foreground">Free trial (days, optional)</Label>
          <Input id={fieldId("trialDays")} name="trialDays" type="number" min={1} max={90} placeholder="7" defaultValue={defaults?.trialDays ?? undefined} />
        </div>
      </div>

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      {state.status === "saved" && <p className="text-sm text-primary">Saved.</p>}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving..." : packageId ? "Save changes" : "Create package"}
      </Button>
    </form>
  );
}
