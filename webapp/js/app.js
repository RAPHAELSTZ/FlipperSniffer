// FlipperSniffer - Main App Controller
// Orchestrates all modules

var App = (function () {
    function init() {
        Upload.init();
    }

    function loadSession(data) {
        // Switch screens
        document.getElementById("upload-screen").classList.remove("active");
        document.getElementById("dashboard-screen").classList.add("active");

        // Update header stats
        updateHeader(data);

        // Update metric cards
        updateMetrics(data);

        // Initialize map
        MapView.init(data);

        // Initialize charts
        Charts.init(data);

        // Initialize achievements
        Achievements.init(data);

        // Initialize share
        Share.init(data);

        // New session button
        var newBtn = document.getElementById("new-session-btn");
        if (newBtn) {
            newBtn.addEventListener("click", function () {
                Charts.destroyAll();
                document.getElementById("dashboard-screen").classList.remove("active");
                document.getElementById("upload-screen").classList.add("active");
            });
        }
    }

    function updateHeader(data) {
        var session = data.session;
        var stats = data.stats || {};
        var total = (stats.unique_devices_bt || 0) + (stats.unique_devices_wifi || 0) + (stats.unique_devices_nfc || 0);

        setText("header-session-id", "#" + (session.id || "------").substring(0, 6));
        setText("header-distance", (session.distance_km || 0) + " km");
        setText("header-duration", Analytics.formatDuration(session.duration || 0));
        setText("header-total", total + " devices");
    }

    function updateMetrics(data) {
        var stats = data.stats || {};

        // Economy score
        var economy = Analytics.computeEconomyScore(data);
        setText("economy-score", economy.score);
        setText("economy-label", economy.label);

        // Income estimate
        var income = Analytics.computeIncomeEstimate(data);
        setText("income-value", income.toLocaleString());

        // Danger score
        var danger = Analytics.computeDangerScore(data);
        var dangerEl = document.getElementById("danger-score");
        if (dangerEl) {
            dangerEl.textContent = danger.score;
            dangerEl.className = "big-number " + danger.level;
        }
        setText("danger-label", danger.label);

        // Danger progress bar
        var dangerBar = document.querySelector("#danger-bar .progress-fill");
        if (dangerBar) {
            dangerBar.style.width = (danger.score * 10) + "%";
            if (danger.level === "low") dangerBar.style.background = "var(--safe-green)";
            else if (danger.level === "medium") dangerBar.style.background = "var(--neon-yellow)";
            else dangerBar.style.background = "var(--danger-red)";
        }

        // Tech tribes
        var tribes = Analytics.computeTechTribes(data);
        renderTribes(tribes);

        // Device breakdown
        setText("bt-count", stats.unique_devices_bt || 0);
        setText("wifi-count", stats.unique_devices_wifi || 0);
        setText("nfc-count", stats.unique_devices_nfc || 0);
        setText("total-count", (stats.unique_devices_bt || 0) + (stats.unique_devices_wifi || 0) + (stats.unique_devices_nfc || 0));
    }

    function renderTribes(tribes) {
        var container = document.getElementById("tribes-container");
        if (!container) return;
        container.innerHTML = "";

        var maxCount = tribes.length > 0 ? tribes[0].count : 1;

        tribes.forEach(function (tribe) {
            var row = document.createElement("div");
            row.className = "tribe-row";

            var pct = tribe.percentage;
            var barWidth = Math.max(5, (tribe.count / maxCount) * 100);

            row.innerHTML =
                '<span class="tribe-name">' + tribe.name + '</span>' +
                '<div class="tribe-bar-bg">' +
                    '<div class="tribe-bar-fill" style="width:' + barWidth + '%;background:' + tribe.color + ';"></div>' +
                '</div>' +
                '<span class="tribe-pct">' + pct + '%</span>';

            container.appendChild(row);
        });
    }

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    // Auto-init on DOM ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    return {
        loadSession: loadSession
    };
})();
