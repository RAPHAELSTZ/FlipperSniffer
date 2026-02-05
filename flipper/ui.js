// FlipperSniffer - UI Module
// Flipper Zero display rendering

let gui = require("gui");
let canvas = null;

// UI state
let ui_state = {
    screen: "main",     // main, stats, achievements, confirm_end
    notification: "",
    notification_time: 0,
    selected_button: 0, // 0 = Pause, 1 = End, 2 = Stats
};

// Format seconds to HH:MM:SS
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

// Format distance
function format_distance(km) {
    if (km < 1) {
        return Math.round(km * 1000) + "m";
    }
    return (Math.round(km * 100) / 100) + "km";
}

// Initialize GUI
function ui_init() {
    gui.viewDispatcherSetView(gui.viewDispatcher, 0);
    print("[UI] Initialized");
}

// Draw main scanning screen
function draw_main(canvas, data) {
    let counts = data.counts;
    let duration = data.duration;
    let distance = data.distance;
    let gps_fix = data.gps_fix;
    let session_id = data.session_id;
    let paused = data.paused;
    let achievement = data.latest_achievement;

    // Header
    canvas.setFont("primary");
    canvas.drawStr(2, 10, "FLIPPER SNIFFER");

    canvas.setFont("secondary");

    // Session info line
    canvas.drawStr(2, 20, "Session: #" + session_id.substring(0, 6));

    // Timer + GPS status
    let timer_str = format_time(duration);
    let gps_str = gps_fix ? "GPS:LOCK" : "GPS:---";
    canvas.drawStr(2, 28, timer_str + " | " + gps_str);

    // Distance
    canvas.drawStr(2, 36, format_distance(distance) + " walked");

    // Device counts
    canvas.drawStr(2, 46, "BT:" + counts.bluetooth + " WiFi:" + counts.wifi + " NFC:" + counts.nfc);

    // Paused indicator
    if (paused) {
        canvas.drawStr(40, 10, "[PAUSED]");
    }

    // Achievement notification
    if (achievement && (Date.now() - data.achievement_time) < 3000) {
        canvas.drawFrame(0, 50, 128, 14);
        canvas.drawStr(2, 60, achievement);
    }

    // Bottom button labels
    canvas.drawStr(2, 63, paused ? "[Resume]" : "[Pause]");
    canvas.drawStr(45, 63, "[End]");
    canvas.drawStr(85, 63, "[Stats]");
}

// Draw stats screen
function draw_stats(canvas, data) {
    let counts = data.counts;
    let stats = data.stats;

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

// Draw end session confirmation
function draw_confirm_end(canvas) {
    canvas.setFont("primary");
    canvas.drawStr(15, 20, "END SESSION?");

    canvas.setFont("secondary");
    canvas.drawStr(10, 35, "Data will be exported");
    canvas.drawStr(10, 43, "to SD card as JSON.");

    canvas.drawStr(10, 58, "[OK: End]");
    canvas.drawStr(65, 58, "[Back: Cancel]");
}

// Draw save complete screen
function draw_save_complete(canvas, filename) {
    canvas.setFont("primary");
    canvas.drawStr(15, 15, "SESSION SAVED!");

    canvas.setFont("secondary");
    canvas.drawStr(5, 30, "Exported to:");
    canvas.drawStr(5, 40, filename || "/ext/exports/");

    canvas.drawStr(20, 55, "[OK to exit]");
}

// Main render function
function render(data) {
    gui.viewDispatcherSendCustomEvent(gui.viewDispatcher, 0);

    // The render callback
    return function (c) {
        canvas = c;
        canvas.clear();

        switch (ui_state.screen) {
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

// Handle button input
function handle_input(key, data) {
    switch (ui_state.screen) {
        case "main":
            if (key === "ok") {
                // Selected button action
                switch (ui_state.selected_button) {
                    case 0: // Pause/Resume
                        return "toggle_pause";
                    case 1: // End
                        ui_state.screen = "confirm_end";
                        return "screen_change";
                    case 2: // Stats
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

        case "stats":
            if (key === "back" || key === "ok") {
                ui_state.screen = "main";
                return "screen_change";
            }
            break;

        case "confirm_end":
            if (key === "ok") {
                return "end_session";
            }
            if (key === "back") {
                ui_state.screen = "main";
                return "screen_change";
            }
            break;

        case "save_complete":
            if (key === "ok" || key === "back") {
                return "exit";
            }
            break;
    }

    return null;
}

// Set screen
function set_screen(screen) {
    ui_state.screen = screen;
}

// Show notification
function show_notification(text) {
    ui_state.notification = text;
    ui_state.notification_time = Date.now();
}

module.exports = {
    init: ui_init,
    render: render,
    handle_input: handle_input,
    set_screen: set_screen,
    show_notification: show_notification,
    format_time: format_time,
    format_distance: format_distance,
};
