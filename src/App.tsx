import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authLogoutMutation, systemMetaOptions } from './api/@tanstack/react-query.gen';
import { AuthGate } from './features/auth/AuthGate';
import { ServerDetail } from './features/servers/ServerDetail';
import { ServerList } from './features/servers/ServerList';
import { SystemStatus } from './features/system/SystemStatus';
import { LANGUAGES } from './i18n';

declare const __API_CONTRACT__: string;

export function App() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const meta = useQuery(systemMetaOptions());
  const logout = useMutation({ ...authLogoutMutation(), onSuccess: () => queryClient.clear() });
  // ponytail: one level of navigation; a router comes with more pages (M2: login, users)
  const [serverId, setServerId] = useState<string | null>(null);

  const contractOk = meta.data ? meta.data.contract === __API_CONTRACT__ : undefined;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          <button type="button" onClick={() => setServerId(null)}>
            <span className="text-accent">Harrier</span> {t('app.panel')}
          </button>
        </h1>
        <div className="flex items-baseline gap-4 text-sm text-zinc-400">
          <span>{t('app.backendVersion', { version: meta.data?.version ?? '?' })}</span>
          <label className="flex items-center gap-2">
            <span className="sr-only">{t('app.language')}</span>
            <select
              value={i18n.resolvedLanguage}
              onChange={(e) => void i18n.changeLanguage(e.target.value)}
              className="rounded-md bg-surface-raised px-2 py-1 text-zinc-100"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {contractOk === false && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-200">
          {t('contract.mismatchAlert', { expected: __API_CONTRACT__, actual: meta.data?.contract })}
        </p>
      )}

      <AuthGate>
        {(user) => (
          <>
            <div className="flex items-center justify-end gap-3 text-sm text-zinc-400">
              <span>{t('auth.signedInAs', { name: user.name })}</span>
              <button type="button" onClick={() => logout.mutate({})} className="rounded-md px-2 py-1 hover:bg-white/5 hover:text-zinc-200">
                {t('auth.logout')}
              </button>
            </div>
            {serverId ? (
              <ServerDetail id={serverId} onBack={() => setServerId(null)} />
            ) : (
              <>
                <ServerList onOpen={setServerId} />
                <SystemStatus contractOk={contractOk} />
              </>
            )}
          </>
        )}
      </AuthGate>
    </main>
  );
}
