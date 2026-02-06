// FlipperSniffer - GPS Module
// Reads NMEA sentences from hardware GPS module via UART on GPIO pins
//
// Supported modules: BN-220, NEO-6M, NEO-7M, NEO-8M, etc.
// Wiring: GPS TX -> Flipper RX (pin 14), GPS VCC -> 3.3V, GPS GND -> GND
// Protocol: NMEA 0183 at 9600 baud ($GPGGA, $GPRMC)

let serial = require("serial");

let gps_mode = "off"; // "module" or "off"

let gps_state = {
    lat: 0.0,
    lon: 0.0,
    alt: 0.0,
    speed: 0.0,
    satellites: 0,
    fix: false,
    last_update: 0,
};

// ──────────────────────────────────────
//  NMEA PARSING
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

// Parse NMEA coordinate: ddmm.mmmm -> decimal degrees
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

// Parse $GPGGA sentence (fix data)
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

// Parse $GPRMC sentence (recommended minimum)
function parse_gprmc(parts) {
    if (parts.length < 8) return null;
    if (parts[2] !== "A") return null; // A = active, V = void

    return {
        lat: parse_coord(parts[3], parts[4]),
        lon: parse_coord(parts[5], parts[6]),
        speed: (parseFloat(parts[7]) || 0.0) * 1.852, // knots -> km/h
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
//  INIT / UPDATE
// ──────────────────────────────────────

function gps_init(mode) {
    gps_mode = mode || "off";

    if (gps_mode === "module") {
        serial.setup("usart", 9600);
        print("[GPS] UART module initialized (9600 baud)");
    } else {
        print("[GPS] GPS disabled - scanning without location");
    }
}

function gps_update() {
    if (gps_mode !== "module") return gps_state;

    let line = serial.readln();
    if (!line) return gps_state;

    let parsed = parse_nmea(line);
    if (!parsed) return gps_state;

    if (parsed.lat !== undefined) gps_state.lat = parsed.lat;
    if (parsed.lon !== undefined) gps_state.lon = parsed.lon;
    if (parsed.alt !== undefined) gps_state.alt = parsed.alt;
    if (parsed.speed !== undefined) gps_state.speed = parsed.speed;
    if (parsed.satellites !== undefined) gps_state.satellites = parsed.satellites;
    if (parsed.fix !== undefined) gps_state.fix = parsed.fix;
    gps_state.last_update = Date.now();

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

// Haversine distance in km
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
    if (gps_mode !== "module") return false;
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
