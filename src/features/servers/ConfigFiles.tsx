import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { serversReadFileOptions, serversReadFileQueryKey, serversWriteFileMutation } from '../../api/@tanstack/react-query.gen';
import type { TemplateFileDto } from '../../api/types.gen';
import { localize } from '../../lib/localize';

/** The config files a template lists (ADR 0011), each as plain text in its own collapsible block. */
export function ConfigFiles({ serverId, files, running }: { serverId: string; files: TemplateFileDto[]; running: boolean }) {
  return files.map((file) => <ConfigFile key={file.path} serverId={serverId} file={file} running={running} />);
}

function ConfigFile({ serverId, file, running }: { serverId: string; file: TemplateFileDto; running: boolean }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <details className="rounded-xl bg-surface-raised p-4" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer font-medium">
        {t('files.title')}: <code className="font-mono text-sm">{file.path}</code>
      </summary>
      {file.description && <p className="mt-3 text-sm text-zinc-400">{localize(file.description, i18n.resolvedLanguage)}</p>}
      {/* Loaded only when opened, so the server page does not ask the agent on every visit. */}
      {open && <Editor serverId={serverId} path={file.path} running={running} />}
    </details>
  );
}

function Editor({ serverId, path, running }: { serverId: string; path: string; running: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const options = { path: { id: serverId }, query: { path } };
  const file = useQuery({ ...serversReadFileOptions(options), staleTime: Infinity });
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const save = useMutation({
    ...serversWriteFileMutation(),
    onSuccess: (updated) => {
      queryClient.setQueryData(serversReadFileQueryKey(options), updated);
      setDraft(null);
    },
  });

  if (file.isPending) return <p className="mt-3 text-sm text-zinc-400">{t('files.loading')}</p>;
  if (file.isError) {
    return (
      <p role="alert" className="mt-3 text-sm text-red-300">
        {(file.error as { detail?: string }).detail ?? t('files.loadFailed')}
      </p>
    );
  }

  const text = draft ?? file.data.content ?? '';
  const submit = (e: FormEvent) => {
    e.preventDefault();
    // The hint depends on whether the server ran when saving, not on what it does later.
    const hint = running ? t('detail.settingsSavedRestart') : t('detail.settingsSaved');
    save.mutate({ path: { id: serverId }, body: { path, content: text } }, { onSuccess: () => setSaved(hint) });
  };
  const error = save.error as { detail?: string } | null;

  return (
    <form onSubmit={submit} className="mt-3 space-y-3">
      {file.data.content === null && <p className="text-sm text-zinc-400">{t('files.missing')}</p>}
      <textarea
        value={text}
        onChange={(e) => {
          setDraft(e.target.value);
          setSaved(null);
          save.reset();
        }}
        spellCheck={false}
        aria-label={path}
        rows={Math.min(30, Math.max(8, text.split('\n').length + 1))}
        className="w-full rounded-md bg-surface p-3 font-mono text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-accent"
      />
      <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
        {error && <p role="alert" className="text-red-300">{error.detail ?? t('files.saveFailed')}</p>}
        {saved && <p role="status" className="text-zinc-400">{saved}</p>}
        {draft !== null && (
          <button type="button" onClick={() => setDraft(null)} className="rounded-lg px-3 py-1.5 text-zinc-300 hover:bg-white/5">
            {t('files.discard')}
          </button>
        )}
        <button type="submit" disabled={save.isPending || draft === null} className="rounded-lg bg-accent px-3 py-1.5 font-medium text-zinc-900 disabled:opacity-50">
          {t('detail.save')}
        </button>
      </div>
    </form>
  );
}
