alter table public.empresas
  add column if not exists endereco_numero text,
  add column if not exists bairro text,
  add column if not exists endereco_complemento text,
  add column if not exists email_cobranca text,
  add column if not exists telefone_cobranca text;

comment on column public.empresas.endereco is 'Logradouro do pagador; cadastros antigos podem conter o endereço completo.';
comment on column public.empresas.email_cobranca is 'E-mail de contato do pagador para cobranças; não é identidade de login.';
