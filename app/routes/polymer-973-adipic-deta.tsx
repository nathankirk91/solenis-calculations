import { parseWithZod } from "@conform-to/zod/v4";
import { data, Link } from "react-router";

import type { Route } from "./+types/polymer-973-adipic-deta";

import { AppHeader } from "~/components/app-header";
import { Polymer973Form } from "~/components/polymer-973-form";
import { Badge } from "~/components/ui/badge";
import { requireUser } from "~/lib/auth.server";
import { getPrisma } from "~/lib/db.server";
import { calculatePolymer973ExtraDeta } from "~/lib/polymer-973";
import { polymer973Schema } from "~/lib/polymer-973.schema";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Polymer 973 — Adipic Acid:DETA Ratio | Solenis Calculations" },
    {
      name: "description",
      content:
        "Calculate extra DETA required after charging Adipic Acid for Polymer 973.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(
    request,
    "/calculations/polymer-973-adipic-deta",
  );
  return { user };
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request, "/calculations/polymer-973-adipic-deta");

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: polymer973Schema });

  if (submission.status !== "success") {
    return data(
      { result: null, lastResult: submission.reply() },
      { status: submission.status === "error" ? 400 : 200 },
    );
  }

  const outputs = calculatePolymer973ExtraDeta({
    detaChargedKg: submission.value.detaChargedKg,
    adipicAcidKg: submission.value.adipicAcidKg,
  });

  const prisma = getPrisma();
  if (prisma) {
    try {
      await prisma.calculationRun.create({
        data: {
          calculationId: "polymer-973-adipic-deta",
          inputs: submission.value,
          outputs,
        },
      });
    } catch {
      // Persistence is best-effort; calculation result still returns to the UI.
    }
  }

  return {
    result: outputs,
    lastResult: submission.reply(),
  };
}

export default function Polymer973AdipicDetaPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_oklch(0.97_0.02_220),_transparent_55%),linear-gradient(180deg,_oklch(0.99_0.01_220),_oklch(0.96_0.015_200))]">
      <AppHeader user={loaderData.user} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Polymer</Badge>
            <Link
              to="/"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← All calculators
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Polymer 973 — Adipic Acid:DETA Ratio
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Charge ~90% DETA via drums/IBCs, then Adipic Acid pallets (bulk-bag
            actual weights). Enter each load to calculate how much extra DETA is
            required.
          </p>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
          <Polymer973Form
            lastResult={actionData?.lastResult}
            result={actionData?.result}
          />
        </div>
      </main>
    </div>
  );
}
