import { AccessDenied } from "@/components/access-denied";

export default function GestaoForbiddenPage() {
  return <AccessDenied homeHref="/gestao" homeLabel="Voltar ao painel" />;
}
