-- Read-only regression checks; run after the pagination migrations.
begin transaction read only;
do $$
declare
  company uuid; kind text; first_page jsonb; second_page jsonb; last_page jsonb;
begin
  select prefeitura_id into company from public.frota_veiculos limit 1;
  if company is null then raise exception 'A fleet company is required for these checks'; end if;
  foreach kind in array array['veiculos','uso-veiculo','manutencao','abastecimento','secretarias','oficinas','postos','motoristas','relatorios'] loop
    first_page := public.frota_lista_pagina(kind,company,'','','','',1,1);
    second_page := public.frota_lista_pagina(kind,company,'','','','',2,1);
    last_page := public.frota_lista_pagina(kind,company,'','','','',2147483647,1);
    assert first_page->>'total'=second_page->>'total', 'Totals must not depend on the page';
    assert first_page->>'pageCount'=second_page->>'pageCount', 'Page numbers must stay stable';
    assert jsonb_array_length(first_page->'ids')<=1, 'The database must return only the requested page';
    assert last_page->>'page'=last_page->>'pageCount', 'Out-of-range pages must clamp';
    if (first_page->>'total')::integer>1 then
      assert first_page->'ids'->>0<>second_page->'ids'->>0, 'Adjacent pages must not duplicate records';
    end if;
    first_page := public.frota_lista_pagina(kind,company,'__no_matching_record_9d327c__','','','',999,10);
    assert first_page->>'total'='0' and first_page->>'page'='1', 'Empty searches must return the first empty page';
    first_page := public.frota_lista_pagina(kind,'00000000-0000-0000-0000-000000000000','','','','',1,10);
    assert first_page->>'total'='0', 'Company isolation must hold';
  end loop;
  assert not has_function_privilege('anon','public.frota_lista_pagina(text,uuid,text,text,text,text,integer,integer)','execute');
  assert not has_function_privilege('authenticated','public.frota_lista_pagina(text,uuid,text,text,text,text,integer,integer)','execute');
end $$;
rollback;
