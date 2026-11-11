import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { agentsListOptions, systemHealthOptions } from '../../api/@tanstack/react-query.gen';

// Health of gateway and services, the API contract, and connected agents.
export function SystemStatus({ contractOk, showAgents }: { contractOk: boolean | undefined; showAgents: boolean }) {
  const { t, i18n } = useTranslation();
  const health = useQuery({ ...systemHealthOptions(), refetchInterval: 5000 });
  // ponytail: polling every 2 s; agent lists get live updates once there is a panel event stream
  const agents = useQuery({ ...agentsListOptions(), refetchInterval: 2000, enabled: showAgents });

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <Card title={t('services.gateway')}>
          <Status
            ok={health.data?.status === 'ok'}
            label={health.isError ? t('status.unreachable') : health.data ? t(`status.${health.data.status}`) : t('status.loading')}
          />
        </Card>
        {Object.entries(health.data?.services ?? {}).map(([name, state]) => (
          <Card key={name} title={t('services.service', { name })}>
            <Status ok={state === 'up'} label={t(`status.${state}`)} />
          </Card>
        ))}
        <Card title={t('contract.title')}>
          <Status
            ok={contractOk === true}
            label={contractOk === undefined ? t('status.loading') : contractOk ? t('contract.matches') : t('contract.mismatch')}
          />
        </Card>
      </section>

      {showAgents && (
      <section className="rounded-xl bg-surface-raised p-4">
        <h2 className="mb-3 font-medium">{t('agents.title', { count: agents.data?.length ?? 0 })}</h2>
        {agents.data?.length ? (
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-400">
              <tr>
                <th className="py-1 font-normal">{t('agents.name')}</th>
                <th className="font-normal">{t('agents.host')}</th>
                <th className="font-normal">{t('agents.system')}</th>
                <th className="font-normal">{t('agents.agent')}</th>
                <th className="font-normal">{t('agents.protocol')}</th>
                <th className="font-normal">{t('agents.connectedSince')}</th>
              </tr>
            </thead>
            <tbody>
              {agents.data.map((a) => (
                <tr key={a.id} className="border-t border-white/5">
                  <td className="py-2 font-medium">{a.name}</td>
                  <td>{a.hostname}</td>
                  <td>
                    {a.os}/{a.arch}
                  </td>
                  <td>v{a.agentVersion}</td>
                  <td>{a.protocol}</td>
                  <td>{new Date(a.connectedAt).toLocaleTimeString(i18n.resolvedLanguage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-zinc-400">
            <Trans i18nKey="agents.empty" components={{ code: <code className="text-zinc-200" /> }} />
          </p>
        )}
      </section>
      )}
    </>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-raised p-4">
      <h2 className="mb-2 text-sm text-zinc-400">{title}</h2>
      {children}
    </div>
  );
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="flex items-center gap-2 font-medium">
      <span aria-hidden className={`size-2.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
      {label}
    </span>
  );
}
