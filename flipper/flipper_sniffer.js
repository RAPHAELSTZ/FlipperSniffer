// FlipperSniffer - Main Application v1.1
// Gamified WarDriving for Flipper Zero
// Scans BLE + WiFi + NFC with GPS tracking
//
// Flow: Start screen -> (Settings) -> Scanning -> End -> Export

let gps = require("./gps");
let scanner = require("./scanner");
let database = require("./database");
let settings = require("./settings");
let ui = require("./ui");
let notify = require("notification");

// ──────────────────────────────────────
//  ACHIEVEMENTS SYSTEM
// ──────────────────────────────────────

let achievements = {
    first_10:       { title: "Getting Started",     desc: "10 devices found",       threshold: 10,  unlocked: false },
    first_50:       { title: "Signal Scout",        desc: "50 devices found",       threshold: 50,  unlocked: false },
    first_100:      { title: "Century Club",        desc: "100 devices found",      threshold: 100, unlocked: false },
    first_500:      { title: "Spectrum Overlord",   desc: "500 devices found",      threshold: 500, unlocked: false },
    walker_1km:     { title: "Casual Stroll",       desc: "Walked 1km",             threshold: 1,   unlocked: false },
    walker_5km:     { title: "Urban Explorer",      desc: "Walked 5km",             threshold: 5,   unlocked: false },
    walker_10km:    { title: "Marathon Hacker",     desc: "Walked 10km",            threshold: 10,  unlocked: false },
    wifi_hunter:    { title: "WiFi Hunter",         desc: "50 WiFi networks",       threshold: 50,  unlocked: false },
    apple_valley:   { title: "Silicon Valley",      desc: "50+ Apple devices",      threshold: 50,  unlocked: false },
    open_sesame:    { title: "Open Sesame",         desc: "10 open WiFi networks",  threshold: 10,  unlocked: false },
    night_owl:      { title: "Night Owl",           desc: "Session 10pm-6am",       threshold: 0,   unlocked: false },
    long_session:   { title: "Endurance",           desc: "1 hour+ session",        threshold: 3600,unlocked: false },
};

let latest_achievement = "";
let achievement_time = 0;

function check_achievements() {
    let counts = database.get_counts();
    let session = database.get_session();
    let duration = database.get_duration();
    let stats = database.compute_stats();

    let total = counts.total;
    if (!achievements.first_10.unlocked && total >= 10) unlock("first_10");
    if (!achievements.first_50.unlocked && total >= 50) unlock("first_50");
    if (!achievements.first_100.unlocked && total >= 100) unlock("first_100");
    if (!achievements.first_500.unlocked && total >= 500) unlock("first_500");

    let dist = session.total_distance;
    if (!achievements.walker_1km.unlocked && dist >= 1) unlock("walker_1km");
    if (!achievements.walker_5km.unlocked && dist >= 5) unlock("walker_5km");
    if (!achievements.walker_10km.unlocked && dist >= 10) unlock("walker_10km");

    if (!achievements.wifi_hunter.unlocked && counts.wifi >= 50) unlock("wifi_hunter");
    if (!achievements.apple_valley.unlocked && stats.apple_total >= 50) unlock("apple_valley");
    if (!achievements.open_sesame.unlocked && stats.open_wifi_count >= 10) unlock("open_sesame");

    if (!achievements.night_owl.unlocked) {
        let hour = new Date().getHours();
        if (hour >= 22 || hour < 6) unlock("night_owl");
    }

    if (!achievements.long_session.unlocked && duration >= 3600) unlock("long_session");
}

function unlock(id) {
    achievements[id].unlocked = true;
    latest_achievement = achievements[id].title;
    achievement_time = Date.now();
    if (settings.get("vibrate")) {
        notify.blink("green", "short");
    }
    if (settings.get("sound")) {
        notify.sound("success");
    }
    print("[Achievement] " + achievements[id].title);
}

// ──────────────────────────────────────
//  APPLICATION STATE
// ──────────────────────────────────────

let app_running = true;
let session_active = false;
let paused = false;
let last_gps_update = 0;
let last_wifi_scan = 0;
let last_achievement_check = 0;

// ──────────────────────────────────────
//  INIT (loads settings, shows start screen)
// ──────────────────────────────────────

function app_init() {
    print("=== FlipperSniffer v1.1 ===");

    // Load persisted settings from SD
    settings.load();
    print("[Settings] GPS: " + settings.get("gps_source") + " | Battery: " + settings.get("battery_mode"));

    // Initialize UI (shows start screen)
    ui.init();
    notify.blink("cyan", "long");
}

// ──────────────────────────────────────
//  START SESSION (called from start screen)
// ──────────────────────────────────────

function start_session() {
    print("[Session] Starting...");

    // Init GPS based on setting
    gps.init(settings.get("gps_source"));

    // Init database / new session
    database.init_session();

    // Start BLE scan if enabled
    if (settings.get("scan_bt")) {
        scanner.start_ble(on_bt_device_found);
        print("[Scanner] BLE started");
    }

    session_active = true;
    paused = false;

    if (settings.get("vibrate")) {
        notify.blink("green", "long");
    }
    print("[Session] Active. Start walking!");
}

// ──────────────────────────────────────
//  CALLBACKS
// ──────────────────────────────────────

function on_bt_device_found(device) {
    if (paused || !session_active) return;

    let pos = settings.is_gps_enabled() ? gps.current() : null;
    device.device_type = scanner.classify_device_type(device.name, device.manufacturer);
    let is_new = database.add_bluetooth(device, pos);

    if (is_new && settings.get("vibrate")) {
        // Light vibrate for milestone counts only (avoid constant buzzing)
        let counts = database.get_counts();
        if (counts.total % 25 === 0) {
            notify.blink("blue", "short");
        }
    }

    if (is_new) {
        check_achievements();
    }
}

function on_wifi_network_found(network) {
    if (paused || !session_active) return;

    let pos = settings.is_gps_enabled() ? gps.current() : null;
    let is_new = database.add_wifi(network, pos);

    if (is_new) {
        check_achievements();
    }
}

function do_wifi_scan() {
    if (!settings.get("scan_wifi")) return;
    scanner.scan_wifi(on_wifi_network_found);
}

// ──────────────────────────────────────
//  END SESSION
// ──────────────────────────────────────

function end_session() {
    session_active = false;

    if (settings.get("scan_bt")) {
        scanner.stop_ble();
    }

    let export_data = database.export_session();

    // Add settings snapshot to export
    export_data.settings = settings.get_all();

    // Add achievements
    let unlocked_list = [];
    let locked_list = [];
    for (let id in achievements) {
        let a = achievements[id];
        let entry = { id: id, title: a.title, description: a.desc, unlocked: a.unlocked };
        if (a.unlocked) {
            unlocked_list.push(entry);
        } else {
            locked_list.push(entry);
        }
    }
    export_data.achievements = {
        unlocked: unlocked_list,
        locked: locked_list,
        total_unlocked: unlocked_list.length,
        total: unlocked_list.length + locked_list.length,
    };

    let filename = null;
    if (settings.get("auto_export")) {
        filename = database.save_to_sd(export_data);
    }

    return filename;
}

// ──────────────────────────────────────
//  SETTINGS HELPERS (for UI)
// ──────────────────────────────────────

function get_settings_render_data() {
    let menu = settings.get_menu();
    let display = [];
    for (let i = 0; i < menu.length; i++) {
        display.push(settings.get_display(menu[i].key));
    }
    return {
        settings_menu: menu,
        settings_display: display,
        gps_source: settings.get("gps_source"),
        battery_mode: settings.get("battery_mode"),
        scan_bt: settings.get("scan_bt"),
        scan_wifi: settings.get("scan_wifi"),
    };
}

function handle_setting_change(action) {
    // action format: "setting_next:INDEX" or "setting_prev:INDEX"
    let parts = action.split(":");
    let direction = parts[0] === "setting_next" ? 1 : -1;
    let idx = parseInt(parts[1]);
    let menu = settings.get_menu();
    if (idx >= 0 && idx < menu.length) {
        settings.cycle(menu[idx].key, direction);
    }
}

// ──────────────────────────────────────
//  MAIN LOOP
// ──────────────────────────────────────

function app_loop() {
    let now = Date.now();
    let screen = ui.get_screen();

    // Scanning logic only when session is active and not paused
    if (session_active && !paused) {
        let intervals = settings.get_intervals();

        // GPS update
        if (settings.is_gps_enabled() && (now - last_gps_update >= intervals.gps)) {
            gps.update();
            if (gps.has_fix()) {
                database.add_path_point(gps.current());
            }
            last_gps_update = now;
        }

        // WiFi scan
        if (settings.get("scan_wifi") && (now - last_wifi_scan >= intervals.wifi)) {
            do_wifi_scan();
            last_wifi_scan = now;
        }

        // Achievement check (every 10s regardless of battery mode)
        if (now - last_achievement_check >= 10000) {
            check_achievements();
            last_achievement_check = now;
        }
    }

    // Build render data based on current screen
    let render_data;

    if (screen === "start" || screen === "settings") {
        render_data = get_settings_render_data();
    } else if (screen === "qrcode") {
        let session = database.get_session();
        render_data = {
            session_id: session.id,
            companion_url: settings.get_companion_url(session.id),
        };
    } else {
        let session = database.get_session();
        render_data = {
            counts: database.get_counts(),
            duration: database.get_duration(),
            distance: session.total_distance,
            gps_fix: settings.is_gps_enabled() ? gps.has_fix() : false,
            gps_mode: settings.get("gps_source"),
            session_id: session.id,
            paused: paused,
            latest_achievement: latest_achievement,
            achievement_time: achievement_time,
        };
    }

    ui.render(render_data);
}

// ──────────────────────────────────────
//  INPUT HANDLER
// ──────────────────────────────────────

function on_input(key) {
    let screen = ui.get_screen();

    // Build data context for input handler
    let data = null;
    if (screen === "settings") {
        data = get_settings_render_data();
    }

    let action = ui.handle_input(key, data);
    if (!action) return;

    // ─── Settings actions ───
    if (action.indexOf("setting_next:") === 0 || action.indexOf("setting_prev:") === 0) {
        handle_setting_change(action);
        return;
    }

    switch (action) {
        case "start_session":
            start_session();
            // In companion mode, show QR code screen before scanning
            if (settings.is_companion_mode()) {
                ui.set_screen("qrcode");
            } else {
                ui.set_screen("main");
                ui.set_selected_button(0);
            }
            break;

        case "qr_done":
            // User dismissed QR screen, continue to main scanning
            break;

        case "save_settings":
            settings.save();
            print("[Settings] Saved");
            break;

        case "open_settings":
            // Just a screen change, nothing else needed
            break;

        case "toggle_pause":
            paused = !paused;
            if (paused) {
                if (settings.get("scan_bt")) scanner.stop_ble();
                if (settings.get("vibrate")) notify.blink("yellow", "short");
                print("[Session] Paused");
            } else {
                if (settings.get("scan_bt")) scanner.start_ble(on_bt_device_found);
                if (settings.get("vibrate")) notify.blink("green", "short");
                print("[Session] Resumed");
            }
            break;

        case "end_session":
            let filename = end_session();
            ui.set_screen("save_complete");
            print("[Session] Ended");
            break;

        case "exit":
            if (session_active) {
                end_session();
            }
            app_running = false;
            break;
    }
}

// ──────────────────────────────────────
//  START APPLICATION
// ──────────────────────────────────────

app_init();

// Main loop with battery-aware interval
while (app_running) {
    app_loop();
    let intervals = settings.get_intervals();
    delay(intervals.loop);
}

print("FlipperSniffer session ended.");
