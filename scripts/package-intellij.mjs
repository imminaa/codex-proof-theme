import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const resourcesRoot = resolve(repoRoot, "intellij", "src", "main", "resources");
const workspaceManifest = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
const outputPath = resolve(
  repoRoot,
  "dist",
  `codex-theme-pack-intellij-${workspaceManifest.version}.zip`
);

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function dosTimestamp(date) {
  const year = Math.max(1980, date.getUTCFullYear());
  const time =
    (date.getUTCHours() << 11) |
    (date.getUTCMinutes() << 5) |
    Math.floor(date.getUTCSeconds() / 2);
  const day =
    ((year - 1980) << 9) |
    ((date.getUTCMonth() + 1) << 5) |
    date.getUTCDate();
  return { day, time };
}

function createZip(entries) {
  if (entries.length > 0xffff) {
    throw new Error("ZIP64 is not supported: too many entries.");
  }

  const localRecords = [];
  const centralRecords = [];
  const timestamp = dosTimestamp(new Date(Date.UTC(2026, 0, 1, 0, 0, 0)));
  let localOffset = 0;

  for (const entry of entries) {
    const isDirectory = entry.name.endsWith("/");
    const name = entry.name.replaceAll("\\", "/").replace(/^\/+/, "");
    const nameBytes = Buffer.from(name, "utf8");
    const source = isDirectory ? Buffer.alloc(0) : Buffer.from(entry.data);
    const method = isDirectory ? 0 : 8;
    const compressed = isDirectory ? source : deflateRawSync(source, { level: 9 });
    const checksum = crc32(source);

    for (const size of [nameBytes.length, source.length, compressed.length, localOffset]) {
      if (size > 0xffffffff) {
        throw new Error(`ZIP64 is not supported: ${name} is too large.`);
      }
    }

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(timestamp.time, 10);
    localHeader.writeUInt16LE(timestamp.day, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(source.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localRecord = Buffer.concat([localHeader, nameBytes, compressed]);
    localRecords.push(localRecord);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(timestamp.time, 12);
    centralHeader.writeUInt16LE(timestamp.day, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(source.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(isDirectory ? 0x10 : 0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralRecords.push(Buffer.concat([centralHeader, nameBytes]));

    localOffset += localRecord.length;
  }

  const centralDirectory = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localRecords, centralDirectory, end]);
}

const manifest = Buffer.from(
  "Manifest-Version: 1.0\r\nCreated-By: Codex Theme Pack packager\r\n\r\n",
  "utf8"
);

async function collectResources(directory, prefix = "") {
  const entries = [];
  const children = await readdir(directory, { withFileTypes: true });
  children.sort((left, right) => left.name.localeCompare(right.name));
  for (const child of children) {
    const name = prefix === "" ? child.name : `${prefix}/${child.name}`;
    const path = resolve(directory, child.name);
    if (child.isDirectory()) {
      entries.push({ name: `${name}/`, data: Buffer.alloc(0) });
      entries.push(...await collectResources(path, name));
    } else if (child.isFile()) {
      entries.push({ name, data: await readFile(path) });
    }
  }
  return entries;
}

const resourceEntries = await collectResources(resourcesRoot);
const pluginJar = createZip([
  { name: "META-INF/", data: Buffer.alloc(0) },
  { name: "META-INF/MANIFEST.MF", data: manifest },
  ...resourceEntries.filter(({ name }) => name !== "META-INF/")
]);

const pluginZip = createZip([
  { name: "codex-theme-pack/", data: Buffer.alloc(0) },
  { name: "codex-theme-pack/lib/", data: Buffer.alloc(0) },
  { name: "codex-theme-pack/lib/codex-theme-pack.jar", data: pluginJar }
]);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, pluginZip);
console.log(`Created ${outputPath}`);
