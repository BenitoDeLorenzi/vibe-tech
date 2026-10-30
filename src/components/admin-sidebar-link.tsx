"use client";

import { forwardRef, type ComponentProps } from "react";
import Link from "next/link";
import { useSidebar } from "@/components/ui/sidebar";

export const AdminSidebarLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof Link>>(function AdminSidebarLink({ onClick, ...props }, ref) {
  const { isMobile, setOpenMobile } = useSidebar();
  return <Link {...props} ref={ref} onClick={event => { onClick?.(event); if (isMobile && !event.defaultPrevented) setOpenMobile(false); }} />;
});
