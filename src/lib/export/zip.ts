import { ZipArchive } from "archiver";

// Builds a small ZIP in memory. Used for deck PNG sets. Week ZIPs stream instead (see week.ts).
export function zipBuffer(entries: { name: string; data: Buffer }[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
    for (const entry of entries) archive.append(entry.data, { name: entry.name });
    void archive.finalize();
  });
}
