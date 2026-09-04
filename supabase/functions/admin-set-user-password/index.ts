import { createClient } from 'npm:@supabase/supabase-js@2.115.0';
import { processPasswordChange } from './logic.mjs';

const ALLOWED_ORIGINS = new Set(['https://korluz.github.io']);

function responseHeaders(origin = '') {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://korluz.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin'
  };
}

function json(status, body, origin = '') {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) });
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin') || '';
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json(403, { ok: false, error: 'Origem não autorizada.' }, origin);
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders(origin) });
  }
  if (request.method !== 'POST') {
    return json(405, { ok: false, error: 'Método não permitido.' }, origin);
  }

  const authorization = request.headers.get('Authorization') || '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, { ok: false, error: 'Configuração segura indisponível.' }, origin);
  }

  try {
    const body = await request.json();
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const result = await processPasswordChange({ authorization, body }, {
      async getCaller() {
        const { data, error } = await callerClient.auth.getUser();
        if (error) return null;
        return data.user;
      },
      async getProfile(userId) {
        const { data, error } = await adminClient
          .from('profiles')
          .select('id,full_name,role,active,status')
          .eq('id', userId)
          .maybeSingle();
        if (error) throw error;
        return data;
      },
      async updatePassword(userId, password) {
        const { data, error } = await adminClient.auth.admin.updateUserById(userId, { password });
        if (error) throw error;
        return data.user;
      },
      async audit({ actorUserId, targetUserId }) {
        console.info('admin_password_changed', { actor_user_id: actorUserId, target_user_id: targetUserId });
      }
    });

    return json(result.status, result.body, origin);
  } catch (error) {
    console.error('admin_set_user_password_failed', {
      name: error?.name || 'Error',
      code: error?.code || null
    });
    return json(500, { ok: false, error: 'Não foi possível alterar a senha agora.' }, origin);
  }
});
