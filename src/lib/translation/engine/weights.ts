/**
 * Read-only access to model weights stored in either format Hugging Face
 * publishes: `model.safetensors`, or a PyTorch `pytorch_model.bin` checkpoint
 * (a zip archive whose pickled index points at raw, uncompressed storages).
 * Both readers report where each tensor's bytes live in the file, so the ONNX
 * graph can reference the weights in place, and can read single rows (used
 * for embedding lookups).
 *
 * Ported from The Augustine Journal (src/lib/translation/weights.js). The
 * unpickler understands only the opcodes a state dict uses and builds plain
 * data — it never calls a Python global, so a checkpoint cannot run code.
 */

import fs from "node:fs";

import { DT } from "./onnx";

export type DType = "F32" | "F16" | "BF16";

export const DTYPES: Record<DType, { onnx: number; bytes: number }> = {
  F32: { onnx: DT.FLOAT, bytes: 4 },
  F16: { onnx: DT.FLOAT16, bytes: 2 },
  BF16: { onnx: DT.BFLOAT16, bytes: 2 },
};

let halfTable: Float32Array | null = null;
function halfToFloat(): Float32Array {
  if (halfTable) return halfTable;
  const table = new Float32Array(65536);
  for (let h = 0; h < 65536; h++) {
    const sign = h & 0x8000 ? -1 : 1;
    const exp = (h >> 10) & 0x1f;
    const frac = h & 0x3ff;
    let v: number;
    if (exp === 0) v = sign * 2 ** -14 * (frac / 1024);
    else if (exp === 0x1f) v = frac ? NaN : sign * Infinity;
    else v = sign * 2 ** (exp - 15) * (1 + frac / 1024);
    table[h] = v;
  }
  halfTable = table;
  return table;
}

export interface TensorInfo {
  dtype: DType;
  dims: number[];
  offset: number;
  length: number;
  onnxType: number;
}

export class WeightsFile {
  fd: number | null;
  readonly size: number;
  readonly tensors = new Map<string, Omit<TensorInfo, "onnxType">>();
  private rowBuffer: Buffer | null = null;

  constructor(readonly file: string) {
    this.fd = fs.openSync(file, "r");
    this.size = fs.fstatSync(this.fd).size;
  }

  read(position: number, length: number): Buffer {
    const buf = Buffer.alloc(length);
    let done = 0;
    while (done < length) {
      const n = fs.readSync(this.fd!, buf, done, length - done, position + done);
      if (n <= 0) throw new Error(`Unexpected end of ${this.file}`);
      done += n;
    }
    return buf;
  }

  add(name: string, dtype: string, dims: number[], offset: number): void {
    if (!(dtype in DTYPES)) throw new Error(`Unsupported dtype ${dtype} for ${name}`);
    const d = dtype as DType;
    const length = dims.reduce((a, b) => a * b, 1) * DTYPES[d].bytes;
    if (offset < 0 || offset + length > this.size)
      throw new Error(`Tensor ${name} lies outside ${this.file}`);
    this.tensors.set(name, { dtype: d, dims, offset, length });
  }

  has(name: string): boolean {
    return this.tensors.has(name);
  }

  info(name: string): TensorInfo {
    const t = this.tensors.get(name);
    if (!t) throw new Error(`Missing tensor ${name} in ${this.file}`);
    return { ...t, onnxType: DTYPES[t.dtype].onnx };
  }

  /** Read row `row` of a 2-D tensor as float32 into out[outOffset ...]. */
  readRow(name: string, row: number, out: Float32Array, outOffset: number): void {
    const t = this.info(name);
    const width = t.dims[1]!;
    if (row < 0 || row >= t.dims[0]!) throw new Error(`Row ${row} out of range for ${name}`);
    const rowBytes = width * DTYPES[t.dtype].bytes;
    if (!this.rowBuffer || this.rowBuffer.length < rowBytes)
      this.rowBuffer = Buffer.alloc(rowBytes);
    const buf = this.rowBuffer;
    fs.readSync(this.fd!, buf, 0, rowBytes, t.offset + row * rowBytes);
    if (t.dtype === "F32") {
      for (let i = 0; i < width; i++) out[outOffset + i] = buf.readFloatLE(i * 4);
    } else if (t.dtype === "F16") {
      const table = halfToFloat();
      for (let i = 0; i < width; i++) out[outOffset + i] = table[buf.readUInt16LE(i * 2)]!;
    } else {
      const view = new DataView(new ArrayBuffer(4));
      for (let i = 0; i < width; i++) {
        view.setUint32(0, buf.readUInt16LE(i * 2) << 16);
        out[outOffset + i] = view.getFloat32(0);
      }
    }
  }

  close(): void {
    if (this.fd !== null) {
      fs.closeSync(this.fd);
      this.fd = null;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  safetensors                                                       */
/* ------------------------------------------------------------------ */

export class SafetensorsFile extends WeightsFile {
  constructor(file: string) {
    super(file);
    const headerLength = Number(this.read(0, 8).readBigUInt64LE(0));
    if (
      !Number.isSafeInteger(headerLength) ||
      headerLength <= 0 ||
      headerLength > 100 * 1024 * 1024
    ) {
      throw new Error(`Invalid safetensors header in ${file}`);
    }
    const header = JSON.parse(this.read(8, headerLength).toString("utf8")) as Record<
      string,
      { dtype: string; shape: number[]; data_offsets: [number, number] }
    >;
    const dataStart = 8 + headerLength;
    for (const [name, t] of Object.entries(header)) {
      if (name === "__metadata__") continue;
      const [begin, end] = t.data_offsets;
      this.add(name, t.dtype, t.shape, dataStart + begin);
      if (this.tensors.get(name)!.length !== end - begin)
        throw new Error(`Corrupt tensor ${name} in ${file}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  PyTorch zip checkpoints                                           */
/* ------------------------------------------------------------------ */

const STORAGE_DTYPES: Record<string, DType> = {
  FloatStorage: "F32",
  HalfStorage: "F16",
  BFloat16Storage: "BF16",
};

interface ZipEntry {
  method: number;
  size: number;
  compSize: number;
  localOffset: number;
}

function readZipEntries(wf: WeightsFile): Map<string, ZipEntry> {
  const tailLength = Math.min(wf.size, 65557 + 20);
  const tail = wf.read(wf.size - tailLength, tailLength);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(`${wf.file} is not a zip archive`);
  let count = tail.readUInt16LE(eocd + 10);
  let cdSize = tail.readUInt32LE(eocd + 12);
  let cdOffset = tail.readUInt32LE(eocd + 16);
  // ZIP64 end-of-central-directory locator sits right before the EOCD record.
  if (eocd >= 20 && tail.readUInt32LE(eocd - 20) === 0x07064b50) {
    const z64Offset = Number(tail.readBigUInt64LE(eocd - 20 + 8));
    const z64 = wf.read(z64Offset, 56);
    if (z64.readUInt32LE(0) !== 0x06064b50) throw new Error(`Bad ZIP64 record in ${wf.file}`);
    count = Number(z64.readBigUInt64LE(32));
    cdSize = Number(z64.readBigUInt64LE(40));
    cdOffset = Number(z64.readBigUInt64LE(48));
  }

  const cd = wf.read(cdOffset, cdSize);
  const entries = new Map<string, ZipEntry>();
  let p = 0;
  for (let n = 0; n < count; n++) {
    if (cd.readUInt32LE(p) !== 0x02014b50)
      throw new Error(`Bad zip central directory in ${wf.file}`);
    const method = cd.readUInt16LE(p + 10);
    let compSize = cd.readUInt32LE(p + 20);
    let size = cd.readUInt32LE(p + 24);
    const nameLen = cd.readUInt16LE(p + 28);
    const extraLen = cd.readUInt16LE(p + 30);
    const commentLen = cd.readUInt16LE(p + 32);
    let localOffset = cd.readUInt32LE(p + 42);
    const name = cd.toString("utf8", p + 46, p + 46 + nameLen);
    // ZIP64 extended information extra field.
    let e = p + 46 + nameLen;
    const extraEnd = e + extraLen;
    while (e + 4 <= extraEnd) {
      const id = cd.readUInt16LE(e);
      const len = cd.readUInt16LE(e + 2);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === 0xffffffff) {
          size = Number(cd.readBigUInt64LE(q));
          q += 8;
        }
        if (compSize === 0xffffffff) {
          compSize = Number(cd.readBigUInt64LE(q));
          q += 8;
        }
        if (localOffset === 0xffffffff) localOffset = Number(cd.readBigUInt64LE(q));
      }
      e += 4 + len;
    }
    entries.set(name, { method, size, compSize, localOffset });
    p = extraEnd + commentLen;
  }
  return entries;
}

function entryDataOffset(wf: WeightsFile, entry: ZipEntry): number {
  const local = wf.read(entry.localOffset, 30);
  if (local.readUInt32LE(0) !== 0x04034b50) throw new Error(`Bad zip local header in ${wf.file}`);
  return entry.localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
}

type Storage = { dtype: DType; offset: number; size: number };
type PickleCallable = {
  call: (args: unknown[]) => unknown;
  storageType?: DType;
  unsupported?: string;
};
type RebuiltTensor = {
  tensor: true;
  storage: Storage;
  storageOffset: number;
  size: number[];
  stride: number[];
};

/** Minimal unpickler for PyTorch state dicts (protocol 2–4). */
export function unpickle(buf: Buffer, persistentLoad: (pid: unknown) => unknown): unknown {
  const stack: unknown[] = [];
  const marks: number[] = [];
  const memo = new Map<number, unknown>();
  let pos = 0;

  const global = (module: string, name: string): PickleCallable => {
    const full = `${module}.${name}`;
    if (full === "collections.OrderedDict") return { call: () => new Map() };
    if (full === "torch._utils._rebuild_tensor_v2") {
      return {
        call: ([storage, storageOffset, size, stride]) => ({
          tensor: true,
          storage,
          storageOffset,
          size,
          stride,
        }),
      };
    }
    if (full === "torch._utils._rebuild_parameter") return { call: ([data]) => data };
    if (module === "torch" && STORAGE_DTYPES[name]) {
      return { call: () => ({ unsupported: full }), storageType: STORAGE_DTYPES[name] };
    }
    return { call: () => ({ unsupported: full }), unsupported: full };
  };

  const popMark = (): unknown[] => {
    const m = marks.pop()!;
    return stack.splice(m);
  };
  const top = <T>(): T => stack[stack.length - 1] as T;

  for (;;) {
    const op = buf[pos++];
    switch (op) {
      case 0x80: // PROTO
        pos += 1;
        break;
      case 0x95: // FRAME
        pos += 8;
        break;
      case 0x7d: // EMPTY_DICT
        stack.push(new Map());
        break;
      case 0x5d: // EMPTY_LIST
      case 0x29: // EMPTY_TUPLE
        stack.push([]);
        break;
      case 0x28: // MARK
        marks.push(stack.length);
        break;
      case 0x4e: // NONE
        stack.push(null);
        break;
      case 0x88: // NEWTRUE
        stack.push(true);
        break;
      case 0x89: // NEWFALSE
        stack.push(false);
        break;
      case 0x4b: // BININT1
        stack.push(buf[pos]);
        pos += 1;
        break;
      case 0x4d: // BININT2
        stack.push(buf.readUInt16LE(pos));
        pos += 2;
        break;
      case 0x4a: // BININT
        stack.push(buf.readInt32LE(pos));
        pos += 4;
        break;
      case 0x8a: {
        // LONG1
        const n = buf[pos]!;
        let v = 0n;
        for (let i = n - 1; i >= 0; i--) v = (v << 8n) | BigInt(buf[pos + 1 + i]!);
        if (n && buf[pos + n]! & 0x80) v -= 1n << BigInt(8 * n);
        stack.push(Number(v));
        pos += 1 + n;
        break;
      }
      case 0x47: // BINFLOAT
        stack.push(buf.readDoubleBE(pos));
        pos += 8;
        break;
      case 0x58: {
        // BINUNICODE
        const n = buf.readUInt32LE(pos);
        stack.push(buf.toString("utf8", pos + 4, pos + 4 + n));
        pos += 4 + n;
        break;
      }
      case 0x8c: {
        // SHORT_BINUNICODE
        const n = buf[pos]!;
        stack.push(buf.toString("utf8", pos + 1, pos + 1 + n));
        pos += 1 + n;
        break;
      }
      case 0x63: {
        // GLOBAL
        const nl1 = buf.indexOf(0x0a, pos);
        const nl2 = buf.indexOf(0x0a, nl1 + 1);
        stack.push(global(buf.toString("utf8", pos, nl1), buf.toString("utf8", nl1 + 1, nl2)));
        pos = nl2 + 1;
        break;
      }
      case 0x93: {
        // STACK_GLOBAL
        const name = stack.pop() as string;
        const moduleName = stack.pop() as string;
        stack.push(global(moduleName, name));
        break;
      }
      case 0x74: // TUPLE
        stack.push(popMark());
        break;
      case 0x85: // TUPLE1
        stack.push([stack.pop()]);
        break;
      case 0x86: {
        // TUPLE2
        const b = stack.pop();
        const a = stack.pop();
        stack.push([a, b]);
        break;
      }
      case 0x87: {
        // TUPLE3
        const c = stack.pop();
        const b = stack.pop();
        const a = stack.pop();
        stack.push([a, b, c]);
        break;
      }
      case 0x51: // BINPERSID
        stack.push(persistentLoad(stack.pop()));
        break;
      case 0x52: {
        // REDUCE
        const args = stack.pop() as unknown[];
        const fn = stack.pop() as PickleCallable | undefined;
        if (!fn || typeof fn.call !== "function") throw new Error("Unsupported pickle callable");
        stack.push(fn.call(args));
        break;
      }
      case 0x62: // BUILD (state is ignored: only metadata)
        stack.pop();
        break;
      case 0x73: {
        // SETITEM
        const v = stack.pop();
        const k = stack.pop();
        top<Map<unknown, unknown>>().set(k, v);
        break;
      }
      case 0x75: {
        // SETITEMS
        const items = popMark();
        const dict = top<Map<unknown, unknown>>();
        for (let i = 0; i < items.length; i += 2) dict.set(items[i], items[i + 1]);
        break;
      }
      case 0x61: {
        // APPEND
        const v = stack.pop();
        top<unknown[]>().push(v);
        break;
      }
      case 0x65: {
        // APPENDS
        const items = popMark();
        top<unknown[]>().push(...items);
        break;
      }
      case 0x71: // BINPUT
        memo.set(buf[pos]!, top());
        pos += 1;
        break;
      case 0x72: // LONG_BINPUT
        memo.set(buf.readUInt32LE(pos), top());
        pos += 4;
        break;
      case 0x94: // MEMOIZE
        memo.set(memo.size, top());
        break;
      case 0x68: // BINGET
        stack.push(memo.get(buf[pos]!));
        pos += 1;
        break;
      case 0x6a: // LONG_BINGET
        stack.push(memo.get(buf.readUInt32LE(pos)));
        pos += 4;
        break;
      case 0x2e: // STOP
        return stack.pop();
      default:
        throw new Error(`Unsupported pickle opcode 0x${(op ?? 0).toString(16)} at ${pos - 1}`);
    }
  }
}

export class TorchCheckpointFile extends WeightsFile {
  constructor(file: string) {
    super(file);
    const entries = readZipEntries(this);
    const pklName = [...entries.keys()].find((n) => n.endsWith("/data.pkl") || n === "data.pkl");
    if (!pklName)
      throw new Error(`${file} has no data.pkl (legacy, non-zip checkpoints are not supported)`);
    const prefix = pklName.slice(0, pklName.length - "data.pkl".length);
    const pklEntry = entries.get(pklName)!;
    if (pklEntry.method !== 0)
      throw new Error(`${file}: compressed checkpoint index is not supported`);
    const pkl = this.read(entryDataOffset(this, pklEntry), pklEntry.size);

    const storages = new Map<string, Storage>();
    const stateDict = unpickle(pkl, (pid) => {
      // ('storage', storage_type, key, location, numel)
      if (!Array.isArray(pid) || pid[0] !== "storage") throw new Error("Unsupported persistent id");
      const type = (pid[1] as PickleCallable | undefined)?.storageType;
      if (!type) throw new Error("Unsupported storage type in checkpoint");
      const key = String(pid[2]);
      if (!storages.has(key)) {
        const entry = entries.get(`${prefix}data/${key}`);
        if (!entry) throw new Error(`Missing storage ${key} in ${file}`);
        if (entry.method !== 0) throw new Error(`${file}: compressed storages are not supported`);
        storages.set(key, { dtype: type, offset: entryDataOffset(this, entry), size: entry.size });
      }
      return storages.get(key);
    });

    if (!(stateDict instanceof Map)) throw new Error(`${file} does not contain a state dict`);
    for (const [name, value] of stateDict as Map<string, unknown>) {
      const t = value as RebuiltTensor | null;
      if (!t || !t.tensor) continue;
      const dims = t.size;
      // Only contiguous (row-major) tensors can be referenced in place.
      let expected = 1;
      for (let i = dims.length - 1; i >= 0; i--) {
        if (dims[i] !== 1 && t.stride[i] !== expected)
          throw new Error(`Tensor ${name} is not contiguous`);
        expected *= dims[i]!;
      }
      const bytes = DTYPES[t.storage.dtype].bytes;
      this.add(name, t.storage.dtype, dims, t.storage.offset + t.storageOffset * bytes);
    }
  }
}

/** Open whichever weights file a model directory contains. */
export function openWeights(dir: string): { weights: WeightsFile; location: string } {
  const st = `${dir}/model.safetensors`;
  if (fs.existsSync(st)) return { weights: new SafetensorsFile(st), location: "model.safetensors" };
  const bin = `${dir}/pytorch_model.bin`;
  if (fs.existsSync(bin))
    return { weights: new TorchCheckpointFile(bin), location: "pytorch_model.bin" };
  throw new Error(`No weights found in ${dir}`);
}
