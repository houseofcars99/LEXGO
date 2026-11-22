/**
 * Resumable TUS uploader using the native Fetch API.
 * No app-imposed file size limit; Supabase's global file limit and account quota still apply.
 * Uses 6 MiB chunks as required by Supabase. A failed PATCH is recovered through TUS HEAD.
 * No overwriting existing files. The metadata record must exist in pending state first.
 *
 * This is an in-tab resumable upload: it retries interrupted requests while the tab is open.
 * Persisting uploads across browser restarts is not implemented.
 */
const CHUNK_SIZE = 6 * 1024 * 1024;
const MAX_ATTEMPTS = 6;
const RETRY_DELAYS = [0, 800, 2000, 4000, 7000, 12000];

function encodeMetadata(text) {
  const bytes = new TextEncoder().encode(String(text));
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw);
}

function explainError(response, body) {
  const suffix = body ? ' ' + String(body).slice(0, 500) : '';
  if (response.status === 413) {
    return new Error('Przekroczono globalny limit pojedynczego pliku w Supabase Storage. Zmień go w Storage → Settings (w granicach planu).' + suffix);
  }
  if (response.status === 401) return new Error('Sesja wygasła. Zaloguj się ponownie i spróbuj przesłać plik.');
  if (response.status === 403) return new Error('Brak uprawnień do przesłania pliku w tej sprawie.');
  return new Error('Storage HTTP ' + response.status + '.' + suffix);
}

async function token(db) {
  const { data, error } = await db.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) throw new Error('Zaloguj się ponownie, aby przesłać plik.');
  return data.session.access_token;
}

function storageEndpoint(url) {
  const parsed = new URL(url);
  if (parsed.hostname.endsWith('.supabase.co') && !parsed.hostname.endsWith('.storage.supabase.co')) {
    parsed.hostname = parsed.hostname.replace(/\.supabase\.co$/, '.storage.supabase.co');
  }
  return new URL('/storage/v1/upload/resumable', parsed.origin).toString();
}

async function requestWithToken(db, url, options) {
  const access = await token(db);
  return fetch(url, {
    ...options,
    headers: {
      'Tus-Resumable': '1.0.0',
      Authorization: 'Bearer ' + access,
      ...options?.headers
    }
  });
}

async function getOffset(db, url) {
  const response = await requestWithToken(db, url, { method:'HEAD' });
  if (!response.ok) throw explainError(response, await response.text().catch(() => ''));
  const offset = Number(response.headers.get('Upload-Offset'));
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Nieprawidłowa pozycja przesyłania TUS.');
  return offset;
}

async function wait(ms) {
  if (ms > 0) await new Promise(resolve => setTimeout(resolve, ms));
}

async function createUpload(db, endpoint, bucket, objectName, file, mimeType) {
  const attributes = {
    bucketName: bucket,
    objectName,
    contentType: mimeType,
    cacheControl: '0'
  };
  const metadata = Object.entries(attributes).map(([key,value]) => key + ' ' + encodeMetadata(value)).join(',');
  const response = await requestWithToken(db, endpoint, {
    method:'POST',
    headers:{
      'Upload-Length': String(file.size),
      'Upload-Metadata': metadata,
      'x-upsert':'false'
    }
  });
  if (!response.ok) throw explainError(response, await response.text().catch(() => ''));
  const location = response.headers.get('Location');
  if (!location) throw new Error('Serwer Storage nie zwrócił adresu przesyłania TUS.');
  return new URL(location, endpoint).toString();
}

export async function uploadResumableFile({
  db, supabaseUrl, bucket, objectName, file, mimeType, onProgress = () => {}
}) {
  if (!file?.size) throw new Error('Pusty plik nie może zostać przesłany.');
  const endpoint = storageEndpoint(supabaseUrl);
  const uploadUrl = await createUpload(db, endpoint, bucket, objectName, file, mimeType);
  let offset = 0;
  let attempts = 0;
  onProgress(0);
  while (offset < file.size) {
    const nextEnd = Math.min(offset + CHUNK_SIZE, file.size);
    const bytes = file.slice(offset, nextEnd);
    try {
      const response = await requestWithToken(db, uploadUrl, {
        method:'PATCH',
        headers:{
          'Content-Type':'application/offset+octet-stream',
          'Upload-Offset':String(offset)
        },
        body:bytes
      });
      if (!response.ok) throw explainError(response, await response.text().catch(() => ''));
      const reported = response.headers.get('Upload-Offset');
      const newOffset = reported == null ? nextEnd : Number(reported);
      if (!Number.isSafeInteger(newOffset) || newOffset <= offset || newOffset > file.size) {
        throw new Error('Serwer przesłał nieprawidłową pozycję pliku.');
      }
      offset = newOffset;
      attempts = 0;
      onProgress(Math.round(offset/file.size*100));
    } catch (error) {
      if (String(error.message).includes('globalny limit') ||
          String(error.message).includes('Brak uprawnień') ||
          String(error.message).includes('Sesja wygasła')) throw error;
      attempts++;
      if (attempts >= MAX_ATTEMPTS) throw new Error('Przesyłanie zostało przerwane po kilku próbach. ' + (error.message||''));
      await wait(RETRY_DELAYS[attempts] || 12000);
      try {
        offset = await getOffset(db, uploadUrl);
        if (offset > file.size) throw new Error('Niespójny stan przesyłania.');
        onProgress(Math.round(offset/file.size*100));
      } catch (headError) {
        if (attempts >= MAX_ATTEMPTS-1) throw headError;
      }
    }
  }
  onProgress(100);
}
