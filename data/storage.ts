import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Object storage behind one small interface.
 *
 * The application talks to this, not to R2 directly, so the access rules and
 * the streaming path can be proven without a network round trip and real
 * credentials. R2 is the implementation, not the contract.
 */
export interface ObjectStore {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** A stream, not a buffer: a large document should not sit in memory to be served. */
  get(key: string): Promise<ReadableStream<Uint8Array> | null>;
  delete(key: string): Promise<void>;
}

export class R2Store implements ObjectStore {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
  ) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<ReadableStream<Uint8Array> | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return (result.Body as { transformToWebStream?: () => ReadableStream<Uint8Array> })
        ?.transformToWebStream?.() ?? null;
    } catch (error) {
      /*
       * Only a genuinely missing object is "not found". Swallowing everything
       * here would tell someone their document had vanished when the real
       * cause was an outage, a rotated credential, or the wrong bucket - and
       * would hide the one signal that storage is unreachable.
       */
      const cause = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (cause.name === "NoSuchKey" || cause.$metadata?.httpStatusCode === 404) return null;
      console.error("R2 read failed", { key, error });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

/** Used by the tests, and by a developer with no credentials yet. */
export class MemoryStore implements ObjectStore {
  readonly objects = new Map<string, { body: Uint8Array; contentType: string }>();

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
  }

  async get(key: string): Promise<ReadableStream<Uint8Array> | null> {
    const object = this.objects.get(key);
    if (!object) return null;
    return new ReadableStream({
      start(controller) {
        controller.enqueue(object.body);
        controller.close();
      },
    });
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

let store: ObjectStore | null = null;

export function objectStore(): ObjectStore {
  if (store) return store;

  const { R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (R2_BUCKET && R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
    store = new R2Store(R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY);
  } else if (process.env.NODE_ENV === "production" && process.env.ALLOW_MEMORY_FILES !== "true") {
    /*
     * Degrading quietly here would keep tenant identity documents in RAM and
     * lose them on the next restart, while every upload still returned 201.
     * Refuse to start that way.
     */
    throw new Error(
      "R2 is not configured. Set R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY. " +
        "To run `next start` locally without R2, set ALLOW_MEMORY_FILES=true and accept that uploaded " +
        "files live in memory and are lost on restart.",
    );
  } else {
    /*
     * No credentials configured. Files are kept in memory so the app runs and
     * every access rule still applies; they do not survive a restart.
     */
    console.warn("R2 is not configured. Uploaded files are kept in memory and will not survive a restart.");
    store = new MemoryStore();
  }
  return store;
}

/** Test seam. */
export function useObjectStore(replacement: ObjectStore | null): void {
  store = replacement;
}
