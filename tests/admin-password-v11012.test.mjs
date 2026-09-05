import assert from 'node:assert/strict';
import { processPasswordChange, validatePassword } from '../supabase/functions/admin-set-user-password/logic.mjs';

const ADMIN_ID='11111111-1111-4111-8111-111111111111';
const SELLER_ID='22222222-2222-4222-8222-222222222222';

function dependencies({callerId=ADMIN_ID,callerRole='admin',callerActive=true,callerStatus='active',targetExists=true,targetIsOwner=false}={}){
  const calls=[];
  return{
    calls,
    api:{
      getCaller:async()=>callerId?{id:callerId}:null,
      getProfile:async id=>{
        if(id===callerId)return{id,role:callerRole,active:callerActive,status:callerStatus,full_name:'Administrador'};
        return targetExists?{id,role:'seller',active:true,status:'active',is_owner:targetIsOwner,full_name:'Vendedora'}:null;
      },
      updatePassword:async(id,password)=>{calls.push({id,password});return{email_confirmed_at:'2026-09-04T00:00:00Z'}},
      audit:async event=>calls.push({audit:event})
    }
  };
}

assert.match(validatePassword('abc123'),/8 caracteres/);
assert.match(validatePassword('abcdefgh'),/letra e um número/);
assert.match(validatePassword(`Senha1${'x'.repeat(67)}`),/72 caracteres/);
assert.equal(validatePassword('Senha123'),'');

{
  const deps=dependencies();
  const result=await processPasswordChange({authorization:'',body:{}},deps.api);
  assert.equal(result.status,401);
  assert.equal(deps.calls.length,0);
}

{
  const deps=dependencies({callerRole:'seller'});
  const result=await processPasswordChange({authorization:'Bearer token',body:{target_user_id:SELLER_ID,password:'Senha123'}},deps.api);
  assert.equal(result.status,403);
  assert.equal(deps.calls.length,0);
}

{
  const deps=dependencies({callerActive:false,callerStatus:'blocked'});
  const result=await processPasswordChange({authorization:'Bearer token',body:{target_user_id:SELLER_ID,password:'Senha123'}},deps.api);
  assert.equal(result.status,403);
  assert.equal(deps.calls.length,0);
}

{
  const deps=dependencies();
  const result=await processPasswordChange({authorization:'Bearer token',body:{target_user_id:'invalido',password:'Senha123'}},deps.api);
  assert.equal(result.status,400);
}

{
  const deps=dependencies();
  const result=await processPasswordChange({authorization:'Bearer token',body:{target_user_id:ADMIN_ID,password:'Senha123'}},deps.api);
  assert.equal(result.status,400);
  assert.equal(deps.calls.length,0);
}

{
  const deps=dependencies({targetExists:false});
  const result=await processPasswordChange({authorization:'Bearer token',body:{target_user_id:SELLER_ID,password:'Senha123'}},deps.api);
  assert.equal(result.status,404);
}

{
  const deps=dependencies({targetIsOwner:true});
  const result=await processPasswordChange({authorization:'Bearer token',body:{target_user_id:SELLER_ID,password:'Senha123'}},deps.api);
  assert.equal(result.status,403);
  assert.match(result.body.error,/administrador proprietário/);
  assert.equal(deps.calls.length,0);
}

{
  const deps=dependencies();
  const password='NovaSenha2026';
  const result=await processPasswordChange({authorization:'Bearer token',body:{target_user_id:SELLER_ID,password}},deps.api);
  assert.equal(result.status,200);
  assert.equal(result.body.ok,true);
  assert.equal(result.body.email_confirmed,true);
  assert.deepEqual(deps.calls[0],{id:SELLER_ID,password});
  assert.equal(JSON.stringify(result).includes(password),false);
  assert.equal(deps.calls[1].audit.targetUserId,SELLER_ID);
}

console.log('admin-password-v11012: autorização e troca de senha testadas');
