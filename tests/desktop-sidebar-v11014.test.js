'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'desktop-sidebar-v11014.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

assert.match(html,/desktop-sidebar-v11014\.css\?v=11014/,'o hotfix precisa ser carregado pela aplicação');
assert.match(css,/@media\s*\(min-width:\s*761px\)/,'a correção deve ficar restrita ao desktop');
assert.match(css,/\.side\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*overflow:\s*hidden/s,'a barra lateral deve organizar menu e rodapé em coluna');
assert.match(css,/\.side\s+\.menu\s*\{[^}]*flex:\s*1\s+1\s+auto[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/s,'o menu deve rolar quando faltar altura');
assert.match(css,/\.sidefoot\s*\{[^}]*position:\s*static[^}]*flex:\s*0\s+0\s+auto/s,'o rodapé não pode continuar sobreposto ao menu');
assert.match(css,/@media\s*\(min-width:\s*761px\)\s*and\s*\(max-height:\s*820px\)/,'notebooks baixos devem receber espaçamento compacto');
assert.doesNotMatch(css,/@media[^\{]*max-width\s*:\s*760px/,'o hotfix não deve alterar o layout mobile');

console.log('desktop-sidebar-v11014: isolamento mobile e prevenção de sobreposição verificados');
