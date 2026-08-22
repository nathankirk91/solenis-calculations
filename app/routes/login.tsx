import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { Form, data, redirect, useNavigation } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/login";

import { APP_NAME, pageTitle } from "~/lib/brand";
import {
  authenticator,
  createUserSession,
  getUser,
} from "~/lib/auth.server";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

const loginSchema = z.object({
  email: z.email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

export function meta({}: Route.MetaArgs) {
  return [{ title: pageTitle("Sign in") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  if (user) {
    throw redirect("/");
  }
  return data(null);
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.clone().formData();
  const submission = parseWithZod(formData, { schema: loginSchema });

  if (submission.status !== "success") {
    return data(
      { error: null, lastResult: submission.reply() },
      { status: submission.status === "error" ? 400 : 200 },
    );
  }

  try {
    const user = await authenticator.authenticate("user-pass", request);
    return createUserSession(request, user);
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Unable to sign in.";

    return data(
      {
        error: message,
        lastResult: submission.reply({
          formErrors: [message],
        }),
      },
      { status: 400 },
    );
  }
}

function AppMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 89 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M4.10364 91.4189C4.67164 91.4189 47.0446 91.4189 47.6126 91.4189C74.6496 91.0982 99.9825 58.808 78.3984 36.6753C78.3984 40.9521 73.6272 44.9082 66.0159 47.5812C55.5647 51.3235 40.4558 54.9588 30.459 57.3111C24.6653 58.701 20.1213 60.8395 16.7133 65.4371C14.1005 69.0724 1.15002 86.6075 1.15002 86.6075C-0.553983 89.3874 0.809223 91.4189 4.10364 91.4189Z"
        fill="#00CC99"
      />
      <path
        d="M84.872 0C84.304 0 41.8174 0 41.2494 0C14.326 0.320763 -11.1205 32.7179 10.5772 54.7436C10.5772 50.4668 15.3484 46.5107 22.9597 43.8377C33.4109 40.0954 48.5198 36.4601 58.5166 34.1078C64.3103 32.7179 68.8543 30.5794 72.2623 25.9818C74.8751 22.3465 87.8256 4.81145 87.8256 4.81145C89.5296 2.0315 88.28 0.106921 84.9856 0.106921L84.872 0Z"
        fill="#00CC99"
      />
    </svg>
  );
}

export default function LoginPage({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";

  const [form, fields] = useForm({
    lastResult: actionData?.lastResult ?? undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: loginSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="grid min-h-screen w-full flex-grow items-center bg-zinc-100 px-4 sm:justify-center">
      <div className="w-full space-y-6 rounded-2xl bg-white px-4 py-10 shadow-md ring-1 ring-black/5 sm:w-96 sm:px-8">
        <header className="text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-brand-navy p-2">
            <AppMark className="size-full" />
          </span>
          <h1 className="mt-4 text-xl font-medium tracking-tight text-zinc-950">
            Sign in to {APP_NAME}
          </h1>
        </header>

        <Form method="post" className="space-y-4" {...getFormProps(form)}>
          {actionData?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{actionData.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label
              htmlFor={fields.email.id}
              className="text-sm font-medium text-zinc-950"
            >
              Email address
            </Label>
            <Input
              {...getInputProps(fields.email, { type: "email" })}
              autoComplete="email"
              placeholder="Enter your email address"
              className={cn(
                "h-9 rounded-md border-0 bg-white px-3.5 text-sm shadow-none ring-1 ring-inset ring-zinc-300 hover:ring-zinc-400 focus-visible:border-0 focus-visible:ring-[1.5px] focus-visible:ring-zinc-950",
                fields.email.errors && "ring-red-400 focus-visible:ring-red-400",
              )}
            />
            {fields.email.errors ? (
              <p className="text-sm text-red-400" id={fields.email.errorId}>
                {fields.email.errors}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor={fields.password.id}
              className="text-sm font-medium text-zinc-950"
            >
              Password
            </Label>
            <Input
              {...getInputProps(fields.password, { type: "password" })}
              autoComplete="current-password"
              placeholder="Enter your password"
              className={cn(
                "h-9 rounded-md border-0 bg-white px-3.5 text-sm shadow-none ring-1 ring-inset ring-zinc-300 hover:ring-zinc-400 focus-visible:border-0 focus-visible:ring-[1.5px] focus-visible:ring-zinc-950",
                fields.password.errors &&
                  "ring-red-400 focus-visible:ring-red-400",
              )}
            />
            {fields.password.errors ? (
              <p className="text-sm text-red-400" id={fields.password.errorId}>
                {fields.password.errors}
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-9 w-full rounded-md bg-zinc-950 text-sm font-medium text-white shadow ring-1 ring-inset ring-zinc-950 hover:bg-zinc-800 focus-visible:ring-offset-2"
          >
            {isSubmitting ? "Signing in…" : "Continue"}
          </Button>
        </Form>
      </div>
    </div>
  );
}
