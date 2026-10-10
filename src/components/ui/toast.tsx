"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { CheckCircle2, X } from "lucide-react"

import { cn } from "@/lib/utils"

export const toastManager = ToastPrimitive.createToastManager()

function ToastProvider() {
  return (
    <ToastPrimitive.Provider toastManager={toastManager} timeout={3000} limit={3}>
      <ToastViewport />
    </ToastPrimitive.Provider>
  )
}

function ToastViewport() {
  const { toasts } = ToastPrimitive.useToastManager()
  return (
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport
        data-slot="toast-viewport"
        className="fixed top-4 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 outline-none [&>*]:transition-transform [&>*]:duration-500 [&>*]:ease-[cubic-bezier(0.16,1,0.3,1)]"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  )
}

function ToastItem({ toast }: { toast: ToastPrimitive.Root.ToastObject }) {
  return (
    <ToastPrimitive.Root
      toast={toast}
      swipeDirection={["up", "left", "right"]}
      data-slot="toast"
      className={cn(
        "flex w-full origin-top items-start gap-3 rounded-lg border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg outline-none",
        "transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform",
        "translate-y-0 scale-100 opacity-100 blur-0",
        "data-starting-style:-translate-y-2 data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-starting-style:blur-[2px]",
        "data-ending-style:-translate-y-2 data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-ending-style:blur-[2px]"
      )}
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {toast.title && (
          <ToastPrimitive.Title className="font-medium text-foreground">{toast.title}</ToastPrimitive.Title>
        )}
        {toast.description && (
          <ToastPrimitive.Description className="text-xs text-muted-foreground">
            {toast.description}
          </ToastPrimitive.Description>
        )}
      </div>
      <ToastPrimitive.Close
        aria-label="Tutup notifikasi"
        className="-mr-1 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  )
}

export { ToastProvider }
