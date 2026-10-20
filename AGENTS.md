<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Padrão de interface solicitado pelo usuário

- Nome comercial do módulo de frotas: **Vibe Frotas**. Usar em telas, impressões e documentação. O slug interno `frotas-publicas` permanece por compatibilidade com licenças e permissões.

- Todos os seletores visíveis devem usar o Select ou Combobox shadcn já existente em `src/components/ui`, nunca listas nativas `<select>/<option>`.
- Select segue a composição oficial: `Select` com `items`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectGroup`, `SelectLabel` e `SelectItem`. Manter os estilos dos componentes; o menu deve abrir ancorado e centralizado no campo (`align="center"`, `alignItemWithTrigger={false}`), sem deslocar o popup sobre o formulário para alinhar a opção selecionada.
- Para listas pesquisáveis (por exemplo, produtos no estoque), usar Combobox com pesquisa digitada. Para opções simples, usar Select; `src/components/form-select.tsx` compõe o Select para formulários.
- Manter a identidade visual de Frotas: sidebar, tabelas, botões, modais e campos padronizados. Usar React Hook Form e mensagens junto aos campos nos novos formulários; evitar validação nativa do navegador.

## Padrão obrigatório de sidebar para módulos novos e existentes

- Referência visual aprovada: Sidebar original do shadcn (sidebar-08). Aplicar ao Vibe Gestão, Vibe Frotas e painel Vibe Tech.
- Reutilizar `src/components/sidebar-identity.tsx` (`SidebarIdentity`) no `SidebarHeader`: nome do módulo no topo; abaixo, avatar com logo da empresa e nome ao lado, com descrição/unidade opcional. Sem logo, usar iniciais. No painel global, usar a identidade Vibe Tech.
- Cabeçalho: nome do módulo discreto no topo (12px), seguido da composição original do shadcn com avatar de 32px e nome fantasia, sem cartão/borda adicional. Usar nome oficial como fallback. Para Master, toda a linha da empresa é um SidebarMenuButton que abre DropdownMenu para trocar empresa/unidade. Para os demais usuários, mostrar a mesma identificação estática, sem dropdown ou indicador de abertura. Evitar descrições redundantes.
- Usar `sidebarNavClass` e `sidebarFooterClass` de `src/components/sidebar-styles.ts`. Os links ativos têm fundo primary, texto em contraste e peso semibold. `SidebarMenuButton` usa o atributo de presença `data-active` (não `data-[active=true]`).
- Rodapé com `SidebarUserMenu emphasized`, avatar, nome, perfil e indicador de abertura. Preservar links e permissões de cada módulo.
- Seletor de empresa/unidade somente para Master (`bdl_admin`), com autorização também no servidor. Demais perfis veem apenas a identificação. Não criar seletores nativos.
- Preservar `Sidebar collapsible="icon" variant="inset"`, tooltips dos links, modo recolhido, layout móvel, tema escuro e regras de acesso existentes. O avatar permanece visível quando recolhido.
- Evoluções visuais devem ser feitas nos componentes compartilhados, evitando cópias divergentes em módulos futuros.
- As opções do seletor Master devem conter somente empresas ativas com licença ativa e vigente (início e fim inclusivos, data de São Paulo) para o módulo aberto, também ativo. Reutilizar `getModuleLicensedEmpresas` / `listarEmpresasLicenciadas`; validar seleções por cookie ou URL no servidor e nunca carregar todos os registros quando nenhuma empresa for elegível.
- Menu de conta compartilhado: SidebarUserMenu nos módulos e HeaderUserMenu no portal, com Meu perfil em modal, Portal de módulos, Painel Vibe Tech somente Master e Sair. Reutilizar foto e dados do perfil; não duplicar menus por módulo.
- Financeiro do Vibe Gestão é exclusivo do Master (`bdl_admin`): páginas, menus, indicadores financeiros novos, ações e RLS. Administradores/Usuários não recebem acesso financeiro por terem `gestao.manage`; a integração automática do fechamento continua funcionando sem expor o financeiro. Consulte `docs/gestao-financeiro.md`.

- Botões de excluir/remover nas listas: usar `variant="destructive"` (com fundo vermelho) e `size="icon-sm"`. A exclusão deve ser sempre a última ação, na extrema direita do grupo de ações.

## Padrão de telas de listagem

- Referência: `/frotas/veiculos`. Reutilizar `ListPanelHeader` e `ListMetrics` / `ListMetric` para o título com ícone e os indicadores no canto direito do cartão. No Vibe Gestão, `Panel` e `MetricBadge` compõem esses mesmos componentes.
- Manter os indicadores no cartão da lista, sem duplicá-los na barra superior. Reservar a barra para busca, filtros e ações de cadastro.
- Tabelas de listas usam contorno `overflow-hidden rounded-lg border`, cabeçalho `bg-muted/50` e ações alinhadas à direita. Preservar informações operacionais, estados vazios, carregamento, filtros e permissões.

- Modais de formulário e confirmação do painel Vibe Tech devem oferecer `FormDialogCancel` no `DialogFooter`, antes da ação principal. Passar o estado pendente em `disabled`; cancelar apenas fecha o modal, sem enviar o formulário.
