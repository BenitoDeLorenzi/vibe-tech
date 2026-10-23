import { CircleCheck, CircleX, Clock3, Mail, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatUsuarioStatus, getUsuarioStatus, type Usuario, type UsuarioStatus } from "@/lib/usuarios-data";

const appearances: Record<UsuarioStatus, { icon: LucideIcon; className: string }> = {
  active: { icon: CircleCheck, className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400" },
  first_access: { icon: Clock3, className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400" },
  email_pending: { icon: Mail, className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-400" },
  inactive: { icon: CircleX, className: "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
};

export function UsuarioStatusBadge({ usuario }: { usuario: Usuario }) {
  const status = getUsuarioStatus(usuario);
  const { icon: Icon, className } = appearances[status];
  const explanation = status === "first_access"
    ? usuario.senha_inicial_alterada_em
      ? "Senha inicial alterada; falta confirmar o e-mail para concluir o primeiro acesso."
      : "A conta está habilitada, mas o usuário ainda não iniciou a configuração do acesso."
    : status === "email_pending"
      ? usuario.email_contato
        ? "O primeiro acesso foi concluído, mas o e-mail de recuperação precisa ser verificado."
        : "O primeiro acesso foi concluído, mas não há e-mail de recuperação verificado."
      : status === "inactive"
        ? "O acesso foi bloqueado pelo Master."
        : "Primeiro acesso concluído e e-mail de recuperação verificado.";

  return (
    <Tooltip>
      <TooltipTrigger render={<button type="button" aria-label={`${formatUsuarioStatus(status)}. ${explanation}`} className="inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />}>
        <Badge variant="outline" className={className}>
          <Icon className="size-3.5" />
          {formatUsuarioStatus(status)}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{explanation}</TooltipContent>
    </Tooltip>
  );
}
