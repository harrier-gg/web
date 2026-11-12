import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { serversListQueryKey, serversRemoveMutation } from '../../api/@tanstack/react-query.gen';
import type { ServerDto } from '../../api/types.gen';

/** Deletes a stopped server with its world and backups. Typing the name confirms it. */
export function DeleteServer({ server, stopped, onDeleted }: { server: ServerDto; stopped: boolean; onDeleted: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const remove = useMutation({
    ...serversRemoveMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serversListQueryKey() });
      onDeleted();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    remove.mutate({ path: { id: server.id } });
  };
  const error = remove.error as { detail?: string } | null;

  return (
    <details className="rounded-xl bg-surface-raised p-4">
      <summary className="cursor-pointer font-medium text-red-300">{t('delete.title')}</summary>
      <form onSubmit={submit} className="mt-3 space-y-3 text-sm">
        <p className="text-zinc-400">{t('delete.warning')}</p>
        {stopped ? (
          <label className="block space-y-1">
            <span className="text-zinc-400">{t('delete.confirm', { name: server.name })}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              className="w-full rounded-md bg-surface px-3 py-2 text-zinc-100 outline-none focus:ring-2 focus:ring-red-400"
            />
          </label>
        ) : (
          <p className="text-amber-200">{t('delete.stopFirst')}</p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {error && <p className="text-red-300">{error.detail ?? t('delete.failed')}</p>}
          <button
            type="submit"
            disabled={!stopped || name !== server.name || remove.isPending}
            className="rounded-lg bg-red-500 px-3 py-1.5 font-medium text-white disabled:opacity-40"
          >
            {remove.isPending ? t('delete.deleting') : t('delete.button')}
          </button>
        </div>
      </form>
    </details>
  );
}
