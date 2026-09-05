'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.resolve(__dirname,'../supabase/functions/admin-set-user-password/index.ts'),'utf8');

const getProfile=source.match(/async getProfile\(userId\)\s*\{([\s\S]*?)\n\s*\},\n\s*async updatePassword/);
assert.ok(getProfile,'a Edge Function precisa declarar getProfile');
assert.match(getProfile[1],/callerClient\s*\n?\s*\.from\('profiles'\)/,'perfis devem respeitar a sessão do administrador e a RLS');
assert.doesNotMatch(getProfile[1],/authAdminClient/,'a chave de serviço não deve consultar profiles');
assert.match(getProfile[1],/is_owner/,'a Edge Function precisa identificar a conta proprietária');
assert.match(source,/authAdminClient\.auth\.admin\.updateUserById\(userId, \{ password \}\)/,'a chave de serviço deve ficar restrita à operação administrativa do Auth');
assert.match(source,/callerClient\.auth\.getUser\(token\)/,'o usuário chamador deve ser validado pelo JWT recebido');

console.log('admin-password-edge-v11015: RLS preservada e chave de serviço restrita ao Auth');
