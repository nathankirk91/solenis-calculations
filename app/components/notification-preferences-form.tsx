import { getFormProps, useForm } from "@conform-to/react";
import type { SubmissionResult } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { useFetcher } from "react-router";

import { Alert, AlertDescription } from "~/components/ui/alert";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import {
  NOTIFICATION_CATEGORIES,
  enabledTypesFromPreferences,
  isNotificationTypeId,
  notificationPreferenceSchema,
  type NotificationPreferenceMap,
  type NotificationTypeId,
} from "~/lib/notification-preferences";

type SavePreferencesResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  lastResult?: SubmissionResult<string[]>;
};

type Props = {
  preferences: NotificationPreferenceMap;
};

function submitTypes(
  fetcher: ReturnType<typeof useFetcher<SavePreferencesResult>>,
  types: NotificationTypeId[],
) {
  const payload = new FormData();
  payload.set("intent", "save-preferences");
  for (const typeId of types) {
    payload.append("types", typeId);
  }
  fetcher.submit(payload, { method: "post" });
}

export function NotificationPreferencesForm({ preferences }: Props) {
  const fetcher = useFetcher<SavePreferencesResult>();
  const [form] = useForm({
    lastResult: fetcher.data?.lastResult,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: notificationPreferenceSchema });
    },
  });

  const pendingTypes = fetcher.formData?.getAll("types");
  const enabledTypes = new Set(
    pendingTypes
      ? pendingTypes.map(String).filter(isNotificationTypeId)
      : enabledTypesFromPreferences(preferences),
  );
  const isSaving = fetcher.state !== "idle";

  return (
    <fetcher.Form method="post" {...getFormProps(form)} className="grid gap-5">
      <input type="hidden" name="intent" value="save-preferences" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Alert types</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose which events this account receives on every subscribed
            device. New devices start with every type turned on.
          </p>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">
          {isSaving
            ? "Saving…"
            : fetcher.data && "ok" in fetcher.data && fetcher.data.ok
              ? "Saved"
              : null}
        </p>
      </div>

      {fetcher.data && "error" in fetcher.data && fetcher.data.error ? (
        <Alert variant="destructive">
          <AlertDescription>{fetcher.data.error}</AlertDescription>
        </Alert>
      ) : null}

      {NOTIFICATION_CATEGORIES.map((category, index) => (
        <div key={category.id} className="grid gap-3">
          {index > 0 ? <Separator /> : null}
          <fieldset className="grid gap-3">
            <legend className="font-medium">{category.label}</legend>
            <p className="text-sm text-muted-foreground">{category.description}</p>
            <div className="grid gap-2">
              {category.types.map((type) => {
                const checked = enabledTypes.has(type.id);
                const switchId = `notification-${type.id}`;
                return (
                  <div
                    key={type.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border/70 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <Label htmlFor={switchId} className="font-medium">
                        {type.label}
                      </Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {type.description}
                      </p>
                    </div>
                    <Switch
                      id={switchId}
                      checked={checked}
                      disabled={isSaving}
                      onCheckedChange={(nextChecked) => {
                        const selected = [...enabledTypes].filter(
                          (value) => value !== type.id,
                        );
                        if (nextChecked) {
                          selected.push(type.id);
                        }
                        submitTypes(fetcher, selected);
                      }}
                      aria-label={type.label}
                    />
                  </div>
                );
              })}
            </div>
          </fieldset>
        </div>
      ))}
    </fetcher.Form>
  );
}
