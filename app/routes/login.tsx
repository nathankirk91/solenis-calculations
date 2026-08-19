import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { Form, data, redirect } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/login";

import { APP_NAME, pageTitle } from "~/lib/brand";
import {
  authenticator,
  createUserSession,
  getUser,
} from "~/lib/auth.server";
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

export default function LoginPage({ actionData }: Route.ComponentProps) {
  const [form, fields] = useForm({
    lastResult: actionData?.lastResult ?? undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: loginSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="flex app-shell items-center justify-center px-4">
      <Card className="w-full max-w-md border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-2xl text-brand-navy">
            {APP_NAME} sign in
          </CardTitle>
          <CardDescription>
            Use your email and password to access plant calculators.
          </CardDescription>
        </CardHeader>
        <Form method="post" {...getFormProps(form)}>
          <CardContent className="grid gap-4">
            {actionData?.error ? (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {actionData.error}
              </p>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor={fields.email.id}>Email</Label>
              <Input
                {...getInputProps(fields.email, { type: "email" })}
                autoComplete="email"
                placeholder="you@example.com"
              />
              {fields.email.errors ? (
                <p className="text-sm text-destructive" id={fields.email.errorId}>
                  {fields.email.errors}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor={fields.password.id}>Password</Label>
              <Input
                {...getInputProps(fields.password, { type: "password" })}
                autoComplete="current-password"
              />
              {fields.password.errors ? (
                <p
                  className="text-sm text-destructive"
                  id={fields.password.errorId}
                >
                  {fields.password.errors}
                </p>
              ) : null}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </CardFooter>
        </Form>
      </Card>
    </div>
  );
}
