// FlipperSniffer - Achievements Module
// Renders achievement badges

var Achievements = (function () {
    // Achievement icon mapping
    var ICONS = {
        star: "\u2B50",
        satellite: "\uD83D\uDEF0\uFE0F",
        trophy: "\uD83C\uDFC6",
        footprints: "\uD83D\uDC63",
        city: "\uD83C\uDF06",
        wifi: "\uD83D\uDCF6",
        apple: "\uD83C\uDF4E",
        crown: "\uD83D\uDC51",
        runner: "\uD83C\uDFC3",
        lock_open: "\uD83D\uDD13",
        owl: "\uD83E\uDD89",
        clock: "\u23F0",
        default: "\uD83C\uDFAF"
    };

    // Default achievements if session data doesn't include them
    var DEFAULT_ACHIEVEMENTS = {
        first_10:     { title: "Getting Started",   description: "10 devices found",      icon: "star" },
        first_50:     { title: "Signal Scout",      description: "50 devices found",      icon: "satellite" },
        first_100:    { title: "Century Club",       description: "100 devices found",     icon: "trophy" },
        first_500:    { title: "Spectrum Overlord",  description: "500 devices found",     icon: "crown" },
        walker_1km:   { title: "Casual Stroll",     description: "Walked 1km",            icon: "footprints" },
        walker_5km:   { title: "Urban Explorer",    description: "Walked 5km",            icon: "city" },
        walker_10km:  { title: "Marathon Hacker",   description: "Walked 10km",           icon: "runner" },
        wifi_hunter:  { title: "WiFi Hunter",       description: "50 WiFi networks",      icon: "wifi" },
        apple_valley: { title: "Silicon Valley",    description: "50+ Apple devices",     icon: "apple" },
        open_sesame:  { title: "Open Sesame",       description: "10 open WiFi networks", icon: "lock_open" },
        night_owl:    { title: "Night Owl",         description: "Session 10pm-6am",      icon: "owl" },
        long_session: { title: "Endurance",         description: "1 hour+ session",       icon: "clock" }
    };

    function init(data) {
        var container = document.getElementById("achievements-container");
        if (!container) return;
        container.innerHTML = "";

        var achievements;
        if (data.achievements) {
            achievements = data.achievements;
        } else {
            achievements = computeAchievements(data);
        }

        // Render unlocked first
        if (achievements.unlocked) {
            achievements.unlocked.forEach(function (a) {
                container.appendChild(createBadge(a, true));
            });
        }

        // Then locked
        if (achievements.locked) {
            achievements.locked.forEach(function (a) {
                container.appendChild(createBadge(a, false));
            });
        }
    }

    function computeAchievements(data) {
        var stats = data.stats || {};
        var session = data.session || {};
        var totalDevices = (stats.unique_devices_bt || 0) + (stats.unique_devices_wifi || 0) + (stats.unique_devices_nfc || 0);
        var distance = session.distance_km || 0;
        var duration = session.duration || 0;

        var unlocked = [];
        var locked = [];

        function check(id, condition) {
            var def = DEFAULT_ACHIEVEMENTS[id];
            var entry = { id: id, title: def.title, description: def.description, icon: def.icon };
            if (condition) {
                unlocked.push(entry);
            } else {
                locked.push(entry);
            }
        }

        check("first_10", totalDevices >= 10);
        check("first_50", totalDevices >= 50);
        check("first_100", totalDevices >= 100);
        check("first_500", totalDevices >= 500);
        check("walker_1km", distance >= 1);
        check("walker_5km", distance >= 5);
        check("walker_10km", distance >= 10);
        check("wifi_hunter", (stats.unique_devices_wifi || 0) >= 50);
        check("apple_valley", (stats.apple_total || 0) >= 50);
        check("open_sesame", (stats.open_wifi_count || 0) >= 10);
        check("long_session", duration >= 3600);

        // Night owl - check session time
        var hour = new Date(session.start_time).getHours();
        check("night_owl", hour >= 22 || hour < 6);

        return {
            unlocked: unlocked,
            locked: locked,
            total_unlocked: unlocked.length,
            total: unlocked.length + locked.length
        };
    }

    function createBadge(achievement, isUnlocked) {
        var badge = document.createElement("div");
        badge.className = "achievement-badge " + (isUnlocked ? "unlocked" : "locked");

        var iconStr = ICONS[achievement.icon] || ICONS["default"];

        badge.innerHTML =
            '<div class="achievement-icon">' + iconStr + '</div>' +
            '<div class="achievement-info">' +
                '<div class="achievement-title">' + achievement.title + '</div>' +
                '<div class="achievement-desc">' + achievement.description + '</div>' +
                (isUnlocked ? '' : '<div class="achievement-progress">LOCKED</div>') +
            '</div>';

        return badge;
    }

    function getUnlockedCount(data) {
        if (data.achievements) return data.achievements.total_unlocked || 0;
        var computed = computeAchievements(data);
        return computed.total_unlocked;
    }

    return {
        init: init,
        getUnlockedCount: getUnlockedCount
    };
})();
