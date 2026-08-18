import { getFormProps, useForm } from "@conform-to/react";
import type { SubmissionResult } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { useFetcher } from "react-router";

import { Separator } from "~/components/ui/separator";
import {
  NOTIFICATION_CATEGORIES,
  enabledTypesFromPreferences,
  isNotificationTypeId,
  notificationPreferenceSchema,
  type NotificationPreferenceMap,
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
        <p className="text-sm text-destructive">{fetcher.data.error}</p>
      ) : null}

      {NOTIFICATION_CATEGORIES.map((category, index) => (
        <div key={category.id} className="grid gap-3">
          {index > 0 ? <Separator /> : null}
          <fieldset className="grid gap-3">
            <legend className="font-medium">{category.label}</legend>
            <p className="text-sm text-muted-foreground">{category.description}</p>
            <div className="grid gap-2">
              {category.types.map((type) => (
                <label
                  key={type.id}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-border/70 px-3 py-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    name="types"
                    value={type.id}
                    checked={enabledTypes.has(type.id)}
                    onChange={(event) => {
                      const formElement = event.currentTarget.form;
                      if (!formElement) {
                        return;
                      }

                    const payload = new FormData(formElement);
                    const fieldName = "types";
                    const typeId = event.currentTarget.value;
                    const selected = payload
                      .getAll(fieldName)
                      .map(String)
                      .filter((value) => value !== typeId);

                    if (event.currentTarget.checked) {
                      selected.push(typeId);
                    }

                    payload.delete(fieldName);
                    for (const value of selected) {
                      payload.append(fieldName, value);
                    }
                      payload.set("intent", "save-preferences");
                      fetcher.submit(payload, { method: "post" });
                    }}
                  />
                  <span>
                    <span className="font-medium">{type.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {type.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      ))}
    </fetcher.Form>
  );
}
