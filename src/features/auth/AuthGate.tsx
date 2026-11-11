import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  authAcceptInviteMutation,
  authCheckInviteOptions,
  authLoginMutation,
  authMeOptions,
  authSetupMutation,
  authSetupStatusOptions,
  discordProvidersOptions,
} from '../../api/@tanstack/react-query.gen';
import { authNotice, discordErrorKey, discordUrl } from './discord';
import type { MeDto } from '../../api/types.gen';

/** The API answers in English (ADR 0003); auth errors are translated by their HTTP status. */
function useAuthError(error: unknown): string | null {
  const { t } = useTranslation();
  if (!error) return null;
  const status = (error as { status?: number }).status;
  const known: Record<number, string> = {
    400: t('auth.errors.invalid'),
    401: t('auth.errors.wrongCredentials'),
    403: t('auth.errors.setupLink'),
    409: t('auth.errors.alreadySetUp'),
    429: t('auth.errors.tooMany'),
  };
  return (status && known[status]) || t('auth.failed');
}

const input = 'w-full rounded-md bg-surface px-3 py-2 text-zinc-100 outline-none focus:ring-2 focus:ring-accent';

/** Shows setup or login until there is a session, then renders the app for the user (ADR 0006). */
export function AuthGate({ children }: { children: (user: MeDto) => ReactNode }) {
  // No refetch on window focus: refetching an errored query without data puts it back to
  // "pending", which would unmount the login form (and the user's input) on every click.
  // Expired sessions are still noticed: any query answering 401 re-checks the session (main.tsx).
  const me = useQuery({ ...authMeOptions(), retry: false, refetchOnWindowFocus: false });
  const setup = useQuery({ ...authSetupStatusOptions(), enabled: me.isError, refetchOnWindowFocus: false });

  if (me.data) return children(me.data);
  if (me.isPending || (me.isError && setup.isPending)) return null;
  if (setup.data?.needsSetup) return <SetupForm />;
  return location.pathname === '/invite' ? <InviteForm /> : <LoginForm />;
}

function Card({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="mx-auto mt-16 max-w-sm space-y-4 rounded-xl bg-surface-raised p-6">
      <h1 className="text-xl font-semibold">
        <span className="text-accent">Harrier</span> · {title}
      </h1>
      {hint && <p className="text-sm text-zinc-400">{hint}</p>}
      {children}
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-zinc-400">{label}</span>
      <input {...props} className={input} />
    </label>
  );
}

/** "Log in with Discord" when the panel has it configured (ADR 0008). */
function DiscordButton({ href, label }: { href: string; label: string }) {
  const providers = useQuery({ ...discordProvidersOptions(), refetchOnWindowFocus: false });
  if (!providers.data?.discord) return null;
  return (
    <>
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span className="h-px flex-1 bg-white/10" />
        <span>/</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <a href={href} className="block w-full rounded-lg bg-[#5865F2] py-2 text-center font-medium text-white hover:bg-[#4752c4]">
        {label}
      </a>
    </>
  );
}

function useSignedIn() {
  const queryClient = useQueryClient();
  return () => {
    // Drop the setup token from the address bar and load everything as the new user.
    if (location.pathname === '/setup' || location.pathname === '/invite') history.replaceState(null, '', '/');
    void queryClient.invalidateQueries();
  };
}

function LoginForm() {
  const { t } = useTranslation();
  const signedIn = useSignedIn();
  const login = useMutation({ ...authLoginMutation(), onSuccess: signedIn });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const error = useAuthError(login.error);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ body: { email, password } });
  };

  const notice = authNotice?.kind === 'error' ? t(discordErrorKey(authNotice.code)) : null;

  return (
    <Card title={t('auth.login')}>
      {notice && !login.error && <p role="alert" className="rounded-md bg-red-500/10 p-2 text-sm text-red-200">{notice}</p>}
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('auth.email')} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label={t('auth.password')} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button type="submit" disabled={login.isPending} className="w-full rounded-lg bg-accent py-2 font-medium text-zinc-900 disabled:opacity-50">
          {t('auth.loginButton')}
        </button>
      </form>
      <DiscordButton href={discordUrl('login')} label={t('discord.login')} />
    </Card>
  );
}

function SetupForm() {
  const { t } = useTranslation();
  const signedIn = useSignedIn();
  const setup = useMutation({ ...authSetupMutation(), onSuccess: signedIn });
  const token = new URLSearchParams(location.search).get('token') ?? '';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const error = useAuthError(setup.error);

  if (!token) return <Card title={t('auth.setupTitle')} hint={t('auth.setupNeedsLink')} />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setup.mutate({ body: { token, name, email, password } });
  };

  return (
    <Card title={t('auth.setupTitle')} hint={t('auth.setupHint')}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('auth.name')} autoComplete="name" required maxLength={64} value={name} onChange={(e) => setName(e.target.value)} />
        <Field label={t('auth.email')} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label={t('auth.newPassword')} type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button type="submit" disabled={setup.isPending} className="w-full rounded-lg bg-accent py-2 font-medium text-zinc-900 disabled:opacity-50">
          {t('auth.setupButton')}
        </button>
      </form>
    </Card>
  );
}

/** Joining via an invitation link (ADR 0007): name, e-mail and password, then straight into the panel. */
function InviteForm() {
  const { t } = useTranslation();
  const signedIn = useSignedIn();
  const token = new URLSearchParams(location.search).get('token') ?? '';
  const invite = useQuery({ ...authCheckInviteOptions({ query: { token } }), enabled: !!token, retry: false, refetchOnWindowFocus: false });
  const accept = useMutation({ ...authAcceptInviteMutation(), onSuccess: signedIn });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const status = (accept.error as { status?: number } | null)?.status;
  const error = accept.error ? (status === 409 ? t('invite.emailTaken') : status === 404 ? t('invite.invalid') : t('auth.errors.invalid')) : null;

  if (!token || invite.isError) {
    return (
      <Card title={t('invite.title')} hint={t('invite.invalid')}>
        <button type="button" onClick={() => location.assign('/')} className="text-sm text-accent">
          {t('invite.toLogin')}
        </button>
      </Card>
    );
  }
  if (!invite.data) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    accept.mutate({ body: { token, name, email, password } });
  };

  return (
    <Card title={t('invite.title')} hint={t('invite.hint', { role: t(`roles.${invite.data.role}`) })}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('auth.name')} autoComplete="name" required maxLength={64} value={name} onChange={(e) => setName(e.target.value)} />
        <Field label={t('auth.email')} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label={t('auth.newPassword')} type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button type="submit" disabled={accept.isPending} className="w-full rounded-lg bg-accent py-2 font-medium text-zinc-900 disabled:opacity-50">
          {t('invite.join')}
        </button>
      </form>
      <DiscordButton href={discordUrl('invite', token)} label={t('discord.join')} />
    </Card>
  );
}
