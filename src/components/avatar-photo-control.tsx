"use client";

import { useRef } from "react";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldError } from "@/components/ui/field";

export function AvatarPhotoControl({
  nome,
  source,
  pending = false,
  error,
  onSelect,
  onRemove,
  label = "foto de perfil",
  hint,
  contain = false,
}: {
  nome: string;
  source: string | null | undefined;
  pending?: boolean;
  error?: string;
  onSelect: (file: File) => void;
  onRemove: () => void;
  label?: string;
  hint?: string;
  contain?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-2 py-3">
      <input
        ref={input}
        type="file"
        className="hidden"
        tabIndex={-1}
        aria-label={`Selecionar ${label}`}
        accept="image/jpeg,image/png,image/webp"
        disabled={pending}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) onSelect(file);
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              disabled={pending}
              aria-label={`Alterar ${label}`}
              aria-busy={pending}
              className="group relative rounded-full outline-none ring-offset-background transition-shadow hover:ring-4 hover:ring-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 disabled:cursor-wait"
            />
          }
        >
          <Avatar className="size-24 ring-4 ring-background shadow-sm">
            {source && (
              <AvatarImage
                src={source}
                alt={nome}
                className={contain ? "object-contain p-2" : "object-cover"}
              />
            )}
            <AvatarFallback className="bg-muted text-2xl font-medium">
              {nome
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase() || "E"}
            </AvatarFallback>
          </Avatar>
          <span className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm">
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Camera className="size-4" />
            )}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-48">
          <DropdownMenuItem
            disabled={pending}
            onClick={() => input.current?.click()}
          >
            <ImagePlus />
            {source ? "Trocar foto" : "Enviar foto"}
          </DropdownMenuItem>
          {source && (
            <DropdownMenuItem
              disabled={pending}
              variant="destructive"
              onClick={onRemove}
            >
              <Trash2 />
              Remover foto
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <p
        className="mt-1 text-center text-xs text-muted-foreground"
        aria-live="polite"
      >
        {pending
          ? "Salvando imagem…"
          : (hint ?? "Clique no avatar para alterar sua foto")}
      </p>
      <p className="text-[11px] text-muted-foreground">
        JPG, PNG ou WebP · até 3 MB
      </p>
      <FieldError>{error}</FieldError>
    </div>
  );
}
