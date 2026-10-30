"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { mobileDrawerContentClassName } from "@/lib/mobile-drawer"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

const ResponsiveDialogContext = React.createContext(false)
const DrawerHeaderTargetContext = React.createContext<HTMLDivElement | null>(null)
const DrawerFooterTargetContext = React.createContext<HTMLDivElement | null>(null)

function useResponsiveDialog() {
  return React.useContext(ResponsiveDialogContext)
}

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  const mobile = useIsMobile()
  return (
    <ResponsiveDialogContext.Provider value={mobile}>
      {mobile ? <Drawer showSwipeHandle {...(props as React.ComponentProps<typeof Drawer>)} onOpenChange={props.onOpenChange as ((open: boolean) => void) | undefined} /> : <DialogPrimitive.Root data-slot="dialog" {...props} />}
    </ResponsiveDialogContext.Provider>
  )
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return useResponsiveDialog() ? <DrawerTrigger {...(props as React.ComponentProps<typeof DrawerTrigger>)} /> : <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return useResponsiveDialog() ? <DrawerPortal {...props} /> : <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return useResponsiveDialog() ? <DrawerClose data-slot="dialog-close" {...props} /> : <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  const mobile = useResponsiveDialog()
  if (mobile) return <DrawerOverlay className={className} {...props} />
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  const mobile = useResponsiveDialog()
  const [headerTarget, setHeaderTarget] = React.useState<HTMLDivElement | null>(null)
  const [footerTarget, setFooterTarget] = React.useState<HTMLDivElement | null>(null)
  if (mobile) {
    return (
      <DrawerContent className={mobileDrawerContentClassName}>
        <DrawerHeaderTargetContext.Provider value={headerTarget}>
          <DrawerFooterTargetContext.Provider value={footerTarget}>
            <div ref={setHeaderTarget} className="shrink-0 empty:hidden" />
            <div data-slot="dialog-content" className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain p-4", className)}>
              {children}
              {showCloseButton && <DrawerClose data-slot="dialog-close" render={<Button variant="ghost" size="icon-sm" className="absolute right-3 top-3 z-10" aria-label="Fechar" />}><XIcon className="size-4" /></DrawerClose>}
            </div>
            <div ref={setFooterTarget} className="shrink-0 empty:hidden" />
          </DrawerFooterTargetContext.Provider>
        </DrawerHeaderTargetContext.Provider>
      </DrawerContent>
    )
  }
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto overscroll-contain rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  const mobile = useResponsiveDialog()
  const headerTarget = React.useContext(DrawerHeaderTargetContext)
  if (mobile) return headerTarget ? createPortal(<DrawerHeader className={cn("pr-12 text-left", className)} {...props} />, headerTarget) : null
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  const mobile = useResponsiveDialog()
  const footerTarget = React.useContext(DrawerFooterTargetContext)
  const placeholderRef = React.useRef<HTMLSpanElement>(null)
  const generatedFormId = React.useId()
  const [formId, setFormId] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!mobile) return
    const form = placeholderRef.current?.closest("form")
    if (!form) return
    if (!form.id) form.id = `drawer-form-${generatedFormId}`
    setFormId(form.id)
  }, [mobile, generatedFormId])
  if (mobile) {
    const actions = React.Children.map(children, child =>
      formId && React.isValidElement<{ type?: string; form?: string }>(child) && child.props.type === "submit"
        ? React.cloneElement(child, { form: formId })
        : child
    )
    return <>
      <span ref={placeholderRef} className="hidden" aria-hidden="true" />
      {footerTarget && createPortal(<DrawerFooter className={cn("border-t bg-popover p-4", className)} {...props}>{actions}{showCloseButton && <DrawerClose data-slot="dialog-close" render={<Button variant="outline" />}>Fechar</DrawerClose>}</DrawerFooter>, footerTarget)}
    </>
  }
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  const mobile = useResponsiveDialog()
  if (mobile) return <DrawerTitle className={className} {...props} />
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  const mobile = useResponsiveDialog()
  if (mobile) return <DrawerDescription className={className} {...props} />
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
