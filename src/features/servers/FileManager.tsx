import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { filesListOptions, filesListQueryKey, filesMkdirMutation, filesMoveMutation, filesRemoveMutation } from '../../api/@tanstack/react-query.gen';
import type { FileEntryDto } from '../../api/types.gen';
import { Editor } from './ConfigFiles';

/** Text files up to this size open in the editor (the agent reads at most 128 KiB, ADR 0011). */
const EDITABLE_BYTES = 128 * 1024;

const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name);

export function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/** Uploads one file with progress; the body goes as raw bytes, so the gateway can stream it. */
function upload(serverId: string, path: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `/api/v1/servers/${serverId}/files/upload?path=${encodeURIComponent(path)}`);
    // Never the file's own type: the gateway would parse a .json upload as a JSON body.
    xhr.setRequestHeader('content-type', 'application/octet-stream');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status < 300) return resolve();
      try {
        reject(new Error((JSON.parse(xhr.responseText) as { detail?: string }).detail ?? xhr.statusText));
      } catch {
        reject(new Error(xhr.statusText));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(file);
  });
}

/** Files of one server (ADR 0015): browse, upload, download, rename, delete, edit small text files. */
export function FileManager({ serverId, running }: { serverId: string; running: boolean }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <details className="rounded-xl bg-surface-raised p-4" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer font-medium">{t('files.manager')}</summary>
      {/* Loaded only when opened, like the config files. */}
      {open && <Browser serverId={serverId} running={running} lang={i18n.resolvedLanguage} />}
    </details>
  );
}

function Browser({ serverId, running, lang }: { serverId: string; running: boolean; lang: string | undefined }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dir, setDir] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const options = { path: { id: serverId }, query: { path: dir } };
  const list = useQuery(filesListOptions(options));
  const refresh = () => void queryClient.invalidateQueries({ queryKey: filesListQueryKey(options) });
  const failed = (e: unknown) => setError((e as { detail?: string; message?: string }).detail ?? (e as Error).message ?? t('files.failed'));
  const done = { onSuccess: refresh, onError: failed };
  const remove = useMutation({ ...filesRemoveMutation(), ...done });
  const mkdir = useMutation({ ...filesMkdirMutation(), ...done });
  const move = useMutation({ ...filesMoveMutation(), ...done });

  const go = (path: string) => {
    setDir(path);
    setEditing(null);
    setError(null);
  };

  const uploadFiles = async (files: FileList) => {
    setError(null);
    for (const file of Array.from(files)) {
      const name = file.name;
      setUploads((u) => ({ ...u, [name]: '0 %' }));
      try {
        await upload(serverId, join(dir, name), file, (percent) => setUploads((u) => ({ ...u, [name]: `${percent} %` })));
        setUploads((u) => {
          const rest = { ...u };
          delete rest[name];
          return rest;
        });
      } catch (e) {
        setUploads((u) => ({ ...u, [name]: (e as Error).message }));
      }
      refresh();
    }
  };

  const crumbs = dir ? dir.split('/') : [];
  const date = (seconds: number | null) =>
    seconds === null ? '' : new Date(seconds * 1000).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' });
  const action = 'rounded-md px-2 py-1 text-xs text-zinc-300 hover:bg-white/10';
  // Symbols keep the name readable on phones; the label is the tooltip and what screen readers say.
  const icon = 'inline-block w-7 rounded-md py-1 text-center text-zinc-300 hover:bg-white/10';

  return (
    <div className="mt-4 space-y-3 text-sm">
      {running && <p className="text-zinc-400">{t('files.runningHint')}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t('files.manager')} className="flex flex-wrap items-center gap-1 font-mono">
          <button type="button" onClick={() => go('')} className="hover:underline">
            {t('files.root')}
          </button>
          {crumbs.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-zinc-500">/</span>
              <button type="button" onClick={() => go(crumbs.slice(0, i + 1).join('/'))} className="hover:underline">
                {part}
              </button>
            </span>
          ))}
        </nav>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const name = window.prompt(t('files.newFolderPrompt'));
              if (name) mkdir.mutate({ path: { id: serverId }, body: { path: join(dir, name) } });
            }}
            className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/15"
          >
            {t('files.newFolder')}
          </button>
          <button type="button" onClick={() => picker.current?.click()} className="rounded-lg bg-accent px-3 py-1.5 font-medium text-zinc-900">
            {t('files.upload')}
          </button>
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) void uploadFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {Object.entries(uploads).map(([name, state]) => (
        <p key={name} className="text-zinc-400">
          ⬆ {name}: {state}
        </p>
      ))}
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}

      {list.isPending ? (
        <p className="text-zinc-400">{t('files.loading')}</p>
      ) : list.isError ? (
        <p role="alert" className="text-red-300">
          {(list.error as { detail?: string }).detail ?? t('files.loadFailed')}
        </p>
      ) : list.data.length === 0 ? (
        <p className="text-zinc-400">{t('files.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="text-left text-xs text-zinc-500">
              <tr>
                <th className="py-1 font-normal">{t('files.name')}</th>
                <th className="py-1 text-right font-normal">{t('files.size')}</th>
                <th className="hidden py-1 pl-4 font-normal sm:table-cell">{t('files.modified')}</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {list.data.map((entry: FileEntryDto) => {
                const path = join(dir, entry.name);
                const editable = entry.kind === 'file' && entry.size <= EDITABLE_BYTES;
                return (
                  <tr key={entry.name}>
                    <td className="w-full max-w-0 truncate py-1.5 pr-2 font-mono">
                      {entry.kind === 'dir' ? (
                        <button type="button" onClick={() => go(path)} className="hover:underline">
                          📁 {entry.name}
                        </button>
                      ) : editable ? (
                        <button type="button" onClick={() => setEditing(path)} className="hover:underline">
                          📄 {entry.name}
                        </button>
                      ) : (
                        <span>
                          {entry.kind === 'file' ? '📄' : '🔗'} {entry.name}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-right whitespace-nowrap text-zinc-400">{entry.kind === 'file' ? size(entry.size) : ''}</td>
                    <td className="hidden py-1.5 pl-4 whitespace-nowrap text-zinc-400 sm:table-cell">{date(entry.modified)}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      {entry.kind === 'file' && (
                        <a
                          href={`/api/v1/servers/${serverId}/files/download?path=${encodeURIComponent(path)}`}
                          download={entry.name}
                          title={t('files.download')}
                          aria-label={`${t('files.download')}: ${entry.name}`}
                          className={icon}
                        >
                          ⬇
                        </a>
                      )}
                      <button
                        type="button"
                        title={t('files.rename')}
                        aria-label={`${t('files.rename')}: ${entry.name}`}
                        className={icon}
                        onClick={() => {
                          const name = window.prompt(t('files.renamePrompt'), entry.name);
                          if (name && name !== entry.name) move.mutate({ path: { id: serverId }, body: { from: path, to: join(dir, name) } });
                        }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        title={t('files.delete')}
                        aria-label={`${t('files.delete')}: ${entry.name}`}
                        className={`${icon} text-red-300`}
                        onClick={() => {
                          if (window.confirm(t('files.deleteConfirm', { name: entry.name }))) remove.mutate({ path: { id: serverId }, query: { path } });
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="rounded-lg border border-white/10 p-3">
          <div className="flex items-center justify-between">
            <code className="font-mono">{editing}</code>
            <button type="button" onClick={() => setEditing(null)} className={action}>
              {t('files.close')}
            </button>
          </div>
          <Editor key={editing} serverId={serverId} path={editing} running={running} />
        </div>
      )}
    </div>
  );
}
