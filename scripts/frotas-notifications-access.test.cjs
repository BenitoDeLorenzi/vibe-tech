const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, dependencies) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => dependencies[name], URL, Response, Number });
  return exports;
}
async function scope(role, requested, allowed = true) {
  const lib = load('src/lib/frotas-notificacoes.ts', {
    'server-only': {},
    '@/lib/auth-data': { getCurrentUserProfile: async () => role ? { id: 'user', role, prefeitura_id: 'own', primeiro_acesso_concluido_em: '2026-01-01' } : null },
    '@/lib/frotas-permissions': { getFrotasPermissionAccess: async () => typeof allowed === 'object' ? allowed : ({ canViewAbastecimento: allowed }) },
    '@/lib/empresa-access': { hasModuleAccess: async () => allowed !== false, getModuleLicensedEmpresas: async () => [{ id: 'own' }, { id: 'other' }] },
  });
  return lib.getNotificationScope(requested);
}
(async () => {
  assert.equal(await scope(null, 'own'), null);
  assert.equal(await scope('municipal_admin', 'other'), null);
  assert.equal(await scope('municipal_user', 'own', false), null);
  assert.equal(await scope('bdl_admin', 'unlicensed'), null);
  assert.equal((await scope('bdl_admin', 'other')).empresaId, 'other');
  assert.equal((await scope('municipal_admin', null)).empresaId, 'own');
  assert.equal((await scope('municipal_user', 'own', {canViewManutencao:true})).tipos.join(','), 'manutencao');
  assert.equal((await scope('municipal_user', 'own', {canViewUsoVeiculo:true})).tipos.join(','), 'uso_veiculo');
  assert.equal((await scope('municipal_user', 'own', {})).tipos.join(','), '');
  let written, companyFilter, typeFilter, rpcArgs, recipientFilter;
  const query = { select: () => query, or: filter => {recipientFilter=filter; return query;}, eq: (_, value) => { companyFilter = value; return query; }, in: (key, values) => { if (key === 'tipo') { typeFilter = values; return query; } return Promise.resolve({ data: [{ id: 1 }], error: null }); } };
  const route = load('src/app/frotas/notificacoes/feed/route.ts', {
    '@/lib/frotas-notificacoes': { getNotificationScope: async () => ({ usuarioId: 'session-user', empresaId: 'own', tipos:['manutencao'] }) },
    '@/lib/supabase-server': { createSupabaseServerClient: () => ({ rpc: async (_, args) => {rpcArgs=args; return {data:{items:[]}};}, from: name => name === 'frota_notificacoes' ? query : {
      upsert: async rows => { written = rows; return { error: null }; },
    } }) },
  });
  const request = (origin, ids) => new Request('http://localhost/frotas/notificacoes/feed?empresa=own', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, usuario_id: 'attacker' }) });
  assert.equal((await route.POST(request('https://external.example', [1]))).status, 403);
  assert.equal((await route.POST(request('http://localhost', ['invalid']))).status, 400);
  assert.equal((await route.POST(request('http://localhost', [1, 999]))).status, 200);
  assert.equal(companyFilter, 'own');
  assert.equal(recipientFilter, 'destinatario_id.is.null,destinatario_id.eq.session-user');
  assert.equal(typeFilter.join(','), 'manutencao');
  assert.equal((await route.GET(new Request('http://localhost/frotas/notificacoes/feed?empresa=own&tipo=abastecimento'))).status, 200);
  assert.equal(rpcArgs.p_tipos.join(','), 'manutencao');
  assert.equal(written.length, 1);
  assert.equal(written[0].usuario_id, 'session-user');
  assert.equal(written[0].notificacao_id, 1);
  console.log('PASS: authentication, permissions, licensed company isolation, CSRF and server-owned read receipts.');
})().catch(error => { console.error(error); process.exitCode = 1; });
