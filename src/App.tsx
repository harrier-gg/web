import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { authLogoutMutation, discordProvidersOptions, systemMetaOptions } from './api/@tanstack/react-query.gen';
import { AuthGate } from './features/auth/AuthGate';
import { authNotice, discordErrorKey, discordUrl } from './features/auth/discord';
import { ServerDetail } from './features/servers/ServerDetail';
import { ServerList } from './features/servers/ServerList';
import { SystemStatus } from './features/system/SystemStatus';
import { UsersPage } from './features/users/UsersPage';
import { NodesPage } from './features/nodes/NodesPage';
import { IntegrationsPage } from './features/settings/IntegrationsPage';
import { LANGUAGES } from './i18n';

declare const __API_CONTRACT__: string;

export function App() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const meta = useQuery(systemMetaOptions());
  const logout = useMutation({ ...authLogoutMutation(), onSuccess: () => queryClient.clear() });
  const providers = useQuery({ ...discordProvidersOptions(), refetchOnWindowFocus: false });
  const [notice, setNotice] = useState(authNotice);
  // ponytail: one level of navigation; a router comes with more pages (M2: login, users)
  const [serverId, setServerId] = useState<string | null>(null);
  const [page, setPage] = useState<'servers' | 'nodes' | 'users' | 'integrations'>('servers');

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
            <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex gap-1">
                <Tab active={page === 'servers'} onClick={() => { setPage('servers'); setServerId(null); }}>{t('nav.servers')}</Tab>
                {user.permissions.includes('manageServers') && (
                  <Tab active={page === 'nodes'} onClick={() => setPage('nodes')}>{t('nav.nodes')}</Tab>
                )}
                {user.permissions.includes('manageMembers') && (
                  <Tab active={page === 'users'} onClick={() => setPage('users')}>{t('nav.users')}</Tab>
                )}
                {user.permissions.includes('manageInstance') && (
                  <Tab active={page === 'integrations'} onClick={() => setPage('integrations')}>{t('nav.integrations')}</Tab>
                )}
              </div>
              <div className="flex items-center gap-3 text-zinc-400">
                <span>{t('auth.signedInAs', { name: user.name })} · {t(`roles.${user.role}`)}</span>
                {user.discord ? (
                  <span title={t('discord.linkedAs', { name: user.discord })}>Discord ✓</span>
                ) : (
                  providers.data?.discord && (
                    <a href={discordUrl('link')} className="rounded-md px-2 py-1 hover:bg-white/5 hover:text-zinc-200">
                      {t('discord.link')}
                    </a>
                  )
                )}
                <button type="button" onClick={() => logout.mutate({})} className="rounded-md px-2 py-1 hover:bg-white/5 hover:text-zinc-200">
                  {t('auth.logout')}
                </button>
              </div>
            </nav>
            {notice && (
              <p
                role={notice.kind === 'error' ? 'alert' : 'status'}
                className={`flex justify-between gap-3 rounded-lg p-3 text-sm ${notice.kind === 'error' ? 'bg-red-500/10 text-red-200' : 'bg-emerald-500/10 text-emerald-200'}`}
              >
                {notice.kind === 'error' ? t(discordErrorKey(notice.code)) : t('discord.linked')}
                <button type="button" onClick={() => setNotice(null)} aria-label={t('discord.dismiss')}>×</button>
              </p>
            )}
            {page === 'integrations' ? (
              <IntegrationsPage />
            ) : page === 'users' ? (
              <UsersPage me={user} />
            ) : page === 'nodes' ? (
              <NodesPage />
            ) : serverId ? (
              <ServerDetail id={serverId} me={user} onBack={() => setServerId(null)} />
            ) : (
              <>
                <ServerList me={user} onOpen={setServerId} onNavigate={setPage} />
                <SystemStatus contractOk={contractOk} showAgents={user.permissions.includes('manageServers')} />
              </>
            )}
          </>
        )}
      </AuthGate>
    </main>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-md px-3 py-1.5 ${active ? 'bg-surface-raised text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}>
      {children}
    </button>
  );
}
