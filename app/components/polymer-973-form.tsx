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
  ADIPIC_MASS_PARTS,
  DETA_MASS_PARTS,
  type Polymer973Result,
} from "~/lib/polymer-973";
import {
  polymer973Schema,
  type Polymer973FormValues,
} from "~/lib/polymer-973.schema";
import { cn } from "~/lib/utils";

type Props = {
  lastResult?: SubmissionResult<string[]> | null;
  result?: Polymer973Result | null;
  defaultValues?: Partial<Polymer973FormValues>;
};

export function Polymer973Form({
  lastResult,
  result,
  defaultValues,
}: Props) {
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
      detaChargedKg: defaultValues?.detaChargedKg?.toString() ?? "",
      adipicAcidKg: defaultValues?.adipicAcidKg?.toString() ?? "",
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Make-up DETA</CardTitle>
          <CardDescription>
            After charging ~90% DETA and all Adipic Acid (bulk-bag actual), enter
            both amounts. Target mass ratio Adipic:DETA = {ADIPIC_MASS_PARTS}:
            {DETA_MASS_PARTS}.
          </CardDescription>
        </CardHeader>
        <Form method="post" {...getFormProps(form)}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={fields.detaChargedKg.id}>
                DETA already charged (kg)
              </Label>
              <Input
                {...getInputProps(fields.detaChargedKg, { type: "number" })}
                step="any"
                min="0"
                placeholder="e.g. 2875.7"
              />
              {fields.detaChargedKg.errors ? (
                <p
                  className="text-sm text-destructive"
                  id={fields.detaChargedKg.errorId}
                >
                  {fields.detaChargedKg.errors}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor={fields.adipicAcidKg.id}>
                Adipic Acid charged (kg)
              </Label>
              <Input
                {...getInputProps(fields.adipicAcidKg, { type: "number" })}
                step="any"
                min="0"
                placeholder="e.g. 4000"
              />
              {fields.adipicAcidKg.errors ? (
                <p
                  className="text-sm text-destructive"
                  id={fields.adipicAcidKg.errorId}
                >
                  {fields.adipicAcidKg.errors}
                </p>
              ) : null}
            </div>
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
              Enter DETA already charged and Adipic Acid charged to see the
              extra DETA required.
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
