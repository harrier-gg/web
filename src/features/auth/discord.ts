// Discord login (ADR 0008). The browser leaves the panel for Discord and comes back to "/",
// with `?auth_error=<code>` or `?auth=discord_linked` telling what happened.

export function discordUrl(mode: 'login' | 'link' | 'invite', inviteToken?: string): string {
  const params = new URLSearchParams({ mode });
  if (inviteToken) params.set('token', inviteToken);
  return `/api/v1/auth/discord/start?${params}`;
}

export type AuthNotice = { kind: 'error'; code: string } | { kind: 'linked' } | null;

/** Read once at startup and removed from the address bar, so a reload does not show it again. */
export const authNotice: AuthNotice = (() => {
  const params = new URLSearchParams(location.search);
  const error = params.get('auth_error');
  const linked = params.get('auth') === 'discord_linked';
  if (!error && !linked) return null;
  params.delete('auth_error');
  params.delete('auth');
  history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : ''));
  return error ? { kind: 'error', code: error } : { kind: 'linked' };
})();

const KNOWN_ERRORS = ['state', 'not_linked', 'taken', 'invite', 'email', 'failed'] as const;
type DiscordError = (typeof KNOWN_ERRORS)[number];
/** i18n key for an error code from the Discord round trip; unknown codes show the generic error. */
export const discordErrorKey = (code: string) => {
  const known = (KNOWN_ERRORS as readonly string[]).includes(code) ? (code as DiscordError) : 'failed';
  return `discord.errors.${known}` as const;
};
