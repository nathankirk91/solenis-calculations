import {
  getFormProps,
  getInputProps,
  useForm,
  type SubmissionResult,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { Form, useNavigation } from "react-router";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import {
  ADIPIC_BAG_COUNT,
  ADIPIC_BAG_MAX_KG,
  ADIPIC_BAG_MIN_KG,
  ADIPIC_TO_DETA_MASS_RATIO,
  DETA_LOAD_MAX_KG,
  INITIAL_DETA_LOAD_FIELDS,
  type Polymer973Result,
} from "~/lib/polymer-973";
import { polymer973Schema } from "~/lib/polymer-973.schema";
import { cn } from "~/lib/utils";

type Props = {
  lastResult?: SubmissionResult<string[]> | null;
  result?: Polymer973Result | null;
};

export function Polymer973Form({ lastResult, result }: Props) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";

  const [form, fields] = useForm({
    lastResult: lastResult ?? undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: polymer973Schema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    defaultValue: {
      detaLoads: Array.from({ length: INITIAL_DETA_LOAD_FIELDS }, () => ""),
      adipicBags: Array.from({ length: ADIPIC_BAG_COUNT }, () => ""),
    },
  });

  const detaLoadFields = fields.detaLoads.getFieldList();
  const adipicBagFields = fields.adipicBags.getFieldList();

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Make-up DETA</CardTitle>
          <CardDescription>
            Enter each DETA drum/IBC pallet load and each Adipic Acid pallet
            weight (2 × ~500 kg bags). Ratio Adipic:DETA ={" "}
            {ADIPIC_TO_DETA_MASS_RATIO.toFixed(10)}.
          </CardDescription>
        </CardHeader>
        <Form method="post" {...getFormProps(form)}>
          <CardContent className="grid gap-6">
            <section className="grid gap-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-medium">DETA loads</h3>
                  <p className="text-sm text-muted-foreground">
                    One field per drum or IBC pallet. Max {DETA_LOAD_MAX_KG} kg
                    each.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  {...form.insert.getButtonProps({
                    name: fields.detaLoads.name,
                    defaultValue: "",
                  })}
                >
                  Add DETA load
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {detaLoadFields.map((field, index) => (
                  <div key={field.key} className="grid gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={field.id}>
                        DETA load {index + 1} (kg)
                      </Label>
                      {detaLoadFields.length > 1 ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-auto px-1 py-0 text-muted-foreground"
                          {...form.remove.getButtonProps({
                            name: fields.detaLoads.name,
                            index,
                          })}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                    <Input
                      {...getInputProps(field, { type: "number" })}
                      key={field.key}
                      step="any"
                      min="0"
                      max={DETA_LOAD_MAX_KG}
                      placeholder="e.g. 900"
                    />
                    {field.errors ? (
                      <p className="text-sm text-destructive" id={field.errorId}>
                        {field.errors}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              {fields.detaLoads.errors ? (
                <p className="text-sm text-destructive">
                  {fields.detaLoads.errors}
                </p>
              ) : null}
            </section>

            <Separator />

            <section className="grid gap-3">
              <div>
                <h3 className="font-medium">Adipic Acid pallets</h3>
                <p className="text-sm text-muted-foreground">
                  Fixed {ADIPIC_BAG_COUNT} pallets (2 × ~500 kg bulk bags each).
                  Each pallet must be between {ADIPIC_BAG_MIN_KG} and{" "}
                  {ADIPIC_BAG_MAX_KG} kg.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {adipicBagFields.map((field, index) => (
                  <div key={field.key} className="grid gap-2">
                    <Label htmlFor={field.id}>
                      Adipic Acid pallet {index + 1} (kg)
                    </Label>
                    <Input
                      {...getInputProps(field, { type: "number" })}
                      key={field.key}
                      step="any"
                      min={ADIPIC_BAG_MIN_KG}
                      max={ADIPIC_BAG_MAX_KG}
                      placeholder="e.g. 1000"
                      required
                    />
                    {field.errors ? (
                      <p className="text-sm text-destructive" id={field.errorId}>
                        {field.errors}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              {fields.adipicBags.errors ? (
                <p className="text-sm text-destructive">
                  {fields.adipicBags.errors}
                </p>
              ) : null}
            </section>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Calculating…" : "Calculate extra DETA"}
            </Button>
          </CardFooter>
        </Form>
      </Card>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            Total DETA required for the Adipic charge, and the remaining DETA to
            add.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {result ? (
            <dl className="grid gap-4">
              <ResultItem
                label="Extra DETA required"
                value={`${result.extraDetaKg} kg`}
                emphasize
                tone={
                  result.extraDetaKg < 0
                    ? "warning"
                    : result.extraDetaKg === 0
                      ? "muted"
                      : "default"
                }
              />
              {result.extraDetaKg < 0 ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  DETA already charged is above target by{" "}
                  {Math.abs(result.extraDetaKg)} kg for this Adipic amount.
                </p>
              ) : null}
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <ResultItem
                  label="Target total DETA"
                  value={`${result.targetDetaKg} kg`}
                />
                <ResultItem
                  label="DETA already charged"
                  value={`${result.detaChargedKg} kg`}
                />
                <ResultItem
                  label="Adipic Acid charged"
                  value={`${result.adipicAcidKg} kg`}
                />
                <ResultItem
                  label="Mass ratio (Adipic:DETA)"
                  value={result.massRatioLabel}
                />
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter DETA loads and Adipic Acid pallet weights to see the extra
              DETA required.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultItem({
  label,
  value,
  emphasize = false,
  tone = "default",
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  tone?: "default" | "warning" | "muted";
}) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "font-heading font-semibold tabular-nums tracking-tight",
          emphasize ? "text-3xl" : "text-xl",
          tone === "warning" && "text-amber-700 dark:text-amber-400",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
