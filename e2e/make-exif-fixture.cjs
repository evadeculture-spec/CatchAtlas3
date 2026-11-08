// Gera uma fotografia de TESTE com metadados EXIF conhecidos (data/hora com fuso e GPS), a partir de
// e2e/fixtures/test-image.jpg. Uso: node e2e/make-exif-fixture.cjs <saida.jpg> <lat> <lng> "<AAAA:MM:DD HH:MM:SS>" <+HH:MM>
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const [out, latS, lngS, when, offset] = process.argv.slice(2)
const lat = Number(latS), lng = Number(lngS)

function dms(v) {
  const a = Math.abs(v)
  const d = Math.floor(a)
  const m = Math.floor((a - d) * 60)
  const s = Math.round(((a - d) * 60 - m) * 60 * 10000)
  return [[d, 1], [m, 1], [s, 10000]]
}
// TIFF little-endian: IFD0 → (Exif IFD, GPS IFD).
const ifd = (entries, base) => {
  // entries: [tag, type, count, valueBuffer]; devolve { buf, data } com offsets a partir de base.
  const head = Buffer.alloc(2 + entries.length * 12 + 4)
  head.writeUInt16LE(entries.length, 0)
  let dataOff = base + head.length
  const data = []
  entries.forEach(([tag, type, count, val], i) => {
    const o = 2 + i * 12
    head.writeUInt16LE(tag, o)
    head.writeUInt16LE(type, o + 2)
    head.writeUInt32LE(count, o + 4)
    if (val.length <= 4) val.copy(head, o + 8)
    else {
      head.writeUInt32LE(dataOff, o + 8)
      data.push(val)
      dataOff += val.length + (val.length % 2)
      if (val.length % 2) data.push(Buffer.alloc(1))
    }
  })
  return Buffer.concat([head, ...data])
}
const ascii = (s) => Buffer.from(s + '\0', 'ascii')
const long = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b }
const rationals = (rs) => { const b = Buffer.alloc(rs.length * 8); rs.forEach(([n, d], i) => { b.writeUInt32LE(n, i * 8); b.writeUInt32LE(d, i * 8 + 4) }); return b }

const make = ascii('LancaTeste')
// Calcula offsets em duas passagens.
let ifd0 = ifd([[0x010f, 2, make.length, make], [0x8769, 4, 1, long(0)], [0x8825, 4, 1, long(0)]], 8)
const exifOff = 8 + ifd0.length
let exif = ifd([[0x9003, 2, 20, ascii(when)], [0x9011, 2, 7, ascii(offset)]], exifOff)
const gpsOff = exifOff + exif.length
const gps = ifd([[0x0001, 2, 2, ascii(lat >= 0 ? 'N' : 'S')], [0x0002, 5, 3, rationals(dms(lat))], [0x0003, 2, 2, ascii(lng >= 0 ? 'E' : 'W')], [0x0004, 5, 3, rationals(dms(lng))]], gpsOff)
ifd0 = ifd([[0x010f, 2, make.length, make], [0x8769, 4, 1, long(exifOff)], [0x8825, 4, 1, long(gpsOff)]], 8)
const tiffHead = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00])
const tiff = Buffer.concat([tiffHead, ifd0, exif, gps])
const app1Body = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff])
const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([(app1Body.length + 2) >> 8, (app1Body.length + 2) & 0xff]), app1Body])
const src = readFileSync(join(__dirname, 'fixtures', 'test-image.jpg'))
if (src[0] !== 0xff || src[1] !== 0xd8) throw new Error('JPEG inválido')
writeFileSync(out, Buffer.concat([src.subarray(0, 2), app1, src.subarray(2)]))
console.log(`fixture: ${out} (${lat}, ${lng}, ${when} ${offset})`)
