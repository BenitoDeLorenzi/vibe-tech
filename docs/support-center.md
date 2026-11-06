# Central de Ajuda e Atendimentos

- Vibe Frotas: `/frotas/ajuda`, na Administração. Cada usuário acompanha somente seus chamados da empresa selecionada/licenciada.
- Vibe Tech: `/atendimentos`, exclusivamente Master, com acesso aos chamados de todas as empresas.
- A primeira mensagem abre o chamado com seu próprio chat. Resposta do usuário deixa **Aguardando atendimento**; resposta do suporte deixa **Em atendimento**. O Master pode iniciar, resolver e reabrir; o solicitante pode reabrir um chamado resolvido.
- Mensagens aceitam até 5.000 caracteres e até três imagens JPG/PNG/WebP, com 3 MB de limite total por envio. O servidor valida, redimensiona e converte as imagens para WebP, removendo metadados. Os arquivos são privados e sua leitura verifica novamente a sessão e o acesso ao chamado.
- O contador do Master considera mensagens de outros autores não lidas por aquele Master. A leitura só avança quando o chat está visível e posicionado nas mensagens mais recentes; é individual por usuário e nunca retrocede.
- Respostas e resoluções aparecem na própria Central de Ajuda; atendimentos não entram na lista nem no contador de Notificações do Vibe Frotas.
- A tabela pagina 25 chamados; o chat carrega 50 mensagens recentes com acesso às anteriores. Pesquisa por assunto, empresa/usuário (Master) e status.
- A origem é o caminho da tela de onde o usuário entrou na ajuda pelo sidebar, sem parâmetros de URL.
- Ao excluir um usuário, o histórico fica preservado para o Master com os nomes registrados nas mensagens e na abertura do chamado; outro usuário não pode assumir esse chamado.

## Segurança e consistência

As tabelas `suporte_conversas`, `suporte_mensagens` e `suporte_leituras` têm RLS e acesso somente pelo servidor. As APIs validam sessão, licença do módulo, empresa e propriedade do chamado; `mode=master` só funciona com perfil `bdl_admin`. RPCs também verificam autor/propriedade/papel. Escritas exigem mesma origem.

Criação e resposta usam uma RPC transacional com bloqueio do chamado, chave de idempotência e registro atômico da notificação. Envios concorrentes com resolução são serializados. Em erro de gravação, os uploads feitos pelo envio são removidos.

O Realtime observa alterações nas conversas e leituras via SSE do servidor. O navegador recebe apenas invalidação, sem mensagens nem credenciais do Supabase. A conexão é renovada a cada 50 segundos para revalidar o acesso, com atualização ao reconectar e retornar à aba.

## Verificação

- `node scripts/support-access.test.cjs`
- `node scripts/support-realtime.test.cjs`
- `scripts/support-center.test.sql`: integração transacional com rollback, sem manter chamados de teste.
- Testes existentes de acesso/realtime das notificações e build Next.js.

## Experiência de chamados

A Central de Ajuda apresenta Meus chamados e a ação Abrir chamado. A abertura solicita assunto e mensagem inicial, com imagens opcionais, e leva diretamente ao chat exclusivo do chamado. O cabeçalho mantém assunto, solicitante, empresa, data de abertura e status; as mensagens e anexos ficam no chat em tempo real. No Vibe Tech, Atendimentos centraliza os chamados e suas respostas. A nomenclatura interna das tabelas e os links existentes permanecem compatíveis. A integração com IA é futura e não está habilitada.
