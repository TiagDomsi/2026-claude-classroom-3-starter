import { rm } from "node:fs/promises";

/**
 * Teardown for the suites that migrate a throwaway SQLite file: on Windows
 * libSQL keeps the handle open past `$client.close()`, so the unlink raises
 * EBUSY and fails the whole suite even though every test passed. The directory
 * is the OS's own temp dir, which it reclaims on its own, so a failed removal
 * is not worth a red run.
 */
export async function removeTempDir(dir: string) {
  await rm(dir, { recursive: true, force: true }).catch(() => {});
}
