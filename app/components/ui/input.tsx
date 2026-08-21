import * as React from "react"

import { cn } from "~/lib/utils"

const temporalInputTypes = new Set([
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
])

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const isTemporal = typeof type === "string" && temporalInputTypes.has(type)

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        // Native date/time controls size to content on WebKit/Blink unless forced.
        isTemporal &&
          "block max-w-full [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-date-and-time-value]:w-full [&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit]:w-full [&::-webkit-datetime-edit]:min-w-0",
        className
      )}
      {...props}
    />
  )
}

export { Input }
