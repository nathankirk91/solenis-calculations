import { useState } from "react";
import {
  getFormProps,
  useForm,
  type SubmissionResult,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { Form, useNavigation } from "react-router";

import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import {
  createPermitCopyFormSchema,
  type CopyablePermitHeading,
} from "~/lib/permit-copy";

type Props = {
  headings: CopyablePermitHeading[];
  lastResult?: SubmissionResult<string[]> | null;
  error?: string | null;
};

export function PermitCopyForm({ headings, lastResult, error }: Props) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const schema = createPermitCopyFormSchema(headings.map((heading) => heading.key));
  const [form, fields] = useForm({
    lastResult: lastResult ?? undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldValidate: "onSubmit",
  });
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Copy to a new permit</CardTitle>
        <CardDescription>
          Tick the headings you want to copy. That selects every field under
          the heading, except signatures, dates, and times — those always stay
          blank on the new permit.
        </CardDescription>
      </CardHeader>
      <Form method="post" {...getFormProps(form)}>
        <CardContent className="grid gap-4">
          {headings.length > 0 ? (
            <fieldset className="grid gap-3">
              <legend className="text-sm font-medium">Headings to copy</legend>
              {headings.map((heading) => {
                const inputId = `${fields.heading.id}-${heading.key}`;
                const checked = selected.has(heading.key);
                return (
                  <div key={heading.key}>
                    {checked ? (
                      <input
                        type="hidden"
                        name={fields.heading.name}
                        value={heading.key}
                      />
                    ) : null}
                    <Label
                      htmlFor={inputId}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-background/40 p-4 font-normal has-[[data-state=checked]]:border-brand/50 has-[[data-state=checked]]:bg-brand/10"
                    >
                      <Checkbox
                        id={inputId}
                        checked={checked}
                        onCheckedChange={(nextChecked) => {
                          setSelected((current) => {
                            const next = new Set(current);
                            if (nextChecked === true) {
                              next.add(heading.key);
                            } else {
                              next.delete(heading.key);
                            }
                            return next;
                          });
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-brand-navy">
                          {heading.title}
                        </span>
                        {heading.fieldLabels.length > 0 ? (
                          <span className="mt-1 block text-sm text-muted-foreground">
                            {heading.fieldLabels.join(" · ")}
                          </span>
                        ) : null}
                      </span>
                    </Label>
                  </div>
                );
              })}
            </fieldset>
          ) : (
            <p className="text-sm text-muted-foreground">
              This closed permit has no headings that can be copied.
              Signatures, dates, and times are never copied. You can still
              start a blank permit of the same type.
            </p>
          )}
          {fields.heading.errors ? (
            <Alert variant="destructive">
              <AlertDescription>
                {fields.heading.errors.join(" ")}
              </AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {form.errors ? (
            <Alert variant="destructive">
              <AlertDescription>{form.errors.join(" ")}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Opening…" : "Create new permit"}
          </Button>
        </CardFooter>
      </Form>
    </Card>
  );
}
