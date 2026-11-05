const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require(name) {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  }, { filename: file });
  return exports;
}

async function main() {
  const veiculos = [
    { id: 'a', secretaria: null, combustivel: 'Diesel', status: 'active' },
    { id: 'b', secretaria: 'Saúde', combustivel: 'Gasolina', status: 'active' },
    { id: 'c', secretaria: 'Obras', combustivel: 'Diesel', status: 'inactive' },
  ];
  const abastecimentos = veiculos.map((v) => ({ veiculo_id: v.id, secretaria: v.secretaria, data_abastecimento: '2026-10-08', status: 'completed', valor_total: 100, arla_valor_total: 0 }));
  const manutencoes = veiculos.map((v) => ({ veiculo_id: v.id, data_entrada: '2026-10-08', status: 'completed', valor: 50 }));
  function data(params) {
    assert.equal(params.prefeituraId, 'empresa-a', 'Preserve company scope');
    return { veiculos, abastecimentos, manutencoes, vencimentos: [] };
  }
  const reports = load('src/lib/relatorios-data.ts', {
    '@/lib/frotas-data': { getFrotasData: data, getAbastecimentosData: data, getManutencoesData: data },
    '@/lib/supabase-server': {},
  });
  for (const tipo of ['vehicles', 'fuel', 'maintenance']) {
    const base = { tipo, prefeitura_id: 'empresa-a', filtros: {}, periodo_inicio: null, periodo_fim: null };
    const current = await reports.buildRelatorioDataSet(base);
    assert.equal(current.items.length, 3, `${tipo}: include vehicles without a department`);
    const legacy = await reports.buildRelatorioDataSet({ ...base, filtros: { secretaria: 'Saúde' } });
    assert.equal(legacy.items.length, 1, `${tipo}: preserve historical report scope`);
    assert.equal(legacy.items[0].id ?? legacy.items[0].veiculo_id, 'b');
  }

  let inserted;
  const actions = load('src/app/frotas/relatorios/actions.ts', {
    'next/cache': { revalidatePath() {} },
    'next/navigation': {},
    '@/lib/auth-data': { requireUserProfile: async () => ({ id: 'user', role: 'municipal_user', prefeitura_id: 'empresa-a' }) },
    '@/lib/frotas-permissions': { hasFrotasPermission: async () => true },
    '@/lib/relatorios-data': reports,
    '@/lib/secretarias-data': { getFrotasEmpresa: async (profile, empresaId) => empresaId === profile.prefeitura_id },
    '@/lib/supabase-server': { createSupabaseServerClient: () => ({ from: () => ({ insert(payload) { inserted = payload; return { select: () => ({ single: async () => ({ data: { id: 'report' }, error: null }) }) }; } }) }) },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ tipo: 'vehicles', titulo: 'Frota da empresa', secretaria: 'Saúde', prefeitura_id: 'outra-empresa' })) form.set(key, value);
  const result = await actions.createRelatorio({}, form);
  assert.equal(result.relatorioId, 'report');
  assert.equal(inserted.prefeitura_id, 'empresa-a');
  assert.equal(inserted.total_registros, 3);
  assert.equal(Object.hasOwn(inserted.filtros, 'secretaria'), false, 'Ignore legacy filter submitted by stale clients');
  console.log('PASS: reports without departments, legacy report filters, company scope and new report payload.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
