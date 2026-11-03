"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";

export function DesktopShowMoreRows({ rows, columns }: { rows: ReactNode[]; columns: number }) {
  const [visible, setVisible] = useState(10);
  const shown = Math.min(visible, rows.length);
  return <>
    {rows.slice(0, shown)}
    <TableRow className="hover:bg-transparent"><TableCell colSpan={columns} className="py-3 text-center">
      {shown < rows.length && <Button type="button" variant="outline" className="w-full max-w-64" onClick={() => setVisible(count => count + 10)}>Mostrar mais</Button>}
      <p className="mt-2 text-xs text-muted-foreground">Mostrando {shown} de {rows.length}</p>
    </TableCell></TableRow>
  </>;
}
