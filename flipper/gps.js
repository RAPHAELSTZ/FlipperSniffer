// FlipperSniffer - GPS Module
// Supports 3 sources:
//   "module"  - Hardware GPS via UART (NMEA sentences)
//   "phone"   - Smartphone GPS relayed over BLE serial
//   "off"     - No GPS (coordinates will be 0,0)
//
// Phone BLE mode: the Flipper receives GPS data from a companion
// app on the smartphone that sends NMEA-like lines over BLE serial.
// Compatible with standard BLE GPS relay apps (e.g. "GPS2BLE",
// "Bluetooth GPS Output", or any app that streams NMEA over BLE).

let serial = require("serial");
let ble = require("ble");

let gps_mode = "off"; // set by init()

let gps_state = {
    lat: 0.0,
    lon: 0.0,
    alt: 0.0,
    speed: 0.0,
    satellites: 0,
    fix: false,
    last_update: 0,
    source: "off",
};

// BLE serial receive buffer for phone mode
let ble_buffer = "";

// ──────────────────────────────────────
//  NMEA PARSING (shared by module & phone)
// ──────────────────────────────────────

function validate_checksum(sentence) {
    if (sentence.charAt(0) !== "$") return false;
    let star_idx = sentence.indexOf("*");
    if (star_idx === -1) return false;

    let check = 0;
    for (let i = 1; i < star_idx; i++) {
        check ^= sentence.charCodeAt(i);
    }

    let expected = parseInt(sentence.substring(star_idx + 1, star_idx + 3), 16);
    return check === expected;
}

function parse_coord(raw, direction) {
    if (!raw || raw.length === 0) return 0.0;

    let dot = raw.indexOf(".");
    let deg_len = dot - 2;
    let degrees = parseFloat(raw.substring(0, deg_len));
    let minutes = parseFloat(raw.substring(deg_len));
    let decimal = degrees + minutes / 60.0;

    if (direction === "S" || direction === "W") {
        decimal = -decimal;
    }
    return decimal;
}

function parse_gpgga(parts) {
    if (parts.length < 10) return null;
    let fix_quality = parseInt(parts[6]) || 0;
    if (fix_quality === 0) return null;

    return {
        lat: parse_coord(parts[2], parts[3]),
        lon: parse_coord(parts[4], parts[5]),
        fix: fix_quality > 0,
        satellites: parseInt(parts[7]) || 0,
        alt: parseFloat(parts[9]) || 0.0,
    };
}

function parse_gprmc(parts) {
    if (parts.length < 8) return null;
    if (parts[2] !== "A") return null;

    return {
        lat: parse_coord(parts[3], parts[4]),
        lon: parse_coord(parts[5], parts[6]),
        speed: (parseFloat(parts[7]) || 0.0) * 1.852,
        fix: true,
    };
}

function parse_nmea(sentence) {
    if (!sentence || sentence.length < 6) return null;
    if (!validate_checksum(sentence)) return null;

    let star_idx = sentence.indexOf("*");
    let data = sentence.substring(1, star_idx);
    let parts = data.split(",");
    let msg_type = parts[0];

    if (msg_type === "GPGGA" || msg_type === "GNGGA") {
        return parse_gpgga(parts);
    } else if (msg_type === "GPRMC" || msg_type === "GNRMC") {
        return parse_gprmc(parts);
    }

    return null;
}

// ──────────────────────────────────────
//  SIMPLE JSON PARSING (phone fallback)
//  Some apps send: {"lat":48.85,"lon":2.35,"alt":40,"speed":1.2,"sat":8}
// ──────────────────────────────────────

function parse_json_gps(line) {
    try {
        let obj = JSON.parse(line);
        if (obj.lat !== undefined && obj.lon !== undefined) {
            return {
                lat: obj.lat,
                lon: obj.lon,
                alt: obj.alt || 0,
                speed: obj.speed || 0,
                satellites: obj.sat || obj.satellites || 0,
                fix: true,
            };
        }
    } catch (e) {
        // not JSON, ignore
    }
    return null;
}

// ──────────────────────────────────────
//  APPLY PARSED DATA TO STATE
// ──────────────────────────────────────

function apply_parsed(parsed) {
    if (!parsed) return;
    if (parsed.lat !== undefined) gps_state.lat = parsed.lat;
    if (parsed.lon !== undefined) gps_state.lon = parsed.lon;
    if (parsed.alt !== undefined) gps_state.alt = parsed.alt;
    if (parsed.speed !== undefined) gps_state.speed = parsed.speed;
    if (parsed.satellites !== undefined) gps_state.satellites = parsed.satellites;
    if (parsed.fix !== undefined) gps_state.fix = parsed.fix;
    gps_state.last_update = Date.now();
}

// ──────────────────────────────────────
//  INIT PER MODE
// ──────────────────────────────────────

function gps_init(mode) {
    gps_mode = mode || "off";
    gps_state.source = gps_mode;

    if (gps_mode === "module") {
        serial.setup("usart", 9600);
        print("[GPS] UART module initialized (9600 baud)");
    } else if (gps_mode === "phone") {
        // BLE serial profile for receiving GPS from phone
        // The Flipper acts as a BLE peripheral; the phone app
        // connects and streams NMEA or JSON lines.
        ble.setup();
        ble_buffer = "";
        print("[GPS] Phone BLE mode - waiting for connection");
        print("[GPS] Pair your phone & start a GPS relay app");
    } else {
        print("[GPS] GPS disabled");
    }
}

// ──────────────────────────────────────
//  UPDATE PER MODE
// ──────────────────────────────────────

function gps_update() {
    if (gps_mode === "module") {
        return update_module();
    } else if (gps_mode === "phone") {
        return update_phone();
    }
    // mode "off" - nothing to do
    return gps_state;
}

// Hardware module: read UART
function update_module() {
    let line = serial.readln();
    if (!line) return gps_state;

    let parsed = parse_nmea(line);
    apply_parsed(parsed);
    return gps_state;
}

// Phone BLE: read BLE serial, parse NMEA or JSON
function update_phone() {
    // Read available BLE serial data
    let chunk = ble.readSerial();
    if (!chunk || chunk.length === 0) return gps_state;

    ble_buffer += chunk;

    // Process complete lines
    let newline_idx = ble_buffer.indexOf("\n");
    while (newline_idx !== -1) {
        let line = ble_buffer.substring(0, newline_idx).trim();
        ble_buffer = ble_buffer.substring(newline_idx + 1);

        if (line.length > 0) {
            // Try NMEA first (starts with $)
            if (line.charAt(0) === "$") {
                let parsed = parse_nmea(line);
                apply_parsed(parsed);
            }
            // Try JSON fallback (starts with {)
            else if (line.charAt(0) === "{") {
                let parsed = parse_json_gps(line);
                apply_parsed(parsed);
            }
        }

        newline_idx = ble_buffer.indexOf("\n");
    }

    // Prevent buffer overflow
    if (ble_buffer.length > 1024) {
        ble_buffer = ble_buffer.substring(ble_buffer.length - 256);
    }

    return gps_state;
}

// ──────────────────────────────────────
//  PUBLIC API
// ──────────────────────────────────────

function gps_current() {
    return {
        lat: gps_state.lat,
        lon: gps_state.lon,
        alt: gps_state.alt,
        speed: gps_state.speed,
        satellites: gps_state.satellites,
        fix: gps_state.fix,
    };
}

function gps_distance(lat1, lon1, lat2, lon2) {
    let R = 6371;
    let dLat = ((lat2 - lat1) * Math.PI) / 180;
    let dLon = ((lon2 - lon1) * Math.PI) / 180;
    let a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function gps_has_fix() {
    if (gps_mode === "off") return false;
    // For phone mode, consider fix valid if we got data in the last 10s
    if (gps_mode === "phone") {
        return gps_state.fix && (Date.now() - gps_state.last_update) < 10000;
    }
    // Module mode: need at least 3 satellites
    return gps_state.fix && gps_state.satellites >= 3;
}

function gps_get_mode() {
    return gps_mode;
}

module.exports = {
    init: gps_init,
    update: gps_update,
    current: gps_current,
    distance: gps_distance,
    has_fix: gps_has_fix,
    get_mode: gps_get_mode,
};
