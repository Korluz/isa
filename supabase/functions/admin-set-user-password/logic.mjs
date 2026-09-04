export const PASSWORD_MIN_LENGTH = 8;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) {
    return 'A senha deve conter pelo menos uma letra e um número.';
  }
  if (password.length > 72) {
    return 'A senha deve ter no máximo 72 caracteres.';
  }
  return '';
}

export function validateRequest(body) {
  const targetUserId = String(body?.target_user_id || '').trim();
  const password = body?.password;
  if (!UUID_PATTERN.test(targetUserId)) {
    return { error: 'Conta de destino inválida.' };
  }
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };
  return { targetUserId, password };
}

export async function processPasswordChange({ authorization, body }, dependencies) {
  if (!/^Bearer\s+\S+$/i.test(String(authorization || ''))) {
    return { status: 401, body: { ok: false, error: 'Sessão não autenticada.' } };
  }

  const caller = await dependencies.getCaller();
  if (!caller?.id) {
    return { status: 401, body: { ok: false, error: 'Sessão inválida ou expirada.' } };
  }

  const callerProfile = await dependencies.getProfile(caller.id);
  const callerIsAdmin = callerProfile?.role === 'admin'
    && callerProfile?.active === true
    && callerProfile?.status === 'active';
  if (!callerIsAdmin) {
    return { status: 403, body: { ok: false, error: 'Ação permitida apenas para administrador ativo.' } };
  }

  const validated = validateRequest(body);
  if (validated.error) {
    return { status: 400, body: { ok: false, error: validated.error } };
  }
  if (validated.targetUserId === caller.id) {
    return { status: 400, body: { ok: false, error: 'Use o fluxo da própria conta para alterar sua senha.' } };
  }

  const targetProfile = await dependencies.getProfile(validated.targetUserId);
  if (!targetProfile?.id) {
    return { status: 404, body: { ok: false, error: 'Conta de destino não encontrada.' } };
  }

  const updatedUser = await dependencies.updatePassword(validated.targetUserId, validated.password);
  await dependencies.audit?.({ actorUserId: caller.id, targetUserId: validated.targetUserId });

  return {
    status: 200,
    body: {
      ok: true,
      target_user_id: validated.targetUserId,
      target_name: targetProfile.full_name || 'Usuário',
      email_confirmed: Boolean(updatedUser?.email_confirmed_at)
    }
  };
}
