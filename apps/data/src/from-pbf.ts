/**
 * Builds data/stations.json from a local OSM extract instead of the (often overloaded) Overpass API.
 *
 *   curl -LO https://download.geofabrik.de/europe/ukraine/ukraine-latest.osm.pbf
 *   npm run stations-from-pbf -- ukraine-latest.osm.pbf
 *
 * Two passes over the file: (1) collect amenity=fuel nodes and ways, (2) look up coordinates of the
 * nodes that make up those ways so they get a centre point. Relations are ignored (very rare for fuel).
 */
import { closeSync, openSync, readSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { PbfReader as Pbf } from 'pbf';
import { parseOverpass } from './stations.js';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../data/stations.json');
const dec = new TextDecoder();

interface Blob { type: string; data: Uint8Array }

function* readBlobs(file: string): Generator<Blob> {
  const fd = openSync(file, 'r');
  try {
    const lenBuf = Buffer.alloc(4);
    let pos = 0;
    for (;;) {
      if (readSync(fd, lenBuf, 0, 4, pos) < 4) return;
      const headerLen = lenBuf.readUInt32BE(0);
      const headerBuf = Buffer.alloc(headerLen);
      readSync(fd, headerBuf, 0, headerLen, pos + 4);
      let type = '';
      let dataSize = 0;
      new Pbf(headerBuf).readFields((tag, _r, p) => {
        if (tag === 1) type = p.readString();
        else if (tag === 3) dataSize = p.readVarint();
      }, null);
      const blobBuf = Buffer.alloc(dataSize);
      readSync(fd, blobBuf, 0, dataSize, pos + 4 + headerLen);
      pos += 4 + headerLen + dataSize;

      let raw: Uint8Array | null = null;
      let zlib: Uint8Array | null = null;
      new Pbf(blobBuf).readFields((tag, _r, p) => {
        if (tag === 1) raw = p.readBytes();
        else if (tag === 3) zlib = p.readBytes();
      }, null);
      yield { type, data: zlib ? inflateSync(zlib) : raw ?? new Uint8Array() };
    }
  } finally {
    closeSync(fd);
  }
}

interface Block {
  strings: Uint8Array[];
  groups: Uint8Array[];
  granularity: number;
  latOff: number;
  lonOff: number;
}

function parseBlock(data: Uint8Array): Block {
  const block: Block = { strings: [], groups: [], granularity: 100, latOff: 0, lonOff: 0 };
  new Pbf(data).readFields((tag, b: Block, p) => {
    if (tag === 1) p.readMessage((t, _r, pp) => { if (t === 1) b.strings.push(pp.readBytes()); }, null);
    else if (tag === 2) b.groups.push(p.readBytes());
    else if (tag === 17) b.granularity = p.readVarint();
    else if (tag === 19) b.latOff = p.readVarint(true);
    else if (tag === 20) b.lonOff = p.readVarint(true);
  }, block);
  return block;
}

const toDeg = (b: Block, v: number, off: number) => 1e-9 * (off + b.granularity * v);

type Tags = Record<string, string>;
interface Visitor {
  node?(id: number, lat: number, lon: number, tags: () => Tags | null): void;
  way?(id: number, refs: number[], tags: () => Tags | null): void;
}

function visitBlock(block: Block, v: Visitor) {
  const str = (i: number) => dec.decode(block.strings[i]);
  const pairs = (keys: number[], vals: number[]): Tags => {
    const t: Tags = {};
    keys.forEach((k, i) => { t[str(k)] = str(vals[i]!); });
    return t;
  };
  for (const g of block.groups) {
    new Pbf(g).readFields((tag, _r, p) => {
      if (tag === 1 && v.node) {
        const n = { id: 0, lat: 0, lon: 0, keys: [] as number[], vals: [] as number[] };
        p.readMessage((t, _x, pp) => {
          if (t === 1) n.id = pp.readSVarint();
          else if (t === 2) n.keys = pp.readPackedVarint();
          else if (t === 3) n.vals = pp.readPackedVarint();
          else if (t === 8) n.lat = pp.readSVarint();
          else if (t === 9) n.lon = pp.readSVarint();
        }, null);
        v.node(n.id, toDeg(block, n.lat, block.latOff), toDeg(block, n.lon, block.lonOff), () => (n.keys.length ? pairs(n.keys, n.vals) : null));
      } else if (tag === 2 && v.node) {
        const d = { ids: [] as number[], lats: [] as number[], lons: [] as number[], kv: [] as number[] };
        p.readMessage((t, _x, pp) => {
          if (t === 1) d.ids = pp.readPackedSVarint();
          else if (t === 8) d.lats = pp.readPackedSVarint();
          else if (t === 9) d.lons = pp.readPackedSVarint();
          else if (t === 10) d.kv = pp.readPackedVarint();
        }, null);
        let id = 0, lat = 0, lon = 0, kvPos = 0;
        for (let i = 0; i < d.ids.length; i++) {
          id += d.ids[i]!; lat += d.lats[i]!; lon += d.lons[i]!;
          const start = kvPos;
          while (kvPos < d.kv.length && d.kv[kvPos] !== 0) kvPos += 2;
          const end = kvPos;
          kvPos++; // the 0 terminator (present for every node once keys_vals exists)
          v.node(id, toDeg(block, lat, block.latOff), toDeg(block, lon, block.lonOff), () => {
            if (end === start) return null;
            const t: Tags = {};
            for (let k = start; k < end; k += 2) t[str(d.kv[k]!)] = str(d.kv[k + 1]!);
            return t;
          });
        }
      } else if (tag === 3 && v.way) {
        const w = { id: 0, keys: [] as number[], vals: [] as number[], refs: [] as number[] };
        p.readMessage((t, _x, pp) => {
          if (t === 1) w.id = pp.readVarint();
          else if (t === 2) w.keys = pp.readPackedVarint();
          else if (t === 3) w.vals = pp.readPackedVarint();
          else if (t === 8) w.refs = pp.readPackedSVarint();
        }, null);
        let acc = 0;
        const refs = w.refs.map((d) => (acc += d));
        v.way(w.id, refs, () => (w.keys.length ? pairs(w.keys, w.vals) : null));
      }
    }, null);
  }
}

const isFuel = (t: Tags | null): t is Tags => !!t && t.amenity === 'fuel';

function main() {
  const file = process.argv[2];
  if (!file) throw new Error('usage: npm run stations-from-pbf -- <file.osm.pbf>');
  const t0 = Date.now();

  // pass 1: fuel nodes + fuel ways
  const nodes: { id: number; lat: number; lon: number; tags: Tags }[] = [];
  const ways: { id: number; refs: number[]; tags: Tags }[] = [];
  const need = new Set<number>();
  let blocks = 0;
  for (const blob of readBlobs(file)) {
    if (blob.type !== 'OSMData') continue;
    const block = parseBlock(blob.data);
    // cheap skip: blocks whose string table has no "fuel" cannot contain fuel features
    if (!block.strings.some((s) => s.length === 4 && dec.decode(s) === 'fuel')) continue;
    visitBlock(block, {
      node: (id, lat, lon, tags) => { const t = tags(); if (isFuel(t)) nodes.push({ id, lat, lon, tags: t }); },
      way: (id, refs, tags) => { const t = tags(); if (isFuel(t)) { ways.push({ id, refs, tags: t }); refs.forEach((r) => need.add(r)); } },
    });
    if (++blocks % 200 === 0) console.log(`pass 1: ${blocks} blocks with "fuel", ${nodes.length} nodes, ${ways.length} ways`);
  }
  console.log(`pass 1 done in ${((Date.now() - t0) / 1000).toFixed(0)}s: ${nodes.length} nodes, ${ways.length} ways, ${need.size} way nodes needed`);

  // pass 2: coordinates of the way nodes
  const coords = new Map<number, [number, number]>();
  for (const blob of readBlobs(file)) {
    if (blob.type !== 'OSMData') continue;
    visitBlock(parseBlock(blob.data), { node: (id, lat, lon) => { if (need.has(id)) coords.set(id, [lat, lon]); } });
  }
  console.log(`pass 2 done in ${((Date.now() - t0) / 1000).toFixed(0)}s: ${coords.size}/${need.size} way nodes found`);

  const elements = [
    ...nodes.map((n) => ({ type: 'node', id: n.id, lat: n.lat, lon: n.lon, tags: n.tags })),
    ...ways.flatMap((w) => {
      const pts = w.refs.map((r) => coords.get(r)).filter((c): c is [number, number] => !!c);
      if (!pts.length) return [];
      const lat = pts.reduce((a, c) => a + c[0], 0) / pts.length;
      const lon = pts.reduce((a, c) => a + c[1], 0) / pts.length;
      return [{ type: 'way', id: w.id, center: { lat, lon }, tags: w.tags }];
    }),
  ];
  const stations = parseOverpass(elements).sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), source: 'extract', stations }) + '\n');
  console.log(`wrote ${stations.length} stations to ${OUT}`);
}

main();
