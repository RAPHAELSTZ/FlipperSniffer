// FlipperSniffer - Settings Module
// Persistent settings with SD card storage
// Accessible via Settings screen before/during session

let storage = require("storage");

let SETTINGS_FILE = "/ext/apps_data/flipper_sniffer/settings.json";

// ──────────────────────────────────────
//  DEFAULT SETTINGS
// ──────────────────────────────────────

let defaults = {
    // GPS Source: "off", "companion", or "module"
    // "companion" = no GPS hardware, use phone GPS Companion page
    gps_source: "module",

    // Scan toggles
    scan_bt: true,
    scan_wifi: true,

    // Battery mode: "full", "normal", "saving"
    //  full   = fast intervals, screen always on
    //  normal = balanced
    //  saving = slow intervals, screen dims, WiFi scan less often
    battery_mode: "normal",

    // Vibrate on new device
    vibrate: true,

    // Sound on achievement
    sound: true,

    // Auto-export JSON when ending session
    auto_export: true,

    // Screen timeout in seconds (0 = never)
    screen_timeout: 0,
};

// Current settings (mutable copy)
let current = {};

// ──────────────────────────────────────
//  SETTINGS MENU DEFINITION
//  Each entry: key, label (for display), type, options
// ──────────────────────────────────────

let menu = [
    { key: "gps_source",     label: "GPS",            type: "choice", options: ["off", "companion", "module"],  display: ["Off", "Phone", "Module"] },
    { key: "battery_mode",   label: "Battery",        type: "choice", options: ["full", "normal", "saving"],   display: ["Full", "Normal", "Saving"] },
    { key: "scan_bt",        label: "Scan BT",        type: "bool" },
    { key: "scan_wifi",      label: "Scan WiFi",      type: "bool" },
    { key: "vibrate",        label: "Vibrate",        type: "bool" },
    { key: "sound",          label: "Sound",          type: "bool" },
    { key: "auto_export",    label: "Auto Export",    type: "bool" },
    { key: "screen_timeout", label: "Screen Off",     type: "choice", options: [0, 15, 30, 60],               display: ["Never", "15s", "30s", "60s"] },
];

// ──────────────────────────────────────
//  LOAD / SAVE
// ──────────────────────────────────────

function load() {
    // Start with defaults
    for (let k in defaults) {
        current[k] = defaults[k];
    }

    // Try to read from SD
    try {
        let file = storage.openFile(SETTINGS_FILE, "r", "open_existing");
        if (file) {
            let raw = storage.read(file, 2048);
            storage.close(file);
            if (raw && raw.length > 0) {
                let saved = JSON.parse(raw);
                for (let k in saved) {
                    if (defaults[k] !== undefined) {
                        current[k] = saved[k];
                    }
                }
                print("[Settings] Loaded from SD");
            }
        }
    } catch (e) {
        print("[Settings] No saved settings, using defaults");
    }

    return current;
}

function save() {
    try {
        // Ensure directory exists
        storage.makeDirectory("/ext/apps_data");
        storage.makeDirectory("/ext/apps_data/flipper_sniffer");

        let file = storage.openFile(SETTINGS_FILE, "w", "create_always");
        if (file) {
            storage.write(file, JSON.stringify(current));
            storage.close(file);
            print("[Settings] Saved to SD");
            return true;
        }
    } catch (e) {
        print("[Settings] Save error: " + e);
    }
    return false;
}

// ──────────────────────────────────────
//  GETTERS
// ──────────────────────────────────────

function get(key) {
    return current[key];
}

function get_all() {
    return current;
}

function get_menu() {
    return menu;
}

// ──────────────────────────────────────
//  SETTERS (cycle through options)
// ──────────────────────────────────────

// Cycle a setting to its next value (for Left/Right navigation)
function cycle(key, direction) {
    let entry = null;
    for (let i = 0; i < menu.length; i++) {
        if (menu[i].key === key) { entry = menu[i]; break; }
    }
    if (!entry) return;

    if (entry.type === "bool") {
        current[key] = !current[key];
    } else if (entry.type === "choice") {
        let opts = entry.options;
        let idx = opts.indexOf(current[key]);
        if (idx === -1) idx = 0;
        if (direction > 0) {
            idx = (idx + 1) % opts.length;
        } else {
            idx = (idx - 1 + opts.length) % opts.length;
        }
        current[key] = opts[idx];
    }
}

// Get the display string for a setting's current value
function get_display(key) {
    let entry = null;
    for (let i = 0; i < menu.length; i++) {
        if (menu[i].key === key) { entry = menu[i]; break; }
    }
    if (!entry) return String(current[key]);

    if (entry.type === "bool") {
        return current[key] ? "ON" : "OFF";
    } else if (entry.type === "choice") {
        let idx = entry.options.indexOf(current[key]);
        if (idx === -1) return String(current[key]);
        return entry.display[idx];
    }
    return String(current[key]);
}

// ──────────────────────────────────────
//  BATTERY MODE HELPERS
// ──────────────────────────────────────

// Returns scan intervals in ms based on battery mode
function get_intervals() {
    switch (current.battery_mode) {
        case "full":
            return { gps: 3000, wifi: 10000, loop: 80 };
        case "saving":
            return { gps: 10000, wifi: 30000, loop: 200 };
        default: // normal
            return { gps: 5000, wifi: 15000, loop: 100 };
    }
}

function is_gps_enabled() {
    return current.gps_source === "module";
}

function is_gps_module() {
    return current.gps_source === "module";
}

function is_companion_mode() {
    return current.gps_source === "companion";
}

// ──────────────────────────────────────
//  RESET
// ──────────────────────────────────────

function reset() {
    for (let k in defaults) {
        current[k] = defaults[k];
    }
    print("[Settings] Reset to defaults");
}

module.exports = {
    load: load,
    save: save,
    get: get,
    get_all: get_all,
    get_menu: get_menu,
    get_display: get_display,
    cycle: cycle,
    get_intervals: get_intervals,
    is_gps_enabled: is_gps_enabled,
    is_gps_module: is_gps_module,
    is_companion_mode: is_companion_mode,
    reset: reset,
};
