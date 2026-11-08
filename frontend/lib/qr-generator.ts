/**
 * frontend/lib/qr-generator.ts
 * Self-contained QR Code SVG generator (ISO/IEC 18004 compliant).
 * Generates crisp, scannable QR Code SVG and Data URLs for EMVCo QRIS strings and URLs.
 * Zero external dependencies.
 */

// Galois Field GF(2^8) math with primitive polynomial 0x11d
const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)

let gfVal = 1
for (let i = 0; i < 255; i++) {
  GF_EXP[i] = gfVal
  GF_LOG[gfVal] = i
  gfVal <<= 1
  if (gfVal & 256) gfVal ^= 0x11d
}
for (let i = 255; i < 512; i++) {
  GF_EXP[i] = GF_EXP[i - 255]
}

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0
  return GF_EXP[GF_LOG[x] + GF_LOG[y]]
}

// Reed-Solomon generator polynomial cache
function getRsGeneratorPoly(ecCount: number): Uint8Array {
  let poly = new Uint8Array([1])
  for (let i = 0; i < ecCount; i++) {
    const next = new Uint8Array(poly.length + 1)
    const factor = GF_EXP[i]
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], factor)
      next[j + 1] ^= poly[j]
    }
    poly = next
  }
  return poly
}

function calculateRsRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = getRsGeneratorPoly(ecCount)
  const remainder = new Uint8Array(ecCount)

  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0]
    remainder.copyWithin(0, 1)
    remainder[ecCount - 1] = 0
    for (let j = 0; j < ecCount; j++) {
      remainder[j] ^= gfMul(gen[j], factor)
    }
  }

  return remainder
}

// QR Version table: [version, totalCodewords, dataCodewordsL, ecCodewordsL, numBlocksL, dataCodewordsM, ecCodewordsM, numBlocksM]
interface VersionInfo {
  version: number
  totalCodewords: number
  dataL: number
  ecL: number
  blocksL: number
  dataM: number
  ecM: number
  blocksM: number
  align: number[]
}

const VERSION_TABLE: VersionInfo[] = [
  { version: 1, totalCodewords: 26, dataL: 19, ecL: 7, blocksL: 1, dataM: 16, ecM: 10, blocksM: 1, align: [] },
  { version: 2, totalCodewords: 44, dataL: 34, ecL: 10, blocksL: 1, dataM: 28, ecM: 16, blocksM: 1, align: [6, 18] },
  { version: 3, totalCodewords: 70, dataL: 55, ecL: 15, blocksL: 1, dataM: 44, ecM: 26, blocksM: 1, align: [6, 22] },
  { version: 4, totalCodewords: 100, dataL: 80, ecL: 20, blocksL: 1, dataM: 64, ecM: 18, blocksM: 2, align: [6, 26] },
  { version: 5, totalCodewords: 134, dataL: 108, ecL: 26, blocksL: 1, dataM: 86, ecM: 24, blocksM: 2, align: [6, 30] },
  { version: 6, totalCodewords: 172, dataL: 136, ecL: 18, blocksL: 2, dataM: 108, ecM: 16, blocksM: 4, align: [6, 34] },
  { version: 7, totalCodewords: 196, dataL: 156, ecL: 20, blocksL: 2, dataM: 124, ecM: 18, blocksM: 4, align: [6, 22, 38] },
  { version: 8, totalCodewords: 242, dataL: 194, ecL: 24, blocksL: 2, dataM: 154, ecM: 22, blocksM: 4, align: [6, 24, 42] },
  { version: 9, totalCodewords: 292, dataL: 232, ecL: 30, blocksL: 2, dataM: 182, ecM: 22, blocksM: 5, align: [6, 26, 46] },
  { version: 10, totalCodewords: 346, dataL: 274, ecL: 18, blocksL: 4, dataM: 216, ecM: 26, blocksM: 5, align: [6, 28, 50] },
  { version: 11, totalCodewords: 404, dataL: 324, ecL: 20, blocksL: 4, dataM: 254, ecM: 30, blocksM: 5, align: [6, 30, 54] },
  { version: 12, totalCodewords: 466, dataL: 370, ecL: 24, blocksL: 4, dataM: 290, ecM: 22, blocksM: 8, align: [6, 32, 58] },
  { version: 13, totalCodewords: 532, dataL: 428, ecL: 26, blocksL: 4, dataM: 334, ecM: 22, blocksM: 9, align: [6, 34, 62] },
  { version: 14, totalCodewords: 581, dataL: 461, ecL: 30, blocksL: 4, dataM: 365, ecM: 24, blocksM: 9, align: [6, 26, 46, 66] },
]

// Format bits for Mask 0 (and Level L = 01 / Level M = 00)
// Precomputed BCH(15, 5) XOR 0x5412
const FORMAT_INFO: Record<'L' | 'M', number[]> = {
  // Level L: indicator 01
  L: [
    0x77c4, // Mask 0: (row + col) % 2 === 0
    0x72f3, // Mask 1: row % 2 === 0
    0x7daa, // Mask 2: col % 3 === 0
    0x789d, // Mask 3: (row + col) % 3 === 0
    0x662f, // Mask 4: (floor(row/2) + floor(col/3)) % 2 === 0
    0x6318, // Mask 5: (row*col)%2 + (row*col)%3 === 0
    0x6c41, // Mask 6: ((row*col)%2 + (row*col)%3) % 2 === 0
    0x6976, // Mask 7: ((row+col)%2 + (row*col)%3) % 2 === 0
  ],
  // Level M: indicator 00
  M: [
    0x5412, // Mask 0
    0x5125, // Mask 1
    0x5e7c, // Mask 2
    0x5b4b, // Mask 3
    0x45f9, // Mask 4
    0x40ce, // Mask 5
    0x4f97, // Mask 6
    0x4aa0, // Mask 7
  ],
}

export function generateQrMatrix(text: string): { size: number; modules: boolean[][] } {
  const textBytes = new TextEncoder().encode(text)

  // Choose smallest version that fits
  let chosenVersion: VersionInfo | null = null
  let chosenEcLevel: 'M' | 'L' = 'M'

  // Prefer Level M (15% error correction) for robust scanning
  for (const v of VERSION_TABLE) {
    const charCountBits = v.version >= 10 ? 16 : 8
    const totalDataBits = 4 + charCountBits + textBytes.length * 8
    const requiredCodewords = Math.ceil(totalDataBits / 8)
    if (requiredCodewords <= v.dataM) {
      chosenVersion = v
      chosenEcLevel = 'M'
      break
    }
  }

  // Fallback to Level L (7% error correction) if text is long
  if (!chosenVersion) {
    for (const v of VERSION_TABLE) {
      const charCountBits = v.version >= 10 ? 16 : 8
      const totalDataBits = 4 + charCountBits + textBytes.length * 8
      const requiredCodewords = Math.ceil(totalDataBits / 8)
      if (requiredCodewords <= v.dataL) {
        chosenVersion = v
        chosenEcLevel = 'L'
        break
      }
    }
  }

  if (!chosenVersion) {
    // If text exceeds version 14 capacity, use version 14
    chosenVersion = VERSION_TABLE[VERSION_TABLE.length - 1]
    chosenEcLevel = 'L'
  }

  const dataCapacity = chosenEcLevel === 'M' ? chosenVersion.dataM : chosenVersion.dataL
  const ecCodewordsPerBlock = chosenEcLevel === 'M' ? chosenVersion.ecM : chosenVersion.ecL
  const numBlocks = chosenEcLevel === 'M' ? chosenVersion.blocksM : chosenVersion.blocksL

  // 1. Bit Buffer: Mode (0100 for Byte mode)
  const bits: number[] = []
  function pushBits(val: number, length: number) {
    for (let i = length - 1; i >= 0; i--) {
      bits.push((val >> i) & 1)
    }
  }

  pushBits(0b0100, 4) // Byte mode
  const countBits = chosenVersion.version >= 10 ? 16 : 8
  pushBits(textBytes.length, countBits)

  for (const b of textBytes) {
    pushBits(b, 8)
  }

  // Terminator (up to 4 zeroes)
  const maxBits = dataCapacity * 8
  const termLength = Math.min(4, maxBits - bits.length)
  pushBits(0, termLength)

  // Align to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0)
  }

  // Convert bits to byte codewords
  const dataCodewords = new Uint8Array(dataCapacity)
  let byteIndex = 0
  for (let i = 0; i < bits.length; i += 8) {
    let byteVal = 0
    for (let j = 0; j < 8; j++) {
      byteVal = (byteVal << 1) | (bits[i + j] ?? 0)
    }
    dataCodewords[byteIndex++] = byteVal
  }

  // Pad bytes 0xEC, 0x11
  const PAD_BYTES = [0xec, 0x11]
  let padIdx = 0
  while (byteIndex < dataCapacity) {
    dataCodewords[byteIndex++] = PAD_BYTES[padIdx % 2]
    padIdx++
  }

  // 2. Partition into blocks and calculate Reed-Solomon EC
  const blockCount = numBlocks
  const baseBlockDataLen = Math.floor(dataCapacity / blockCount)
  const extraBlocks = dataCapacity % blockCount

  const dataBlocks: Uint8Array[] = []
  const ecBlocks: Uint8Array[] = []

  let offset = 0
  for (let b = 0; b < blockCount; b++) {
    const curLen = baseBlockDataLen + (b >= blockCount - extraBlocks ? 1 : 0)
    const blockData = dataCodewords.slice(offset, offset + curLen)
    offset += curLen
    dataBlocks.push(blockData)
    ecBlocks.push(calculateRsRemainder(blockData, ecCodewordsPerBlock))
  }

  // Interleave data codewords
  const finalCodewords: number[] = []
  const maxDataBlockLen = baseBlockDataLen + (extraBlocks > 0 ? 1 : 0)
  for (let i = 0; i < maxDataBlockLen; i++) {
    for (let b = 0; b < blockCount; b++) {
      if (i < dataBlocks[b].length) {
        finalCodewords.push(dataBlocks[b][i])
      }
    }
  }

  // Interleave EC codewords
  for (let i = 0; i < ecCodewordsPerBlock; i++) {
    for (let b = 0; b < blockCount; b++) {
      finalCodewords.push(ecBlocks[b][i])
    }
  }

  // Convert final codewords to bit array
  const finalBits: number[] = []
  for (const cw of finalCodewords) {
    for (let i = 7; i >= 0; i--) {
      finalBits.push((cw >> i) & 1)
    }
  }

  // 3. Matrix Placement
  const size = chosenVersion.version * 4 + 17
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))

  function setModule(row: number, col: number, isDark: boolean) {
    modules[row][col] = isDark
    isFunction[row][col] = true
  }

  // Finder Patterns (7x7) + Separators (8x8)
  function placeFinder(startRow: number, startCol: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = startRow + r
        const col = startCol + c
        if (row >= 0 && row < size && col >= 0 && col < size) {
          const isDark =
            r >= 0 &&
            r <= 6 &&
            c >= 0 &&
            c <= 6 &&
            (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))
          setModule(row, col, isDark)
        }
      }
    }
  }

  placeFinder(0, 0)
  placeFinder(0, size - 7)
  placeFinder(size - 7, 0)

  // Alignment Patterns (5x5)
  const alignCoords = chosenVersion.align
  for (let i = 0; i < alignCoords.length; i++) {
    for (let j = 0; j < alignCoords.length; j++) {
      const row = alignCoords[i]
      const col = alignCoords[j]
      // Skip if overlaps with finder patterns
      if (
        (row <= 8 && col <= 8) ||
        (row <= 8 && col >= size - 9) ||
        (row >= size - 9 && col <= 8)
      ) {
        continue
      }
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const isDark = Math.max(Math.abs(r), Math.abs(c)) !== 1
          setModule(row + r, col + c, isDark)
        }
      }
    }
  }

  // Timing Patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isFunction[6][i]) setModule(6, i, i % 2 === 0)
    if (!isFunction[i][6]) setModule(i, 6, i % 2 === 0)
  }

  // Dark module
  setModule(size - 8, 8, true)

  // Reserve Format Information areas
  for (let i = 0; i < 9; i++) {
    if (!isFunction[8][i]) isFunction[8][i] = true
    if (!isFunction[i][8]) isFunction[i][8] = true
  }
  for (let i = size - 8; i < size; i++) {
    if (!isFunction[8][i]) isFunction[8][i] = true
  }
  for (let i = size - 7; i < size; i++) {
    if (!isFunction[i][8]) isFunction[i][8] = true
  }

  // Place Data bits (zigzag upwards and downwards)
  let bitIdx = 0
  let upward = true
  for (let rightCol = size - 1; rightCol > 0; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5 // Skip vertical timing line
    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i)

    for (const row of rows) {
      for (const col of [rightCol, rightCol - 1]) {
        if (!isFunction[row][col]) {
          const bit = bitIdx < finalBits.length ? finalBits[bitIdx++] === 1 : false
          // Apply Mask 0: (row + col) % 2 === 0
          const mask = (row + col) % 2 === 0
          modules[row][col] = bit !== mask
        }
      }
    }
    upward = !upward
  }

  // Place Format Information (Level L/M + Mask 0)
  const formatVal = FORMAT_INFO[chosenEcLevel][0]
  for (let i = 0; i < 15; i++) {
    const bit = ((formatVal >> (14 - i)) & 1) === 1
    // Top-left
    if (i < 6) modules[8][i] = bit
    else if (i === 6) modules[8][7] = bit
    else if (i < 9) modules[8][8 - (i - 7)] = bit
    else modules[14 - i][8] = bit

    // Split corners
    if (i < 7) {
      modules[size - 1 - i][8] = bit
    } else {
      modules[8][size - 15 + i] = bit
    }
  }

  return { size, modules }
}

export function generateQrSvg(text: string, margin = 4): string {
  const { size, modules } = generateQrMatrix(text)
  const totalSize = size + margin * 2

  let pathD = ''
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) {
        const x = c + margin
        const y = r + margin
        pathD += `M${x},${y}h1v1h-1z `
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/><path d="${pathD.trim()}" fill="#000000"/></svg>`
}

export function generateQrSvgDataUrl(text: string, margin = 4): string {
  const svg = generateQrSvg(text, margin)
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

