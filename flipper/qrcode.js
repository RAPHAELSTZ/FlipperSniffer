// FlipperSniffer - QR Code Generator
// Minimal QR Code encoder for Flipper Zero 128x64 display
// Generates Version 1-4 QR codes (byte mode, ECC-L)
// Draws directly to canvas using drawBox pixel by pixel

// ──────────────────────────────────────
//  GF(256) ARITHMETIC for Reed-Solomon
// ──────────────────────────────────────

let EXP_TABLE = [];
let LOG_TABLE = [];

function init_gf() {
    let val = 1;
    for (let i = 0; i < 256; i++) {
        EXP_TABLE[i] = val;
        LOG_TABLE[val] = i;
        val = val << 1;
        if (val >= 256) val = val ^ 0x11d;
    }
    EXP_TABLE[255] = EXP_TABLE[0];
}

function gf_mul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP_TABLE[(LOG_TABLE[a] + LOG_TABLE[b]) % 255];
}

// ──────────────────────────────────────
//  REED-SOLOMON ECC
// ──────────────────────────────────────

function rs_generator(count) {
    let gen = [1];
    for (let i = 0; i < count; i++) {
        let next = new Array(gen.length + 1).fill(0);
        let factor = EXP_TABLE[i];
        for (let j = 0; j < gen.length; j++) {
            next[j] = next[j] ^ gen[j];
            next[j + 1] = next[j + 1] ^ gf_mul(gen[j], factor);
        }
        gen = next;
    }
    return gen;
}

function rs_encode(data, ecc_count) {
    let gen = rs_generator(ecc_count);
    let msg = data.slice();
    for (let i = 0; i < ecc_count; i++) msg.push(0);

    for (let i = 0; i < data.length; i++) {
        let coef = msg[i];
        if (coef !== 0) {
            for (let j = 0; j < gen.length; j++) {
                msg[i + j] = msg[i + j] ^ gf_mul(gen[j], coef);
            }
        }
    }
    return msg.slice(data.length);
}

// ──────────────────────────────────────
//  QR CODE MATRIX
// ──────────────────────────────────────

// Version configs: [version, size, data_codewords, ecc_codewords] (ECC Level L)
let VERSIONS = [
    [1, 21, 19, 7],
    [2, 25, 34, 10],
    [3, 29, 55, 15],
    [4, 33, 80, 20],
];

// Alignment pattern positions per version (v2+)
let ALIGN_POS = [
    [],          // v1: none
    [6, 18],     // v2
    [6, 22],     // v3
    [6, 26],     // v4
];

function choose_version(byte_len) {
    for (let i = 0; i < VERSIONS.length; i++) {
        // Byte mode overhead: mode(4) + count(8 for v1-9) + data + terminator
        let capacity = VERSIONS[i][2];
        // In byte mode: 4 bits mode + 8 bits count + 8*len bits data
        // Total bits must fit in capacity * 8
        let needed = Math.ceil((4 + 8 + byte_len * 8) / 8);
        if (needed <= capacity) return i;
    }
    return -1; // Too long
}

function create_matrix(size) {
    let m = [];
    for (let r = 0; r < size; r++) {
        m[r] = [];
        for (let c = 0; c < size; c++) {
            m[r][c] = -1; // -1 = unset
        }
    }
    return m;
}

function set_module(matrix, row, col, val) {
    if (row >= 0 && row < matrix.length && col >= 0 && col < matrix.length) {
        matrix[row][col] = val;
    }
}

function place_finder(matrix, row, col) {
    for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
            let rr = row + r;
            let cc = col + c;
            if (rr < 0 || rr >= matrix.length || cc < 0 || cc >= matrix.length) continue;
            if (r === -1 || r === 7 || c === -1 || c === 7) {
                set_module(matrix, rr, cc, 0); // separator
            } else if (r === 0 || r === 6 || c === 0 || c === 6) {
                set_module(matrix, rr, cc, 1);
            } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
                set_module(matrix, rr, cc, 1);
            } else {
                set_module(matrix, rr, cc, 0);
            }
        }
    }
}

function place_alignment(matrix, positions) {
    if (positions.length < 2) return;
    for (let i = 0; i < positions.length; i++) {
        for (let j = 0; j < positions.length; j++) {
            let r = positions[i];
            let c = positions[j];
            // Skip if overlapping with finder patterns
            if (matrix[r][c] !== -1) continue;
            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    let val;
                    if (Math.abs(dr) === 2 || Math.abs(dc) === 2) val = 1;
                    else if (dr === 0 && dc === 0) val = 1;
                    else val = 0;
                    set_module(matrix, r + dr, c + dc, val);
                }
            }
        }
    }
}

function place_timing(matrix, size) {
    for (let i = 8; i < size - 8; i++) {
        let val = (i % 2 === 0) ? 1 : 0;
        if (matrix[6][i] === -1) matrix[6][i] = val;
        if (matrix[i][6] === -1) matrix[i][6] = val;
    }
}

function reserve_format(matrix, size) {
    // Format info areas around finders
    for (let i = 0; i < 8; i++) {
        if (matrix[8][i] === -1) matrix[8][i] = 0;
        if (matrix[i][8] === -1) matrix[i][8] = 0;
        if (matrix[8][size - 1 - i] === -1) matrix[8][size - 1 - i] = 0;
        if (matrix[size - 1 - i][8] === -1) matrix[size - 1 - i][8] = 0;
    }
    if (matrix[8][8] === -1) matrix[8][8] = 0;
    // Dark module
    matrix[size - 8][8] = 1;
}

// ──────────────────────────────────────
//  DATA ENCODING (Byte mode)
// ──────────────────────────────────────

function encode_data(text, version_idx) {
    let ver = VERSIONS[version_idx];
    let data_cw = ver[2];
    let total_bits = data_cw * 8;

    let bits = [];

    // Mode indicator: 0100 (byte mode)
    bits.push(0, 1, 0, 0);

    // Character count (8 bits for v1-9)
    let len = text.length;
    for (let i = 7; i >= 0; i--) {
        bits.push((len >> i) & 1);
    }

    // Data
    for (let i = 0; i < text.length; i++) {
        let b = text.charCodeAt(i) & 0xff;
        for (let j = 7; j >= 0; j--) {
            bits.push((b >> j) & 1);
        }
    }

    // Terminator (up to 4 zeros)
    let remaining = total_bits - bits.length;
    let term = Math.min(4, remaining);
    for (let i = 0; i < term; i++) bits.push(0);

    // Pad to byte boundary
    while (bits.length % 8 !== 0) bits.push(0);

    // Pad bytes (0xEC, 0x11 alternating)
    let pad_bytes = [0xEC, 0x11];
    let pad_idx = 0;
    while (bits.length < total_bits) {
        let pb = pad_bytes[pad_idx % 2];
        for (let j = 7; j >= 0; j--) {
            bits.push((pb >> j) & 1);
        }
        pad_idx++;
    }

    // Convert to bytes
    let bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
        let b = 0;
        for (let j = 0; j < 8; j++) {
            b = (b << 1) | (bits[i + j] || 0);
        }
        bytes.push(b);
    }

    return bytes;
}

// ──────────────────────────────────────
//  DATA PLACEMENT
// ──────────────────────────────────────

function place_data(matrix, size, data_bits) {
    let bit_idx = 0;
    let col = size - 1;
    let going_up = true;

    while (col >= 0) {
        if (col === 6) col--; // Skip timing column

        let rows;
        if (going_up) {
            rows = [];
            for (let r = size - 1; r >= 0; r--) rows.push(r);
        } else {
            rows = [];
            for (let r = 0; r < size; r++) rows.push(r);
        }

        for (let ri = 0; ri < rows.length; ri++) {
            let r = rows[ri];
            for (let dc = 0; dc <= 1; dc++) {
                let c = col - dc;
                if (c < 0) continue;
                if (matrix[r][c] !== -1) continue;

                let val = (bit_idx < data_bits.length) ? data_bits[bit_idx] : 0;
                matrix[r][c] = val;
                bit_idx++;
            }
        }

        col -= 2;
        going_up = !going_up;
    }
}

// ──────────────────────────────────────
//  MASKING (mask 0: (row + col) % 2 == 0)
// ──────────────────────────────────────

function apply_mask(matrix, reserved, size) {
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (reserved[r][c] !== -1) continue; // Don't mask reserved
            if ((r + c) % 2 === 0) {
                matrix[r][c] = matrix[r][c] ^ 1;
            }
        }
    }
}

// ──────────────────────────────────────
//  FORMAT INFO
// ──────────────────────────────────────

// Pre-computed format strings for ECC-L, mask 0
// ECC level L = 01, mask 0 = 000 -> 01000
// BCH(15,5) encoded + XOR mask 101010000010010
let FORMAT_BITS_L_M0 = [1,0,1,0,1,0,0,0,0,0,1,0,0,1,0];

function place_format(matrix, size) {
    let bits = FORMAT_BITS_L_M0;

    // Around top-left finder
    let positions_h = [
        [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8]
    ];
    let positions_v = [
        [7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]
    ];

    for (let i = 0; i < 8; i++) {
        matrix[positions_h[i][0]][positions_h[i][1]] = bits[i];
    }
    for (let i = 0; i < 7; i++) {
        matrix[positions_v[i][0]][positions_v[i][1]] = bits[i + 8];
    }

    // Around bottom-left and top-right
    for (let i = 0; i < 7; i++) {
        matrix[size - 1 - i][8] = bits[i];
    }
    for (let i = 0; i < 8; i++) {
        matrix[8][size - 8 + i] = bits[i + 7];
    }
}

// ──────────────────────────────────────
//  MAIN: GENERATE QR MATRIX
// ──────────────────────────────────────

function generate(text) {
    init_gf();

    let vi = choose_version(text.length);
    if (vi < 0) {
        print("[QR] Text too long: " + text.length + " bytes");
        return null;
    }

    let ver = VERSIONS[vi];
    let size = ver[1];
    let data_cw = ver[2];
    let ecc_cw = ver[3];

    // Encode data
    let data_bytes = encode_data(text, vi);

    // Reed-Solomon ECC
    let ecc_bytes = rs_encode(data_bytes, ecc_cw);

    // All codewords as bits
    let all_bytes = data_bytes.concat(ecc_bytes);
    let all_bits = [];
    for (let i = 0; i < all_bytes.length; i++) {
        for (let j = 7; j >= 0; j--) {
            all_bits.push((all_bytes[i] >> j) & 1);
        }
    }

    // Create matrix
    let matrix = create_matrix(size);

    // Place finder patterns
    place_finder(matrix, 0, 0);
    place_finder(matrix, 0, size - 7);
    place_finder(matrix, size - 7, 0);

    // Place alignment (v2+)
    place_alignment(matrix, ALIGN_POS[vi]);

    // Place timing
    place_timing(matrix, size);

    // Reserve format areas
    reserve_format(matrix, size);

    // Save reserved pattern (to know which modules NOT to mask)
    let reserved = create_matrix(size);
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            reserved[r][c] = matrix[r][c];
        }
    }

    // Place data
    place_data(matrix, size, all_bits);

    // Apply mask 0
    apply_mask(matrix, reserved, size);

    // Place format info (after masking)
    place_format(matrix, size);

    return { matrix: matrix, size: size, version: vi + 1 };
}

// ──────────────────────────────────────
//  DRAW TO FLIPPER CANVAS
// ──────────────────────────────────────

// Draw QR code on Flipper 128x64 canvas
// Centers it with given pixel_size per module
function draw(canvas, qr, x_offset, y_offset, pixel_size) {
    if (!qr) return;

    let size = qr.size;
    let ps = pixel_size || 2;

    // Quiet zone (1 module white border)
    let total = (size + 2) * ps;

    // White background for QR (quiet zone)
    canvas.setColor(0); // white
    canvas.drawBox(x_offset, y_offset, total, total);

    // Draw dark modules
    canvas.setColor(1); // black
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (qr.matrix[r][c] === 1) {
                let px = x_offset + (c + 1) * ps;
                let py = y_offset + (r + 1) * ps;
                canvas.drawBox(px, py, ps, ps);
            }
        }
    }

    // Reset color
    canvas.setColor(1);
}

module.exports = {
    generate: generate,
    draw: draw,
};
