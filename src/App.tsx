import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { agentsListOptions, systemHealthOptions, systemMetaOptions } from './api/@tanstack/react-query.gen';

declare const __API_CONTRACT__: string;

// M0: Statusseite. Zeigt, ob Gateway, Services und Agents erreichbar sind und ob Web und Backend zusammenpassen.
export function App() {
  const health = useQuery({ ...systemHealthOptions(), refetchInterval: 5000 });
  const meta = useQuery(systemMetaOptions());
  // ponytail: Polling alle 2 s; ab M1 kommen Agent-Updates live per WebSocket
  const agents = useQuery({ ...agentsListOptions(), refetchInterval: 2000 });

  const contractOk = meta.data ? meta.data.contract === __API_CONTRACT__ : undefined;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">
          <span className="text-accent">Harrier</span> Panel
        </h1>
        <span className="text-sm text-zinc-400">Backend v{meta.data?.version ?? '?'}</span>
      </header>

      {contractOk === false && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-200">
          Dieses Frontend passt nicht zur Backend-Version (Contract {__API_CONTRACT__} ≠ {meta.data?.contract}).
          Bitte Panel aktualisieren.
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <Card title="Gateway">
          <Status ok={health.isSuccess} label={health.isError ? 'nicht erreichbar' : (health.data?.status ?? '…')} />
        </Card>
        {Object.entries(health.data?.services ?? {}).map(([name, state]) => (
          <Card key={name} title={`Service: ${name}`}>
            <Status ok={state === 'up'} label={state} />
          </Card>
        ))}
        <Card title="API-Vertrag">
          <Status ok={contractOk === true} label={contractOk === undefined ? '…' : contractOk ? 'passt' : 'passt nicht'} />
        </Card>
      </section>

      <section className="rounded-xl bg-surface-raised p-4">
        <h2 className="mb-3 font-medium">Verbundene Agents ({agents.data?.length ?? 0})</h2>
        {agents.data?.length ? (
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-400">
              <tr>
                <th className="py-1 font-normal">Host</th>
                <th className="font-normal">System</th>
                <th className="font-normal">Agent</th>
                <th className="font-normal">Protokoll</th>
                <th className="font-normal">Verbunden seit</th>
              </tr>
            </thead>
            <tbody>
              {agents.data.map((a) => (
                <tr key={a.id} className="border-t border-white/5">
                  <td className="py-2">{a.hostname}</td>
                  <td>
                    {a.os}/{a.arch}
                  </td>
                  <td>v{a.agentVersion}</td>
                  <td>{a.protocol}</td>
                  <td>{new Date(a.connectedAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-zinc-400">
            Noch kein Agent verbunden. Im Agent-Repo <code className="text-zinc-200">just dev</code> ausführen.
          </p>
        )}
      </section>
    </main>
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
