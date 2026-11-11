import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { authLoginMutation, authMeOptions, authSetupMutation, authSetupStatusOptions } from '../../api/@tanstack/react-query.gen';
import type { UserDto } from '../../api/types.gen';

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
export function AuthGate({ children }: { children: (user: UserDto) => ReactNode }) {
  // No refetch on window focus: refetching an errored query without data puts it back to
  // "pending", which would unmount the login form (and the user's input) on every click.
  // Expired sessions are still noticed: any query answering 401 re-checks the session (main.tsx).
  const me = useQuery({ ...authMeOptions(), retry: false, refetchOnWindowFocus: false });
  const setup = useQuery({ ...authSetupStatusOptions(), enabled: me.isError, refetchOnWindowFocus: false });

  if (me.data) return children(me.data);
  if (me.isPending || (me.isError && setup.isPending)) return null;
  return setup.data?.needsSetup ? <SetupForm /> : <LoginForm />;
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

function useSignedIn() {
  const queryClient = useQueryClient();
  return () => {
    // Drop the setup token from the address bar and load everything as the new user.
    if (location.pathname === '/setup') history.replaceState(null, '', '/');
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

  return (
    <Card title={t('auth.login')}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('auth.email')} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label={t('auth.password')} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button type="submit" disabled={login.isPending} className="w-full rounded-lg bg-accent py-2 font-medium text-zinc-900 disabled:opacity-50">
          {t('auth.loginButton')}
        </button>
      </form>
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
