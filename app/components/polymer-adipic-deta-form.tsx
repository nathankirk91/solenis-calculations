import {
  getFormProps,
  getInputProps,
  getSelectProps,
  useForm,
  type SubmissionResult,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { Form, useNavigation } from "react-router";

import { Badge } from "~/components/ui/badge";
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
  DETA_LOAD_MAX_KG,
  getAdipicToDetaMassRatio,
  type PolymerAdipicDetaProduct,
  type PolymerAdipicDetaResult,
} from "~/lib/polymer-adipic-deta";
import { createPolymerAdipicDetaSchema } from "~/lib/polymer-adipic-deta.schema";
import type { OperatorOption } from "~/lib/operators.server";
import { cn } from "~/lib/utils";

type Props = {
  product: PolymerAdipicDetaProduct;
  operators: OperatorOption[];
  lastResult?: SubmissionResult<string[]> | null;
  result?: PolymerAdipicDetaResult | null;
  status?: "PENDING" | null;
  formError?: string | null;
};

export function PolymerAdipicDetaForm({
  product,
  operators,
  lastResult,
  result,
  status,
  formError,
}: Props) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const massRatio = getAdipicToDetaMassRatio(product);
  const schema = createPolymerAdipicDetaSchema(product);

  const [form, fields] = useForm({
    lastResult: lastResult ?? undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    defaultValue: {
      operatorId: "",
      detaLoads: Array.from(
        { length: product.initialDetaLoadFields },
        () => "",
      ),
      adipicBags: Array.from({ length: product.adipicFieldCount }, () => ""),
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
            Select the operator, enter DETA loads and Adipic Acid weights, then
            submit for management approval. Ratio Adipic:DETA ={" "}
            {massRatio.toFixed(10)}.
          </CardDescription>
        </CardHeader>
        <Form method="post" {...getFormProps(form)}>
          <CardContent className="grid gap-6">
            <section className="grid gap-2">
              <Label htmlFor={fields.operatorId.id}>
                Operator / who is doing this operation
              </Label>
              <select
                {...getSelectProps(fields.operatorId)}
                key={fields.operatorId.key}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"
                required
              >
                <option value="">Select operator…</option>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.name}
                  </option>
                ))}
              </select>
              {fields.operatorId.errors ? (
                <p
                  className="text-sm text-destructive"
                  id={fields.operatorId.errorId}
                >
                  {fields.operatorId.errors}
                </p>
              ) : null}
              {operators.length === 0 ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  No active operators are configured. Ask an admin to seed the
                  operator list.
                </p>
              ) : null}
            </section>

            <Separator />

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
                <h3 className="font-medium">Adipic Acid mix</h3>
                <p className="text-sm text-muted-foreground">
                  {product.adipicFieldHelp}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {adipicBagFields.map((field, index) => (
                  <div key={field.key} className="grid gap-2">
                    <Label htmlFor={field.id}>
                      Adipic Acid {index + 1} (kg)
                    </Label>
                    <Input
                      {...getInputProps(field, { type: "number" })}
                      key={field.key}
                      step="any"
                      min={product.adipicFieldMinKg}
                      max={product.adipicFieldMaxKg ?? undefined}
                      placeholder={`e.g. ${product.adipicFieldMinKg || 1000}`}
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

            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button
              type="submit"
              disabled={isSubmitting || operators.length === 0}
            >
              {isSubmitting ? "Submitting…" : "Submit for approval"}
            </Button>
          </CardFooter>
        </Form>
      </Card>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Results
            {status === "PENDING" ? (
              <Badge variant="secondary">Pending approval</Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            Total DETA required for the Adipic charge, and the remaining DETA to
            add. Managers review pending submissions before vessel charge.
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
              {status === "PENDING" ? (
                <p className="text-sm text-muted-foreground">
                  Submitted for management approval. Do not add DETA to the
                  vessel until a manager approves this run.
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
              Enter the operator, DETA loads, and Adipic Acid weights to
              calculate and submit for approval.
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
