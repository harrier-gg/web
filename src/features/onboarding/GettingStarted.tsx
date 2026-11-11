import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { nodesListOptions, serversListOptions, usersListOptions } from '../../api/@tanstack/react-query.gen';

const HIDDEN_KEY = 'harrier.gettingStarted.hidden';

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

interface Props {
  onNodes: () => void;
  onCreateServer: () => void;
  onUsers: () => void;
}

/**
 * First steps after the setup, for owners and admins: add a node, start its agent, create a
 * server, invite friends. Every step is detected from real data; the list disappears when done.
 */
export function GettingStarted({ onNodes, onCreateServer, onUsers }: Props) {
  const { t } = useTranslation();
  const nodes = useQuery({ ...nodesListOptions(), refetchInterval: 3000 });
  const servers = useQuery(serversListOptions());
  const users = useQuery(usersListOptions());
  const [hidden, setHidden] = useState(readHidden);

  if (!nodes.data || !servers.data || !users.data) return null;

  const steps = [
    { key: 'node', done: nodes.data.length > 0, action: onNodes },
    { key: 'agent', done: nodes.data.some((n) => n.online), action: onNodes },
    { key: 'server', done: servers.data.length > 0, action: onCreateServer },
    { key: 'friends', done: users.data.length > 1, action: onUsers },
  ] as const;
  const remaining = steps.filter((s) => !s.done).length;
  if (hidden || remaining === 0) return null;

  const hide = () => {
    try {
      localStorage.setItem(HIDDEN_KEY, '1');
    } catch {
      // private mode: hide for this visit only
    }
    setHidden(true);
  };

  return (
    <section className="space-y-3 rounded-xl border border-accent/30 bg-surface-raised p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium">{t('start.title', { done: steps.length - remaining, total: steps.length })}</h2>
        <button type="button" onClick={hide} className="text-xs text-zinc-400 hover:text-zinc-200">
          {t('start.hide')}
        </button>
      </div>
      <ol className="space-y-2">
        {steps.map((step, i) => {
          // A step is actionable once the steps before it are done.
          const next = !step.done && steps.slice(0, i).every((s) => s.done);
          return (
            <li key={step.key} className="flex items-center justify-between gap-3 text-sm">
              <span className={`flex items-center gap-2 ${step.done ? 'text-zinc-500 line-through' : ''}`}>
                <span aria-hidden className={`grid size-5 place-items-center rounded-full text-xs ${step.done ? 'bg-emerald-500 text-zinc-900' : 'bg-white/10'}`}>
                  {step.done ? '✓' : i + 1}
                </span>
                {t(`start.${step.key}`)}
              </span>
              {next && (
                <button type="button" onClick={step.action} className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-zinc-900">
                  {t(`start.${step.key}Action`)}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
