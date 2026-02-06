// FlipperSniffer - UI Module
// Flipper Zero display rendering
// Screens: start, settings, main, stats, confirm_end, save_complete

let gui = require("gui");
let canvas = null;

// UI state
let ui_state = {
    screen: "start",     // start, settings, main, stats, confirm_end, save_complete
    notification: "",
    notification_time: 0,
    selected_button: 0,  // context-dependent
    settings_cursor: 0,  // which setting row is selected
};

// ──────────────────────────────────────
//  FORMATTING HELPERS
// ──────────────────────────────────────

function format_time(seconds) {
    let h = Math.floor(seconds / 3600);
    let m = Math.floor((seconds % 3600) / 60);
    let s = seconds % 60;
    return (
        (h < 10 ? "0" : "") + h + ":" +
        (m < 10 ? "0" : "") + m + ":" +
        (s < 10 ? "0" : "") + s
    );
}

function format_distance(km) {
    if (km < 1) {
        return Math.round(km * 1000) + "m";
    }
    return (Math.round(km * 100) / 100) + "km";
}

// ──────────────────────────────────────
//  INIT
// ──────────────────────────────────────

function ui_init() {
    gui.viewDispatcherSetView(gui.viewDispatcher, 0);
    print("[UI] Initialized");
}

// ──────────────────────────────────────
//  SCREEN: START (pre-session)
// ──────────────────────────────────────

function draw_start(canvas, data) {
    // Title
    canvas.setFont("primary");
    canvas.drawStr(10, 10, "FLIPPER SNIFFER");

    canvas.setFont("secondary");
    canvas.drawStr(20, 22, "v1.1 - WarDriving");

    // GPS status preview
    let gps_src = data.gps_source || "off";
    let gps_label = gps_src === "phone" ? "Phone BT" : gps_src === "module" ? "HW Module" : "Off";
    canvas.drawStr(2, 36, "GPS: " + gps_label);

    // Battery mode
    let batt = data.battery_mode || "normal";
    canvas.drawStr(70, 36, "Batt: " + batt.charAt(0).toUpperCase() + batt.substring(1));

    // Scan types
    let scans = [];
    if (data.scan_bt) scans.push("BT");
    if (data.scan_wifi) scans.push("WiFi");
    if (scans.length === 0) scans.push("None");
    canvas.drawStr(2, 46, "Scan: " + scans.join("+"));

    // Bottom buttons
    canvas.drawStr(2, 63, "[Settings]");
    canvas.drawStr(72, 63, "[> START]");
}

// ──────────────────────────────────────
//  SCREEN: SETTINGS
// ──────────────────────────────────────

function draw_settings(canvas, data) {
    let settings_menu = data.settings_menu || [];
    let cursor = ui_state.settings_cursor;

    canvas.setFont("primary");
    canvas.drawStr(2, 10, "SETTINGS");

    canvas.setFont("secondary");

    // Show up to 5 items (scrollable), starting from scroll offset
    let visible = 5;
    let scroll_offset = Math.max(0, cursor - 3);
    let max_offset = Math.max(0, settings_menu.length - visible);
    scroll_offset = Math.min(scroll_offset, max_offset);

    for (let i = 0; i < visible && (scroll_offset + i) < settings_menu.length; i++) {
        let idx = scroll_offset + i;
        let item = settings_menu[idx];
        let y = 22 + (i * 8);

        // Selection indicator
        let prefix = (idx === cursor) ? "> " : "  ";
        let value = data.settings_display[idx] || "?";

        canvas.drawStr(0, y, prefix + item.label);

        // Right-align value
        let val_str = "[" + value + "]";
        let val_x = 128 - (val_str.length * 6);
        canvas.drawStr(val_x, y, val_str);
    }

    // Scroll indicators
    if (scroll_offset > 0) {
        canvas.drawStr(120, 14, "^");
    }
    if (scroll_offset + visible < settings_menu.length) {
        canvas.drawStr(120, 22 + (visible * 8), "v");
    }

    // Bottom
    canvas.drawStr(2, 63, "[< Back]");
    canvas.drawStr(70, 63, "L/R:Change");
}

// ──────────────────────────────────────
//  SCREEN: MAIN (scanning)
// ──────────────────────────────────────

function draw_main(canvas, data) {
    let counts = data.counts;
    let duration = data.duration;
    let distance = data.distance;
    let gps_fix = data.gps_fix;
    let session_id = data.session_id;
    let paused = data.paused;
    let achievement = data.latest_achievement;
    let gps_mode = data.gps_mode || "off";

    // Header
    canvas.setFont("primary");
    canvas.drawStr(2, 10, "FLIPPER SNIFFER");

    canvas.setFont("secondary");

    // Session line
    canvas.drawStr(2, 20, "#" + session_id.substring(0, 6));

    // Timer + GPS
    let timer_str = format_time(duration);
    let gps_str;
    if (gps_mode === "off") {
        gps_str = "GPS:OFF";
    } else if (gps_fix) {
        gps_str = "GPS:OK";
    } else {
        gps_str = gps_mode === "phone" ? "BT:..." : "GPS:...";
    }
    canvas.drawStr(50, 20, timer_str + "|" + gps_str);

    // Distance
    if (gps_mode !== "off") {
        canvas.drawStr(2, 28, format_distance(distance) + " walked");
    }

    // Device counts
    let y_counts = gps_mode !== "off" ? 38 : 30;
    canvas.drawStr(2, y_counts, "BT:" + counts.bluetooth + " WiFi:" + counts.wifi + " NFC:" + counts.nfc);

    // Total
    canvas.drawStr(2, y_counts + 8, "Total: " + counts.total + " unique devices");

    // Paused indicator
    if (paused) {
        canvas.drawStr(82, 10, "[PAUSED]");
    }

    // Achievement notification
    if (achievement && (Date.now() - data.achievement_time) < 3000) {
        canvas.drawFrame(0, 50, 128, 14);
        canvas.drawStr(2, 60, achievement);
    }

    // Bottom buttons - highlight selected
    let btns = [paused ? "Resume" : "Pause", "End", "Stats"];
    let btn_x = [2, 48, 92];
    for (let b = 0; b < 3; b++) {
        let label = btns[b];
        if (b === ui_state.selected_button) {
            label = "[" + label + "]";
        } else {
            label = " " + label + " ";
        }
        canvas.drawStr(btn_x[b], 63, label);
    }
}

// ──────────────────────────────────────
//  SCREEN: STATS
// ──────────────────────────────────────

function draw_stats(canvas, data) {
    let counts = data.counts;

    canvas.setFont("primary");
    canvas.drawStr(2, 10, "SESSION STATS");

    canvas.setFont("secondary");

    canvas.drawStr(2, 22, "Unique BT:   " + counts.bluetooth);
    canvas.drawStr(2, 30, "Unique WiFi: " + counts.wifi);
    canvas.drawStr(2, 38, "Unique NFC:  " + counts.nfc);
    canvas.drawStr(2, 46, "Distance:    " + format_distance(data.distance));
    canvas.drawStr(2, 54, "Duration:    " + format_time(data.duration));

    canvas.drawStr(30, 63, "[< Back]");
}

// ──────────────────────────────────────
//  SCREEN: CONFIRM END
// ──────────────────────────────────────

function draw_confirm_end(canvas) {
    canvas.setFont("primary");
    canvas.drawStr(15, 20, "END SESSION?");

    canvas.setFont("secondary");
    canvas.drawStr(10, 35, "Data will be exported");
    canvas.drawStr(10, 43, "to SD card as JSON.");

    canvas.drawStr(10, 58, "[OK: End]");
    canvas.drawStr(65, 58, "[Back: Cancel]");
}

// ──────────────────────────────────────
//  SCREEN: SAVE COMPLETE
// ──────────────────────────────────────

function draw_save_complete(canvas, filename) {
    canvas.setFont("primary");
    canvas.drawStr(15, 15, "SESSION SAVED!");

    canvas.setFont("secondary");
    canvas.drawStr(5, 30, "Exported to:");
    canvas.drawStr(5, 40, filename || "/ext/exports/");

    canvas.drawStr(20, 55, "[OK to exit]");
}

// ──────────────────────────────────────
//  RENDER DISPATCHER
// ──────────────────────────────────────

function render(data) {
    gui.viewDispatcherSendCustomEvent(gui.viewDispatcher, 0);

    return function (c) {
        canvas = c;
        canvas.clear();

        switch (ui_state.screen) {
            case "start":
                draw_start(canvas, data);
                break;
            case "settings":
                draw_settings(canvas, data);
                break;
            case "main":
                draw_main(canvas, data);
                break;
            case "stats":
                draw_stats(canvas, data);
                break;
            case "confirm_end":
                draw_confirm_end(canvas);
                break;
            case "save_complete":
                draw_save_complete(canvas, data.filename);
                break;
        }
    };
}

// ──────────────────────────────────────
//  INPUT HANDLING
// ──────────────────────────────────────

function handle_input(key, data) {
    switch (ui_state.screen) {

        // ─── START SCREEN ───
        case "start":
            if (key === "ok") {
                if (ui_state.selected_button === 0) {
                    ui_state.screen = "settings";
                    ui_state.settings_cursor = 0;
                    return "open_settings";
                } else {
                    ui_state.screen = "main";
                    ui_state.selected_button = 0;
                    return "start_session";
                }
            }
            if (key === "left") {
                ui_state.selected_button = 0;
                return "navigate";
            }
            if (key === "right") {
                ui_state.selected_button = 1;
                return "navigate";
            }
            if (key === "back") {
                return "exit";
            }
            break;

        // ─── SETTINGS SCREEN ───
        case "settings":
            if (key === "up") {
                ui_state.settings_cursor = Math.max(0, ui_state.settings_cursor - 1);
                return "navigate";
            }
            if (key === "down") {
                let menu_len = (data && data.settings_menu) ? data.settings_menu.length : 0;
                ui_state.settings_cursor = Math.min(menu_len - 1, ui_state.settings_cursor + 1);
                return "navigate";
            }
            if (key === "right") {
                return "setting_next:" + ui_state.settings_cursor;
            }
            if (key === "left") {
                return "setting_prev:" + ui_state.settings_cursor;
            }
            if (key === "back" || key === "ok") {
                ui_state.screen = "start";
                ui_state.selected_button = 1; // pre-select START
                return "save_settings";
            }
            break;

        // ─── MAIN SCANNING SCREEN ───
        case "main":
            if (key === "ok") {
                switch (ui_state.selected_button) {
                    case 0: return "toggle_pause";
                    case 1:
                        ui_state.screen = "confirm_end";
                        return "screen_change";
                    case 2:
                        ui_state.screen = "stats";
                        return "screen_change";
                }
            }
            if (key === "right") {
                ui_state.selected_button = Math.min(2, ui_state.selected_button + 1);
                return "navigate";
            }
            if (key === "left") {
                ui_state.selected_button = Math.max(0, ui_state.selected_button - 1);
                return "navigate";
            }
            break;

        // ─── STATS SCREEN ───
        case "stats":
            if (key === "back" || key === "ok") {
                ui_state.screen = "main";
                return "screen_change";
            }
            break;

        // ─── CONFIRM END ───
        case "confirm_end":
            if (key === "ok") {
                return "end_session";
            }
            if (key === "back") {
                ui_state.screen = "main";
                return "screen_change";
            }
            break;

        // ─── SAVE COMPLETE ───
        case "save_complete":
            if (key === "ok" || key === "back") {
                return "exit";
            }
            break;
    }

    return null;
}

// ──────────────────────────────────────
//  PUBLIC HELPERS
// ──────────────────────────────────────

function set_screen(screen) {
    ui_state.screen = screen;
}

function get_screen() {
    return ui_state.screen;
}

function show_notification(text) {
    ui_state.notification = text;
    ui_state.notification_time = Date.now();
}

module.exports = {
    init: ui_init,
    render: render,
    handle_input: handle_input,
    set_screen: set_screen,
    get_screen: get_screen,
    show_notification: show_notification,
    format_time: format_time,
    format_distance: format_distance,
};
