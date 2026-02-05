// FlipperSniffer - Database Module
// In-memory storage with deduplication and JSON export

let storage = require("storage");

// In-memory database
let db = {
    bluetooth: {},  // Keyed by MAC for deduplication
    wifi: {},       // Keyed by BSSID for deduplication
    nfc: {},        // Keyed by UID for deduplication

    // Raw detection log with GPS (every detection = new entry)
    detection_log: [],
};

// Session data
let session = {
    id: "",
    start_time: 0,
    end_time: 0,
    path: [],
    total_distance: 0,
    paused: false,
};

// Generate a short UUID
function generate_id() {
    let chars = "0123456789abcdef";
    let id = "";
    for (let i = 0; i < 8; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

// Initialize a new session
function init_session() {
    session.id = generate_id();
    session.start_time = Date.now();
    session.end_time = 0;
    session.path = [];
    session.total_distance = 0;
    session.paused = false;

    db.bluetooth = {};
    db.wifi = {};
    db.nfc = {};
    db.detection_log = [];

    print("[DB] Session " + session.id + " initialized");
    return session.id;
}

// Add a Bluetooth device (deduplicated by MAC)
// Returns true if it's a NEW device, false if already seen
function add_bluetooth(device, gps) {
    let mac = device.mac;
    if (!mac) return false;

    let is_new = !db.bluetooth[mac];

    // Always log the detection with GPS
    db.detection_log.push({
        type: "bluetooth",
        mac: mac,
        name: device.name || "",
        rssi: device.rssi || -100,
        manufacturer: device.manufacturer || "Unknown",
        brand: device.brand || "Other",
        lat: gps ? gps.lat : 0,
        lon: gps ? gps.lon : 0,
        timestamp: Date.now(),
    });

    if (is_new) {
        // Store unique device with best RSSI and first detection info
        db.bluetooth[mac] = {
            mac: mac,
            name: device.name || "",
            rssi: device.rssi || -100,
            manufacturer: device.manufacturer || "Unknown",
            brand: device.brand || "Other",
            device_type: device.device_type || "unknown",
            lat: gps ? gps.lat : 0,
            lon: gps ? gps.lon : 0,
            first_seen: Date.now(),
            last_seen: Date.now(),
            detections: 1,
        };
    } else {
        // Update existing: keep best RSSI, update last_seen
        let existing = db.bluetooth[mac];
        existing.last_seen = Date.now();
        existing.detections++;
        if (device.rssi > existing.rssi) {
            existing.rssi = device.rssi;
            existing.lat = gps ? gps.lat : existing.lat;
            existing.lon = gps ? gps.lon : existing.lon;
        }
        // Update name if we got a better one
        if (device.name && device.name.length > 0 && (!existing.name || existing.name.length === 0)) {
            existing.name = device.name;
        }
    }

    return is_new;
}

// Add a WiFi network (deduplicated by BSSID)
// Returns true if it's a NEW network, false if already seen
function add_wifi(network, gps) {
    let bssid = network.bssid;
    if (!bssid) return false;

    let is_new = !db.wifi[bssid];

    // Always log detection
    db.detection_log.push({
        type: "wifi",
        bssid: bssid,
        ssid: network.ssid || "",
        channel: network.channel || 0,
        security: network.security || "Unknown",
        rssi: network.rssi || -100,
        lat: gps ? gps.lat : 0,
        lon: gps ? gps.lon : 0,
        timestamp: Date.now(),
    });

    if (is_new) {
        db.wifi[bssid] = {
            bssid: bssid,
            ssid: network.ssid || "",
            channel: network.channel || 0,
            security: network.security || "Unknown",
            rssi: network.rssi || -100,
            lat: gps ? gps.lat : 0,
            lon: gps ? gps.lon : 0,
            first_seen: Date.now(),
            last_seen: Date.now(),
            detections: 1,
        };
    } else {
        let existing = db.wifi[bssid];
        existing.last_seen = Date.now();
        existing.detections++;
        if (network.rssi > existing.rssi) {
            existing.rssi = network.rssi;
            existing.lat = gps ? gps.lat : existing.lat;
            existing.lon = gps ? gps.lon : existing.lon;
        }
        if (network.ssid && network.ssid.length > 0 && (!existing.ssid || existing.ssid.length === 0)) {
            existing.ssid = network.ssid;
        }
    }

    return is_new;
}

// Add an NFC tag (deduplicated by UID)
function add_nfc(tag, gps) {
    let uid = tag.uid;
    if (!uid) return false;

    let is_new = !db.nfc[uid];

    db.detection_log.push({
        type: "nfc",
        uid: uid,
        tag_type: tag.tag_type || "Unknown",
        lat: gps ? gps.lat : 0,
        lon: gps ? gps.lon : 0,
        timestamp: Date.now(),
    });

    if (is_new) {
        db.nfc[uid] = {
            uid: uid,
            tag_type: tag.tag_type || "Unknown",
            lat: gps ? gps.lat : 0,
            lon: gps ? gps.lon : 0,
            first_seen: Date.now(),
        };
    }

    return is_new;
}

// Add GPS path point
function add_path_point(gps) {
    if (!gps || !gps.fix) return;

    let point = {
        lat: gps.lat,
        lon: gps.lon,
        timestamp: Date.now(),
    };

    // Calculate distance from last point
    if (session.path.length > 0) {
        let last = session.path[session.path.length - 1];
        let dist = haversine(last.lat, last.lon, point.lat, point.lon);
        // Only add if we've moved at least 2 meters (noise filter)
        if (dist < 0.002) return;
        session.total_distance += dist;
    }

    session.path.push(point);
}

// Haversine formula for distance in km
function haversine(lat1, lon1, lat2, lon2) {
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

// Get counts
function get_counts() {
    return {
        bluetooth: Object.keys(db.bluetooth).length,
        wifi: Object.keys(db.wifi).length,
        nfc: Object.keys(db.nfc).length,
        total: Object.keys(db.bluetooth).length + Object.keys(db.wifi).length + Object.keys(db.nfc).length,
    };
}

// Get session duration in seconds
function get_duration() {
    if (session.start_time === 0) return 0;
    let end = session.end_time > 0 ? session.end_time : Date.now();
    return Math.floor((end - session.start_time) / 1000);
}

// Compute stats for export
function compute_stats() {
    let bt_devices = Object.values(db.bluetooth);
    let wifi_nets = Object.values(db.wifi);

    let stats = {
        unique_devices_bt: bt_devices.length,
        unique_devices_wifi: wifi_nets.length,
        unique_devices_nfc: Object.keys(db.nfc).length,
        iphone_count: 0,
        android_count: 0,
        apple_total: 0,
        samsung_count: 0,
        google_count: 0,
        xiaomi_count: 0,
        iot_count: 0,
        other_count: 0,
        open_wifi_count: 0,
        wep_networks: 0,
        wpa_networks: 0,
        wpa2_networks: 0,
        wpa3_networks: 0,
    };

    // BT brand stats
    for (let i = 0; i < bt_devices.length; i++) {
        let dev = bt_devices[i];
        switch (dev.brand) {
            case "Apple": stats.apple_total++; break;
            case "Samsung": stats.samsung_count++; break;
            case "Google": stats.google_count++; break;
            case "Xiaomi": stats.xiaomi_count++; break;
            case "IoT": stats.iot_count++; break;
            default: stats.other_count++; break;
        }
    }

    // Estimate iPhone vs other Apple
    stats.iphone_count = Math.floor(stats.apple_total * 0.7);
    stats.android_count = stats.samsung_count + stats.google_count + stats.xiaomi_count;

    // WiFi security stats
    for (let i = 0; i < wifi_nets.length; i++) {
        let net = wifi_nets[i];
        switch (net.security) {
            case "Open": stats.open_wifi_count++; break;
            case "WEP": stats.wep_networks++; break;
            case "WPA": stats.wpa_networks++; break;
            case "WPA2": stats.wpa2_networks++; break;
            case "WPA3": stats.wpa3_networks++; break;
        }
    }

    return stats;
}

// Export session to JSON format
function export_session() {
    session.end_time = Date.now();

    let bt_list = Object.values(db.bluetooth);
    let wifi_list = Object.values(db.wifi);
    let nfc_list = Object.values(db.nfc);
    let duration = get_duration();
    let avg_speed = duration > 0 ? (session.total_distance / (duration / 3600)) : 0;

    let export_data = {
        session: {
            id: session.id,
            start_time: session.start_time,
            end_time: session.end_time,
            duration: duration,
            distance_km: Math.round(session.total_distance * 100) / 100,
            avg_speed: Math.round(avg_speed * 10) / 10,
            path: session.path,
        },
        devices: {
            bluetooth: bt_list.map(function (d) {
                return {
                    mac: d.mac,
                    name: d.name,
                    rssi: d.rssi,
                    lat: d.lat,
                    lon: d.lon,
                    timestamp: d.first_seen,
                    manufacturer: d.manufacturer,
                    brand: d.brand,
                    device_type: d.device_type,
                    detections: d.detections,
                };
            }),
            wifi: wifi_list.map(function (w) {
                return {
                    bssid: w.bssid,
                    ssid: w.ssid,
                    channel: w.channel,
                    security: w.security,
                    rssi: w.rssi,
                    lat: w.lat,
                    lon: w.lon,
                    timestamp: w.first_seen,
                    detections: w.detections,
                };
            }),
            nfc: nfc_list.map(function (n) {
                return {
                    uid: n.uid,
                    tag_type: n.tag_type,
                    lat: n.lat,
                    lon: n.lon,
                    timestamp: n.first_seen,
                };
            }),
        },
        stats: compute_stats(),
    };

    return export_data;
}

// Save export to SD card
function save_to_sd(export_data) {
    let filename = "/ext/exports/session_" + session.id + ".json";
    let json_str = JSON.stringify(export_data);

    // Ensure directory exists
    storage.makeDirectory("/ext/exports");

    let file = storage.openFile(filename, "w", "create_always");
    if (file) {
        storage.write(file, json_str);
        storage.close(file);
        print("[DB] Session saved to " + filename);
        return filename;
    } else {
        print("[DB] ERROR: Could not save session file");
        return null;
    }
}

module.exports = {
    init_session: init_session,
    add_bluetooth: add_bluetooth,
    add_wifi: add_wifi,
    add_nfc: add_nfc,
    add_path_point: add_path_point,
    get_counts: get_counts,
    get_duration: get_duration,
    get_session: function () { return session; },
    export_session: export_session,
    save_to_sd: save_to_sd,
    compute_stats: compute_stats,
};
