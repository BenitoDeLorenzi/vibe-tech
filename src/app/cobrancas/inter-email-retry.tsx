"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { retryInterBillingEmailAction } from "./inter-actions";

export function InterEmailRetry({ id }: { id: string }) {
  const [state, action, pending] = useActionState(retryInterBillingEmailAction, {});
  const router = useRouter();
  useEffect(() => {
    if (state.success) { toast.success(state.success); router.refresh(); }
  }, [state.success, router]);
  return <form action={action} className="space-y-1">
    <input type="hidden" name="email_id" value={id} />
    <Button size="xs" variant="outline" disabled={pending}>{pending ? "Enviando..." : "Reenviar e-mail"}</Button>
    {state.error && <p role="alert" className="text-xs text-destructive">{state.error}</p>}
  </form>;
}
