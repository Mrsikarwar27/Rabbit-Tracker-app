import { Platform } from 'react-native';
import type { AppData } from './types';
import { todayKey } from './date';

/**
 * Export all app data as a pretty-printed JSON document.
 *
 * • Native: writes the file inside the app's own documents directory
 *   (no storage permission needed) and opens the system share sheet with
 *   expo-sharing so the user can save it anywhere.
 * • Web: triggers a normal browser download (glass-off bypass — Blob API is
 *   only used on web where there is no file system).
 * • Everything is best-effort and returns a result instead of throwing.
 */

type FileSystemModule = typeof import('expo-file-system');
type SharingModule = typeof import('expo-sharing');

export interface ExportResult {
  status: 'shared' | 'downloaded' | 'unavailable' | 'error';
  message?: string;
}

function buildExportPayload(data: AppData): string {
  return JSON.stringify(
    {
      app: 'habit-tracker',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      ...data,
    },
    null,
    2,
  );
}

function requireNative<T>(name: string): T | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(name) as T;
  } catch {
    return null;
  }
}

export async function exportDataAsJson(data: AppData): Promise<ExportResult> {
  const payload = buildExportPayload(data);
  const filename = `habit-tracker-export-${todayKey()}.json`;

  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return { status: 'downloaded' };
    } catch (err) {
      return { status: 'error', message: String(err) };
    }
  }

  const fs = requireNative<FileSystemModule>('expo-file-system');
  const sharing = requireNative<SharingModule>('expo-sharing');
  if (!fs || !sharing) {
    return { status: 'unavailable', message: 'Export modules unavailable on this platform.' };
  }
  try {
    const { File, Paths } = fs;
    const file = new File(Paths.documents, filename);
    if (!file.exists) file.create({ overwrite: false });
    file.write(payload);
    const available = await sharing.isAvailableAsync();
    if (!available) {
      return { status: 'unavailable', message: file.uri };
    }
    await sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Export habit data',
    });
    return { status: 'shared' };
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
}
