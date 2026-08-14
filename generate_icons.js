const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, drawFn) {
  const buffer = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = a;
    }
  }

  // PNG Filter type 0 (None) per scanline
  const rawData = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 4 + 1)] = 0; // Filter 0
    buffer.copy(rawData, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(rawData);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  function crc32(buf) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[i] = c;
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function iconPainter(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const radius = w * 0.46;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > radius) {
    return [0, 0, 0, 0]; // Transparent outside
  }

  // Rounded circular badge with vibrant red-to-rose gradient
  const t = (x + y) / (w + h);
  const r = Math.round(230 - 30 * t);
  const g = Math.round(0 + 40 * t);
  const b = Math.round(35 + 80 * t);

  // Stylized 'P' badge in the middle
  const nx = (x - cx) / radius; // -1 to 1
  const ny = (y - cy) / radius; // -1 to 1

  // Draw 'P' shape
  // Stem: nx between -0.35 and -0.1, ny between -0.55 and 0.65
  const isStem = nx >= -0.32 && nx <= -0.12 && ny >= -0.55 && ny <= 0.6;
  // Loop: outer circle around (-0.05, -0.2), inner circle cutout
  const ldx = nx - (-0.05);
  const ldy = ny - (-0.2);
  const ldist = Math.sqrt(ldx * ldx + ldy * ldy);
  const isLoop = ldist <= 0.38 && nx >= -0.2 && ny >= -0.55 && ny <= 0.15;
  const isLoopHole = ldist <= 0.18 && nx >= -0.15 && ny >= -0.4 && ny <= 0.02;

  if (isStem || (isLoop && !isLoopHole)) {
    return [255, 255, 255, 255]; // White Pinterest symbol
  }

  return [r, g, b, 255];
}

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const pngBuf = createPNG(size, size, iconPainter);
  fs.writeFileSync(path.join(assetsDir, `icon-${size}.png`), pngBuf);
  console.log(`Generated icon-${size}.png (${size}x${size})`);
});
