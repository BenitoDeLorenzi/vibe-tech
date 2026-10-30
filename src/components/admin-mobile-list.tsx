"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function AdminMobileList({ items }: { items: ReactNode[] }) {
  const [visible, setVisible] = useState(10);
  const shown = Math.min(visible, items.length);
  return <div className="space-y-3 md:hidden">
    {items.slice(0, shown)}
    {shown < items.length && <Button type="button" variant="outline" className="w-full" onClick={() => setVisible(count => count + 10)}>Mostrar mais</Button>}
    {items.length > 0 && <p className="text-center text-xs text-muted-foreground">Mostrando {shown} de {items.length}</p>}
  </div>;
}
