import "server-only";

// Where round screenshots would be kept: Vercel Blob, switched on simply by
// setting BLOB_READ_WRITE_TOKEN (its value is never logged or sent to the
// browser). Until then storage is off: screenshots are only used in the
// browser to line up and trace the route, nothing about the image is kept
// but its size and a hash of the file, and they show as not stored. Files
// are private (create the store as private): they are only ever served
// through the CRM's own routes, or a client's report link, never by their
// Blob URL. Tests pass in a stand-in client instead of the real one.

export type StoredFile = { url: string; pathname: string; contentType: string; bytes: number };
export type FileStream = { stream: ReadableStream<Uint8Array>; contentType: string; bytes: number | null };

export type BlobClient = {
  put(pathname: string, body: Blob | Buffer, options: { access: "private"; contentType: string; token: string; addRandomSuffix: boolean }): Promise<{ url: string; pathname: string }>;
  get(url: string, options: { access: "private"; token: string }): Promise<{ stream: ReadableStream<Uint8Array>; contentType?: string; size?: number | null } | null>;
  del(url: string, options: { token: string }): Promise<void>;
};

export type ScreenshotStorage =
  | { enabled: false }
  | {
      enabled: true;
      put(pathname: string, body: Buffer, contentType: string): Promise<StoredFile>;
      get(url: string): Promise<FileStream | null>;
      del(url: string): Promise<void>;
    };

export const STORAGE_ACCESS = "private" as const;
export const ALLOWED_TYPES = ["image/webp", "image/jpeg"] as const;
export const MAX_FILE_BYTES = 3 * 1024 * 1024;

// The real client, loaded only when storage is on.
async function vercelBlob(): Promise<BlobClient> {
  const blob = await import("@vercel/blob");
  return {
    put: (pathname, body, options) => blob.put(pathname, body, options),
    async get(url, options) {
      const result = await blob.get(url, { access: options.access, token: options.token });
      if (!result || result.statusCode !== 200) return null;
      return { stream: result.stream, contentType: result.blob.contentType, size: result.blob.size };
    },
    del: (url, options) => blob.del(url, options),
  };
}

export function screenshotStorage(env: Record<string, string | undefined> = process.env, client?: BlobClient): ScreenshotStorage {
  const token = env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return { enabled: false };
  const real = client ? Promise.resolve(client) : vercelBlob();
  return {
    enabled: true,
    async put(pathname, body, contentType) {
      const c = await real;
      const stored = await c.put(pathname, body, { access: STORAGE_ACCESS, contentType, token, addRandomSuffix: true });
      return { url: stored.url, pathname: stored.pathname, contentType, bytes: body.length };
    },
    async get(url) {
      const c = await real;
      const found = await c.get(url, { access: STORAGE_ACCESS, token });
      return found ? { stream: found.stream, contentType: found.contentType ?? "application/octet-stream", bytes: found.size ?? null } : null;
    },
    async del(url) {
      const c = await real;
      await c.del(url, { token });
    },
  };
}

export function storageEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return !!env.BLOB_READ_WRITE_TOKEN?.trim();
}
