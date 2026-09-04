const assert=require('node:assert/strict');
const hotfix=require('../auth-admin-hotfix-v11012.js');

assert.equal(hotfix.VERSION,'11.0.12');
assert.match(hotfix.friendlyAuthError({code:'invalid_credentials'}),/E-mail ou senha/);
assert.match(hotfix.friendlyAuthError({code:'email_not_confirmed'}),/não foi confirmado/);
assert.match(hotfix.friendlyAuthError({code:'over_email_send_rate_limit'}),/uma hora/);
assert.match(hotfix.friendlyAuthError({code:'unexpected_failure'},'register'),/tentativa duplicada/);
assert.match(hotfix.validateAdminPassword('abc123'),/8 caracteres/);
assert.match(hotfix.validateAdminPassword('abcdefgh'),/letra e um número/);
assert.equal(hotfix.validateAdminPassword('Senha123'),'');

console.log('auth-admin-hotfix-v11012: mensagens e política de senha testadas');
