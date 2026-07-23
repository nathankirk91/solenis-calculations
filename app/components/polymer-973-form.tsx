import {
  getFormProps,
  getInputProps,
  getSelectProps,
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
  ADIPIC_ACID_MW,
  DETA_MW,
  type Polymer973Result,
} from "~/lib/polymer-973";
import {
  polymer973Schema,
  type Polymer973FormValues,
} from "~/lib/polymer-973.schema";

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
      basis: defaultValues?.basis ?? "total",
      amountKg: defaultValues?.amountKg?.toString() ?? "1000",
      molarRatio: defaultValues?.molarRatio?.toString() ?? "1",
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Charge calculator</CardTitle>
          <CardDescription>
            Enter a known mass and the target Adipic:DETA molar ratio. Defaults
            use 1.0 mol Adipic Acid per 1.0 mol DETA (MW {ADIPIC_ACID_MW} /{" "}
            {DETA_MW}).
          </CardDescription>
        </CardHeader>
        <Form method="post" {...getFormProps(form)}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={fields.basis.id}>Amount basis</Label>
              <select
                className="border-input bg-background h-9 w-full rounded-lg border px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                {...getSelectProps(fields.basis)}
                defaultValue={fields.basis.initialValue ?? "total"}
              >
                <option value="total">Total reactant mass (kg)</option>
                <option value="adipic">Adipic Acid charge (kg)</option>
                <option value="deta">DETA charge (kg)</option>
              </select>
              {fields.basis.errors ? (
                <p className="text-sm text-destructive" id={fields.basis.errorId}>
                  {fields.basis.errors}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor={fields.amountKg.id}>Amount (kg)</Label>
              <Input
                {...getInputProps(fields.amountKg, { type: "number" })}
                step="any"
                min="0"
                placeholder="e.g. 1000"
              />
              {fields.amountKg.errors ? (
                <p
                  className="text-sm text-destructive"
                  id={fields.amountKg.errorId}
                >
                  {fields.amountKg.errors}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor={fields.molarRatio.id}>
                Target molar ratio (Adipic / DETA)
              </Label>
              <Input
                {...getInputProps(fields.molarRatio, { type: "number" })}
                step="any"
                min="0"
                placeholder="1.0"
              />
              {fields.molarRatio.errors ? (
                <p
                  className="text-sm text-destructive"
                  id={fields.molarRatio.errorId}
                >
                  {fields.molarRatio.errors}
                </p>
              ) : null}
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Calculating…" : "Calculate"}
            </Button>
          </CardFooter>
        </Form>
      </Card>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            Plant charges and realized Adipic Acid:DETA ratios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {result ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <ResultItem label="Adipic Acid" value={`${result.adipicAcidKg} kg`} />
              <ResultItem label="DETA" value={`${result.detaKg} kg`} />
              <ResultItem label="Total charge" value={`${result.totalKg} kg`} />
              <ResultItem
                label="Mass ratio (Adipic:DETA)"
                value={`${result.massRatioAdipicToDeta} : 1`}
              />
              <Separator className="sm:col-span-2" />
              <ResultItem
                label="Adipic Acid"
                value={`${result.adipicAcidKmol} kmol`}
              />
              <ResultItem label="DETA" value={`${result.detaKmol} kmol`} />
              <ResultItem
                label="Molar ratio (Adipic:DETA)"
                value={`${result.molarRatioAdipicToDeta} : 1`}
              />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Submit the form to see Adipic Acid and DETA charges.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="font-heading text-xl font-semibold tabular-nums tracking-tight">
        {value}
      </dd>
    </div>
  );
}
