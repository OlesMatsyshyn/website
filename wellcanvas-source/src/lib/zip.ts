const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type ZipInputFile = {
  path: string;
  data: string | Uint8Array;
};

export type ZipFileMap = Record<string, Uint8Array>;

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dateToDos(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function normalizePath(path: string) {
  return path.replace(/^\/+/, "").replace(/\\/g, "/");
}

function toBytes(data: string | Uint8Array) {
  return typeof data === "string" ? textEncoder.encode(data) : data;
}

export function createZip(files: ZipInputFile[]) {
  const chunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  const { dosDate, dosTime } = dateToDos();
  let offset = 0;

  files.forEach((file) => {
    const name = textEncoder.encode(normalizePath(file.path));
    const data = toBytes(file.data);
    const checksum = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, dosTime);
    writeUint16(localView, 12, dosDate);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, data.length);
    writeUint32(localView, 22, data.length);
    writeUint16(localView, 26, name.length);
    writeUint16(localView, 28, 0);
    local.set(name, 30);

    chunks.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, dosTime);
    writeUint16(centralView, 14, dosDate);
    writeUint32(centralView, 16, checksum);
    writeUint32(centralView, 20, data.length);
    writeUint32(centralView, 24, data.length);
    writeUint16(centralView, 28, name.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);
    central.set(name, 46);
    centralChunks.push(central);

    offset += local.length + data.length;
  });

  const centralOffset = offset;
  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, files.length);
  writeUint16(endView, 10, files.length);
  writeUint32(endView, 12, centralSize);
  writeUint32(endView, 16, centralOffset);
  writeUint16(endView, 20, 0);

  const blobParts = [...chunks, ...centralChunks, end].map((chunk) => {
    const copy = new Uint8Array(chunk.byteLength);
    copy.set(chunk);
    return copy.buffer;
  });
  return new Blob(blobParts, { type: "application/zip" });
}

export async function readZip(file: File): Promise<ZipFileMap> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocdOffset = -1;
  for (let index = bytes.length - 22; index >= 0; index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      eocdOffset = index;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Archive is not a valid WellCanvas ZIP.");

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  const files: ZipFileMap = {};
  let pointer = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) {
      throw new Error("Archive central directory is invalid.");
    }
    const method = view.getUint16(pointer + 10, true);
    if (method !== 0) {
      throw new Error("This WellCanvas importer supports stored ZIP entries only.");
    }
    const compressedSize = view.getUint32(pointer + 20, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const localOffset = view.getUint32(pointer + 42, true);
    const name = textDecoder.decode(bytes.slice(pointer + 46, pointer + 46 + nameLength));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    files[name] = bytes.slice(dataOffset, dataOffset + compressedSize);
    pointer += 46 + nameLength + extraLength + commentLength;
  }

  return files;
}

export function decodeZipJson<T>(files: ZipFileMap, path: string): T {
  const file = files[path];
  if (!file) throw new Error(`${path} is missing from the archive.`);
  return JSON.parse(textDecoder.decode(file)) as T;
}
