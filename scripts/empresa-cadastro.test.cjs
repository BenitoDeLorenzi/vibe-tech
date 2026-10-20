const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const sharp = require('sharp');
const crypto = require('node:crypto');

function setup(options = {}) {
  const events = [];
  let payload;
  const storage = {
    createBucket: async () => ({ error: { message: 'Bucket already exists' } }),
    from: () => ({
      upload: async (path) => { events.push(['upload', path]); return { error: options.uploadError ? { message: 'upload failed' } : null }; },
      remove: async (paths) => { events.push(['remove', ...paths]); return { error: null }; },
      getPublicUrl: (path) => ({ data: { publicUrl: `https://example.test/${path}` } }),
    }),
  };
  const db = {
    storage,
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { brasao_path: options.oldPath ?? 'empresa/old.webp' }, error: null }) }) }),
      insert: async (values) => { payload = values; events.push(['insert']); return { error: options.writeError ? { message: 'duplicate key' } : null }; },
      update: (values) => {
        payload = values;
        const query = {
          eq: () => query, is: () => query,
          select: async () => {
            events.push(['update']);
            return { data: options.conflict ? [] : [{ id: 'empresa' }], error: options.writeError ? { message: 'write failed' } : null };
          },
        };
        return query;
      },
    }),
  };
  const dependencies = {
    'node:crypto': crypto, sharp: { default: sharp },
    '@/lib/auth-data': { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ['bdl_admin']); if (options.unauthorized) throw new Error('forbidden'); } },
    '@/lib/supabase-server': { createSupabaseServerClient: () => db },
    'next/cache': { revalidatePath() {} }, 'next/navigation': { redirect() {} },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/app/empresas/actions.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => {
    assert.ok(name in dependencies, name); return dependencies[name];
  }, File, FormData, Buffer });
  return { actions: exports, events, payload: () => payload };
}

function form(flag = 'true') {
  const data = new FormData();
  for (const [key, value] of Object.entries({ id: 'empresa', nome: 'Empresa de teste', cnpj: '12345678000190', is_prefeitura: flag })) data.set(key, value);
  return data;
}

async function main() {
  const image = new File([await sharp({ create: { width: 8, height: 8, channels: 4, background: '#123456' } }).png().toBuffer()], 'logo.png', { type: 'image/png' });
  for (const flag of ['true', 'false']) {
    const ctx = setup();
    assert.ok((await ctx.actions.createPrefeitura({}, form(flag))).success);
    assert.equal(ctx.payload().is_prefeitura, flag === 'true');
    assert.ok((await ctx.actions.updatePrefeitura({}, form(flag))).success);
    assert.equal(ctx.payload().is_prefeitura, flag === 'true');
    assert.equal(ctx.payload().brasao_path, undefined, 'ordinary edit preserves avatar');
    assert.equal(ctx.events.filter(([type]) => type === 'remove').length, 0);
  }
  {
    const ctx = setup();
    assert.ok((await ctx.actions.createPrefeitura({}, form('invalid'))).error);
    assert.equal(ctx.events.length, 0);
  }
  {
    const ctx = setup(); const data = form(); data.set('brasao', new File(['invalid'], 'image.png', { type: 'image/png' }));
    assert.ok((await ctx.actions.createPrefeitura({}, data)).error);
    assert.equal(ctx.events.length, 0, 'invalid image must not create a partial company');
  }
  for (const options of [{}, { uploadError: true }, { writeError: true }, { conflict: true }]) {
    const ctx = setup(options); const data = form(); data.set('brasao', image);
    const result = await ctx.actions.updatePrefeitura({}, data);
    const deletes = ctx.events.filter(([type]) => type === 'remove').flatMap((event) => event.slice(1));
    if (Object.keys(options).length) {
      assert.ok(result.error);
      assert.ok(!deletes.includes('empresa/old.webp'), 'failed save must keep old avatar');
      if (!options.uploadError) assert.ok(deletes.includes(ctx.events[0][1]), 'clean new upload on failed update');
    } else {
      assert.ok(result.success);
      assert.deepEqual(ctx.events.map(([type]) => type), ['upload', 'update', 'remove']);
      assert.ok(deletes.includes('empresa/old.webp'));
    }
  }
  {
    const ctx = setup({ writeError: true }); const data = form(); data.set('brasao', image);
    assert.ok((await ctx.actions.createPrefeitura({}, data)).error);
    assert.deepEqual(ctx.events.map(([type]) => type), ['upload', 'insert', 'remove']);
  }
  for (const oldPath of ['empresa/old.webp', 'another-company/logo.webp']) {
    const ctx = setup({ oldPath }); const data = form(); data.set('remove_brasao', 'true'); data.set('current_brasao_path', 'victim/logo.webp');
    assert.ok((await ctx.actions.updatePrefeitura({}, data)).success);
    assert.equal(ctx.payload().brasao_path, null);
    assert.equal(ctx.payload().brasao_url, null);
    assert.equal(ctx.events.filter(([type]) => type === 'remove').length, oldPath.startsWith('empresa/') ? 1 : 0);
  }
  {
    const ctx = setup({ unauthorized: true });
    await assert.rejects(ctx.actions.createPrefeitura({}, form()), /forbidden/);
    await assert.rejects(ctx.actions.updatePrefeitura({}, form()), /forbidden/);
    assert.equal(ctx.events.length, 0);
  }
  console.log('Company flag, avatar persistence, failure cleanup and authorization: OK');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
