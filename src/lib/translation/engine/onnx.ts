/**
 * A tiny ONNX graph writer. It produces ModelProto bytes that onnxruntime can
 * load, with large weights referenced in place inside an existing file (the
 * model's .safetensors or pytorch_model.bin) through ONNX "external data", so
 * nothing has to be converted or copied on disk.
 *
 * Ported from The Augustine Journal (src/lib/translation/onnx.js).
 */

export const DT = { FLOAT: 1, INT32: 6, INT64: 7, FLOAT16: 10, BFLOAT16: 16 } as const;

const ATTR = { FLOAT: 1, INT: 2, STRING: 3, FLOATS: 6, INTS: 7 } as const;

export type AttrValue = number | string | number[] | { float: number };

/* ------------------------------------------------------------------ */
/*  Protobuf writer                                                    */
/* ------------------------------------------------------------------ */

export class Writer {
  parts: Buffer[] = [];
  length = 0;

  push(buf: Buffer): void {
    this.parts.push(buf);
    this.length += buf.length;
  }

  varint(value: number | bigint): void {
    let v = BigInt.asUintN(64, BigInt(value));
    const bytes: number[] = [];
    do {
      let byte = Number(v & 0x7fn);
      v >>= 7n;
      if (v > 0n) byte |= 0x80;
      bytes.push(byte);
    } while (v > 0n);
    this.push(Buffer.from(bytes));
  }

  key(field: number, wire: number): void {
    this.varint(field * 8 + wire);
  }

  int(field: number, value: number | bigint): void {
    this.key(field, 0);
    this.varint(value);
  }

  float(field: number, value: number): void {
    this.key(field, 5);
    const b = Buffer.alloc(4);
    b.writeFloatLE(value, 0);
    this.push(b);
  }

  bytes(field: number, buf: Buffer): void {
    this.key(field, 2);
    this.varint(buf.length);
    this.push(buf);
  }

  string(field: number, value: string): void {
    this.bytes(field, Buffer.from(String(value), "utf8"));
  }

  message(field: number, writer: Writer): void {
    this.key(field, 2);
    this.varint(writer.length);
    for (const p of writer.parts) this.push(p);
  }

  toBuffer(): Buffer {
    return Buffer.concat(this.parts, this.length);
  }
}

/* ------------------------------------------------------------------ */
/*  Graph builder                                                      */
/* ------------------------------------------------------------------ */

type Dim = number | string;

interface ValueInfo {
  name: string;
  elemType: number;
  shape: Dim[];
}

interface Initializer {
  name: string;
  dataType: number;
  dims: number[];
  external?: { location: string; offset: number; length: number };
  raw?: Buffer;
}

interface NodeDef {
  opType: string;
  inputs: string[];
  outputs: string[];
  attrs: Record<string, AttrValue>;
  name: string;
}

export class Graph {
  nodes: NodeDef[] = [];
  initializers: Initializer[] = [];
  inputs: ValueInfo[] = [];
  outputs: ValueInfo[] = [];
  private counter = 0;

  constructor(readonly name: string) {}

  fresh(prefix: string): string {
    this.counter += 1;
    return `${prefix}_${this.counter}`;
  }

  input(name: string, elemType: number, shape: Dim[]): string {
    this.inputs.push({ name, elemType, shape });
    return name;
  }

  output(name: string, elemType: number, shape: Dim[]): string {
    this.outputs.push({ name, elemType, shape });
    return name;
  }

  /** Weight stored in an external file at [offset, offset + length). */
  external(
    name: string,
    dataType: number,
    dims: number[],
    location: string,
    offset: number,
    length: number,
  ): string {
    this.initializers.push({ name, dataType, dims, external: { location, offset, length } });
    return name;
  }

  /** Small constant stored inline. */
  constant(name: string, dataType: number, dims: number[], raw: ArrayBufferView): string {
    this.initializers.push({
      name,
      dataType,
      dims,
      raw: Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength),
    });
    return name;
  }

  constFloat(values: number[], dims: number[] = [values.length]): string {
    return this.constant(this.fresh("const_f"), DT.FLOAT, dims, Float32Array.from(values));
  }

  constInt64(values: number[], dims: number[] = [values.length]): string {
    return this.constant(
      this.fresh("const_i"),
      DT.INT64,
      dims,
      BigInt64Array.from(values.map((v) => BigInt(v))),
    );
  }

  /** Add a node; returns its (first) output name. */
  op(
    opType: string,
    inputs: string[],
    attrs: Record<string, AttrValue> = {},
    outputs: string[] | null = null,
  ): string {
    const outs = outputs ?? [this.fresh(opType.toLowerCase())];
    this.nodes.push({ opType, inputs, outputs: outs, attrs, name: this.fresh(`n_${opType}`) });
    return outs[0]!;
  }

  /** Serialize as ONNX ModelProto bytes (IR v8, default opset 17). */
  toModelBytes(): Buffer {
    const graph = new Writer();
    for (const node of this.nodes) graph.message(1, encodeNode(node));
    graph.string(2, this.name);
    for (const init of this.initializers) graph.message(5, encodeTensor(init));
    for (const vi of this.inputs) graph.message(11, encodeValueInfo(vi));
    for (const vi of this.outputs) graph.message(12, encodeValueInfo(vi));

    const opset = new Writer();
    opset.string(1, "");
    opset.int(2, 17);

    const model = new Writer();
    model.int(1, 8);
    model.string(2, "viafidei");
    model.string(3, "1");
    model.message(7, graph);
    model.message(8, opset);
    return model.toBuffer();
  }
}

function encodeNode(node: NodeDef): Writer {
  const w = new Writer();
  for (const i of node.inputs) w.string(1, i);
  for (const o of node.outputs) w.string(2, o);
  w.string(3, node.name);
  w.string(4, node.opType);
  for (const [name, value] of Object.entries(node.attrs)) w.message(5, encodeAttr(name, value));
  return w;
}

function encodeAttr(name: string, value: AttrValue): Writer {
  const w = new Writer();
  w.string(1, name);
  if (Array.isArray(value)) {
    if (value.every(Number.isInteger)) {
      for (const v of value) w.int(8, v);
      w.int(20, ATTR.INTS);
    } else {
      for (const v of value) w.float(7, v);
      w.int(20, ATTR.FLOATS);
    }
  } else if (typeof value === "string") {
    w.string(4, value);
    w.int(20, ATTR.STRING);
  } else if (typeof value === "object" && value !== null && "float" in value) {
    w.float(2, value.float);
    w.int(20, ATTR.FLOAT);
  } else if (Number.isInteger(value)) {
    w.int(3, value);
    w.int(20, ATTR.INT);
  } else {
    w.float(2, value);
    w.int(20, ATTR.FLOAT);
  }
  return w;
}

function encodeTensor(t: Initializer): Writer {
  const w = new Writer();
  for (const d of t.dims) w.int(1, d);
  w.int(2, t.dataType);
  w.string(8, t.name);
  if (t.raw) {
    w.bytes(9, t.raw);
  } else if (t.external) {
    const entries: Array<[string, string]> = [
      ["location", t.external.location],
      ["offset", String(t.external.offset)],
      ["length", String(t.external.length)],
    ];
    for (const [k, v] of entries) {
      const e = new Writer();
      e.string(1, k);
      e.string(2, v);
      w.message(13, e);
    }
    w.int(14, 1); // DataLocation.EXTERNAL
  }
  return w;
}

function encodeValueInfo(vi: ValueInfo): Writer {
  const shape = new Writer();
  for (const d of vi.shape) {
    const dim = new Writer();
    if (typeof d === "number") dim.int(1, d);
    else dim.string(2, d);
    shape.message(1, dim);
  }
  const tensorType = new Writer();
  tensorType.int(1, vi.elemType);
  tensorType.message(2, shape);
  const type = new Writer();
  type.message(1, tensorType);
  const w = new Writer();
  w.string(1, vi.name);
  w.message(2, type);
  return w;
}
