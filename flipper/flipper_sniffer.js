// FlipperSniffer - Main Application
// Gamified WarDriving for Flipper Zero
// Scans BLE + WiFi + NFC with GPS tracking

let gps = require("./gps");
let scanner = require("./scanner");
let database = require("./database");
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

    // Device count achievements
    let total = counts.total;
    if (!achievements.first_10.unlocked && total >= 10) unlock("first_10");
    if (!achievements.first_50.unlocked && total >= 50) unlock("first_50");
    if (!achievements.first_100.unlocked && total >= 100) unlock("first_100");
    if (!achievements.first_500.unlocked && total >= 500) unlock("first_500");

    // Distance achievements
    let dist = session.total_distance;
    if (!achievements.walker_1km.unlocked && dist >= 1) unlock("walker_1km");
    if (!achievements.walker_5km.unlocked && dist >= 5) unlock("walker_5km");
    if (!achievements.walker_10km.unlocked && dist >= 10) unlock("walker_10km");

    // WiFi achievements
    if (!achievements.wifi_hunter.unlocked && counts.wifi >= 50) unlock("wifi_hunter");

    // Apple achievement
    if (!achievements.apple_valley.unlocked && stats.apple_total >= 50) unlock("apple_valley");

    // Open WiFi achievement
    if (!achievements.open_sesame.unlocked && stats.open_wifi_count >= 10) unlock("open_sesame");

    // Night owl - session between 22:00 and 06:00
    if (!achievements.night_owl.unlocked) {
        let hour = new Date().getHours();
        if (hour >= 22 || hour < 6) unlock("night_owl");
    }

    // Long session
    if (!achievements.long_session.unlocked && duration >= 3600) unlock("long_session");
}

function unlock(id) {
    achievements[id].unlocked = true;
    latest_achievement = achievements[id].title;
    achievement_time = Date.now();
    notify.blink("green", "short");
    notify.sound("success");
    print("[Achievement] " + achievements[id].title);
}

// ──────────────────────────────────────
//  MAIN APPLICATION LOOP
// ──────────────────────────────────────

let app_running = true;
let paused = false;
let gps_update_interval = 5000; // 5 seconds
let wifi_scan_interval = 15000; // 15 seconds
let achievement_check_interval = 10000;
let last_gps_update = 0;
let last_wifi_scan = 0;
let last_achievement_check = 0;

// Initialize everything
function app_init() {
    print("=== FlipperSniffer v1.0 ===");
    print("Initializing GPS...");
    gps.init();

    print("Starting session...");
    database.init_session();

    print("Starting BLE scan...");
    scanner.start_ble(on_bt_device_found);

    print("Initializing UI...");
    ui.init();

    print("Ready! Start walking.");
    notify.blink("cyan", "long");
}

// Callback: Bluetooth device found
function on_bt_device_found(device) {
    if (paused) return;

    let pos = gps.current();
    device.device_type = scanner.classify_device_type(device.name, device.manufacturer);
    let is_new = database.add_bluetooth(device, pos);

    if (is_new) {
        check_achievements();
    }
}

// Callback: WiFi network found
function on_wifi_network_found(network) {
    if (paused) return;

    let pos = gps.current();
    let is_new = database.add_wifi(network, pos);

    if (is_new) {
        check_achievements();
    }
}

// Periodic WiFi scan
function do_wifi_scan() {
    scanner.scan_wifi(on_wifi_network_found);
}

// End session and export
function end_session() {
    scanner.stop_ble();

    let export_data = database.export_session();

    // Add achievements to export
    let unlocked_list = [];
    let locked_list = [];
    for (let id in achievements) {
        let a = achievements[id];
        let entry = {
            id: id,
            title: a.title,
            description: a.desc,
            unlocked: a.unlocked,
        };
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

    let filename = database.save_to_sd(export_data);
    return filename;
}

// Main loop
function app_loop() {
    let now = Date.now();

    if (!paused) {
        // GPS update
        if (now - last_gps_update >= gps_update_interval) {
            gps.update();
            if (gps.has_fix()) {
                database.add_path_point(gps.current());
            }
            last_gps_update = now;
        }

        // Periodic WiFi scan
        if (now - last_wifi_scan >= wifi_scan_interval) {
            do_wifi_scan();
            last_wifi_scan = now;
        }

        // Achievement check
        if (now - last_achievement_check >= achievement_check_interval) {
            check_achievements();
            last_achievement_check = now;
        }
    }

    // Render UI
    let session = database.get_session();
    let render_data = {
        counts: database.get_counts(),
        duration: database.get_duration(),
        distance: session.total_distance,
        gps_fix: gps.has_fix(),
        session_id: session.id,
        paused: paused,
        latest_achievement: latest_achievement,
        achievement_time: achievement_time,
    };

    ui.render(render_data);
}

// Handle user input
function on_input(key) {
    let action = ui.handle_input(key);

    switch (action) {
        case "toggle_pause":
            paused = !paused;
            if (paused) {
                scanner.stop_ble();
                notify.blink("yellow", "short");
            } else {
                scanner.start_ble(on_bt_device_found);
                notify.blink("green", "short");
            }
            break;

        case "end_session":
            let filename = end_session();
            ui.set_screen("save_complete");
            break;

        case "exit":
            app_running = false;
            break;
    }
}

// ──────────────────────────────────────
//  START APPLICATION
// ──────────────────────────────────────

app_init();

// Main loop - runs every 100ms
while (app_running) {
    app_loop();
    delay(100);
}

print("FlipperSniffer session ended.");
