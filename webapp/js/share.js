// FlipperSniffer - Share Module
// Social sharing and share card generation

var Share = (function () {
    var sessionData = null;

    function init(data) {
        sessionData = data;
        renderShareCard(data);
        setupButtons();
    }

    function renderShareCard(data) {
        var container = document.getElementById("share-card");
        if (!container) return;

        var session = data.session;
        var stats = data.stats || {};
        var economy = Analytics.computeEconomyScore(data);
        var danger = Analytics.computeDangerScore(data);
        var achievementCount = Achievements.getUnlockedCount(data);
        var totalBT = stats.unique_devices_bt || 0;
        var totalWiFi = stats.unique_devices_wifi || 0;
        var totalNFC = stats.unique_devices_nfc || 0;
        var total = totalBT + totalWiFi + totalNFC;

        container.innerHTML =
            '<div class="share-card-header">FLIPPER SNIFFER</div>' +
            '<div class="share-card-stats">' +
                '<div>I just WarDrove ' + (session.distance_km || 0) + 'km!</div>' +
                '<br>' +
                '<div>' + totalBT + ' BT devices | ' + totalWiFi + ' WiFi networks' + (totalNFC > 0 ? ' | ' + totalNFC + ' NFC tags' : '') + '</div>' +
                '<div>Neighbourhood Score: ' + economy.score + '/100 (' + economy.label + ')</div>' +
                '<div>Security Risk: ' + danger.score + '/10 (' + danger.label + ')</div>' +
                '<div>Achievements: ' + achievementCount + ' unlocked!</div>' +
            '</div>' +
            '<div class="share-card-footer">' +
                '#FlipperSniffer #WarDriving #CyberPunk' +
            '</div>';
    }

    function getShareText(data) {
        var session = data.session;
        var stats = data.stats || {};
        var economy = Analytics.computeEconomyScore(data);
        var danger = Analytics.computeDangerScore(data);
        var achievementCount = Achievements.getUnlockedCount(data);
        var totalBT = stats.unique_devices_bt || 0;
        var totalWiFi = stats.unique_devices_wifi || 0;

        var text =
            "I just WarDrove " + (session.distance_km || 0) + "km!\n\n" +
            totalBT + " BT devices | " + totalWiFi + " WiFi networks\n" +
            "Neighbourhood Score: " + economy.score + "/100\n" +
            "Security Risk: " + danger.score + "/10\n" +
            "Achievements: " + achievementCount + " unlocked!\n\n" +
            "#FlipperSniffer #WarDriving";

        return text;
    }

    function setupButtons() {
        var twitterBtn = document.getElementById("share-twitter");
        var mastodonBtn = document.getElementById("share-mastodon");
        var downloadBtn = document.getElementById("share-download");
        var copyBtn = document.getElementById("share-copy");

        if (twitterBtn) {
            twitterBtn.addEventListener("click", function () {
                var text = getShareText(sessionData);
                var url = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text);
                window.open(url, "_blank", "width=550,height=420");
            });
        }

        if (mastodonBtn) {
            mastodonBtn.addEventListener("click", function () {
                var text = getShareText(sessionData);
                var instance = prompt("Enter your Mastodon instance (e.g., mastodon.social):", "mastodon.social");
                if (instance) {
                    var url = "https://" + instance + "/share?text=" + encodeURIComponent(text);
                    window.open(url, "_blank");
                }
            });
        }

        if (downloadBtn) {
            downloadBtn.addEventListener("click", function () {
                downloadShareCard();
            });
        }

        if (copyBtn) {
            copyBtn.addEventListener("click", function () {
                var text = getShareText(sessionData);
                navigator.clipboard.writeText(text).then(function () {
                    copyBtn.textContent = "COPIED!";
                    setTimeout(function () {
                        copyBtn.textContent = "COPY STATS";
                    }, 2000);
                }).catch(function () {
                    // Fallback
                    var ta = document.createElement("textarea");
                    ta.value = text;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand("copy");
                    document.body.removeChild(ta);
                    copyBtn.textContent = "COPIED!";
                    setTimeout(function () {
                        copyBtn.textContent = "COPY STATS";
                    }, 2000);
                });
            });
        }
    }

    function downloadShareCard() {
        var card = document.getElementById("share-card");
        if (!card || typeof html2canvas === "undefined") {
            alert("Screenshot capture not available. Try copying the stats instead.");
            return;
        }

        html2canvas(card, {
            backgroundColor: "#0a0e1a",
            scale: 2
        }).then(function (canvas) {
            var link = document.createElement("a");
            link.download = "flippersniffer_session_" + (sessionData.session.id || "export") + ".png";
            link.href = canvas.toDataURL("image/png");
            link.click();
        });
    }

    return {
        init: init,
        getShareText: getShareText
    };
})();
