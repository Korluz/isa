'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sql=fs.readFileSync(path.join(root,'supabase/sql/v11016_owner_admin_protection.sql'),'utf8');
const version=JSON.parse(fs.readFileSync(path.join(root,'VERSION.json'),'utf8'));

assert.match(html,/select\('id,email,full_name,phone_original,team,role,status,active,is_owner,created_at,updated_at'\)/);
assert.match(html,/Administrador proprietário/);
assert.match(html,/member\.is_owner/);
assert.match(sql,/add column if not exists is_owner boolean not null default false/);
assert.match(sql,/create unique index if not exists profiles_single_owner_idx/);
assert.match(sql,/before update of role, active, status, is_owner/);
assert.match(sql,/before delete on public\.profiles/);
assert.match(sql,/A conta do administrador proprietário não pode ser resetada/);
assert.match(sql,/A conta do administrador proprietário não pode ser excluída/);
assert.match(version.version,/^11\.1\./);
assert.ok(version.version==='11.1.1'||version.basedOn==='11.1.1','versões posteriores devem preservar a proteção proprietária da V11.1.1');

console.log('owner-admin-v11016: banco, painel e versão protegidos');
