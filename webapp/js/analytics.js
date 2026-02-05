// FlipperSniffer - Analytics Module
// Computes gamified metrics from session data

var Analytics = (function () {
    // Device value estimates (in EUR) for economy scoring
    var DEVICE_VALUES = {
        "iPhone 15": 1200, "iPhone 14 Pro": 1100, "iPhone": 900,
        "MacBook Pro": 2500, "MacBook": 1800,
        "iPad": 700, "AirPods Pro": 250, "AirPods Max": 550,
        "Apple Watch": 450, "HomePod mini": 100,
        "Galaxy S24": 900, "Galaxy S23": 700, "Galaxy A54": 350,
        "Galaxy Buds2": 120, "Galaxy Watch5": 280, "Galaxy Tab S9": 800,
        "Pixel 8": 700, "Pixel 7a": 400, "Pixel Buds Pro": 200,
        "Nest Mini": 50,
        "Redmi Note 12": 200, "Poco F5": 350, "Mi Band 8": 40, "Xiaomi 14": 600,
        "OnePlus 12": 700, "Sony WH-1000XM5": 350, "Bose QC45": 280,
        "JBL Flip 6": 120, "Fitbit Versa": 200, "Garmin Fenix": 600,
        "Surface Pro": 1200, "ThinkPad X1": 1500
    };

    // Fallback values by brand
    var BRAND_AVG_VALUE = {
        "Apple": 800,
        "Samsung": 500,
        "Google": 500,
        "Xiaomi": 250,
        "Huawei": 400,
        "Sony": 300,
        "Microsoft": 1000,
        "IoT": 50,
        "Other": 300
    };

    // Compute economy score (0-100)
    function computeEconomyScore(data) {
        var devices = data.devices.bluetooth || [];
        if (devices.length === 0) return { score: 0, label: "No Data" };

        var totalValue = 0;
        devices.forEach(function (dev) {
            var value = estimateDeviceValue(dev);
            totalValue += value;
        });

        var avgValue = totalValue / devices.length;

        // Normalize to 0-100 scale (300 EUR avg = ~50, 1000 EUR avg = ~90)
        var score = Math.min(100, Math.max(0, Math.round((avgValue / 10) + 10)));

        var label;
        if (score >= 85) label = "Affluent District";
        else if (score >= 70) label = "Upper-Middle Class";
        else if (score >= 55) label = "Middle Class";
        else if (score >= 40) label = "Working Class";
        else label = "Budget-Friendly Area";

        return {
            score: score,
            label: label,
            avgDeviceValue: Math.round(avgValue),
            totalValue: Math.round(totalValue)
        };
    }

    function estimateDeviceValue(device) {
        // Try exact name match
        for (var key in DEVICE_VALUES) {
            if (device.name && device.name.indexOf(key) !== -1) {
                return DEVICE_VALUES[key];
            }
        }
        // Fallback to brand average
        return BRAND_AVG_VALUE[device.brand] || 300;
    }

    // Estimate average income
    function computeIncomeEstimate(data) {
        var economy = computeEconomyScore(data);
        // Map economy score to income estimate
        // Score 50 -> ~40k, Score 80 -> ~75k, Score 100 -> ~120k
        var income = Math.round(economy.score * 1000 + 10000);
        // Add some variation based on device density
        var devices = data.devices.bluetooth || [];
        var density = devices.length / Math.max(0.1, data.session.distance_km || 1);
        // Higher density in richer areas
        income += Math.round(density * 50);
        return Math.round(income / 1000) * 1000;
    }

    // Compute danger/security risk score (0-10)
    function computeDangerScore(data) {
        var stats = data.stats || {};
        var wifiCount = (data.devices.wifi || []).length;
        if (wifiCount === 0) return { score: 0, label: "No WiFi Data", level: "low" };

        var rawScore = 0;
        rawScore += (stats.open_wifi_count || 0) * 1.5;
        rawScore += (stats.wep_networks || 0) * 3;
        rawScore += (stats.wpa_networks || 0) * 0.5;
        rawScore -= (stats.wpa3_networks || 0) * 0.5;
        rawScore += (stats.iot_count || 0) * 0.3;

        // Normalize to 0-10
        var score = Math.min(10, Math.max(0, Math.round(rawScore * 10 / wifiCount * 10) / 10));
        // Round to 1 decimal
        score = Math.round(score * 10) / 10;

        var label, level;
        if (score <= 3) { label = "Low Risk"; level = "low"; }
        else if (score <= 6) { label = "Moderate Risk"; level = "medium"; }
        else { label = "High Risk - Vulnerable Networks Detected"; level = "high"; }

        return {
            score: score,
            label: label,
            level: level,
            details: {
                open: stats.open_wifi_count || 0,
                wep: stats.wep_networks || 0,
                wpa: stats.wpa_networks || 0,
                wpa2: stats.wpa2_networks || 0,
                wpa3: stats.wpa3_networks || 0
            }
        };
    }

    // Compute tech tribe distribution
    function computeTechTribes(data) {
        var devices = data.devices.bluetooth || [];
        var total = devices.length;
        if (total === 0) return [];

        var counts = {};
        devices.forEach(function (dev) {
            var brand = dev.brand || "Other";
            counts[brand] = (counts[brand] || 0) + 1;
        });

        var tribes = [];
        var brandColors = {
            "Apple": "#a2aaad",
            "Samsung": "#1428a0",
            "Google": "#4285f4",
            "Xiaomi": "#ff6900",
            "Huawei": "#cf0a2c",
            "Sony": "#000080",
            "Microsoft": "#00a4ef",
            "IoT": "#00cc99",
            "Other": "#6b7280"
        };

        for (var brand in counts) {
            tribes.push({
                name: brand,
                count: counts[brand],
                percentage: Math.round((counts[brand] / total) * 100),
                color: brandColors[brand] || "#6b7280"
            });
        }

        // Sort by count descending
        tribes.sort(function (a, b) { return b.count - a.count; });

        return tribes;
    }

    // Build discovery timeline data
    function computeTimeline(data) {
        var allDevices = [];

        (data.devices.bluetooth || []).forEach(function (d) {
            allDevices.push({ timestamp: d.timestamp, type: "bt" });
        });
        (data.devices.wifi || []).forEach(function (d) {
            allDevices.push({ timestamp: d.timestamp, type: "wifi" });
        });

        // Sort by timestamp
        allDevices.sort(function (a, b) { return a.timestamp - b.timestamp; });

        if (allDevices.length === 0) return { labels: [], bt: [], wifi: [], total: [] };

        // Group into time buckets (1-minute intervals)
        var startTime = data.session.start_time;
        var endTime = data.session.end_time || Date.now();
        var bucketSize = 60000; // 1 minute
        var numBuckets = Math.ceil((endTime - startTime) / bucketSize);
        numBuckets = Math.min(numBuckets, 120); // max 120 buckets

        var labels = [];
        var btCumulative = [];
        var wifiCumulative = [];
        var totalCumulative = [];
        var btCount = 0;
        var wifiCount = 0;
        var deviceIdx = 0;

        for (var b = 0; b < numBuckets; b++) {
            var bucketEnd = startTime + ((b + 1) * bucketSize);
            while (deviceIdx < allDevices.length && allDevices[deviceIdx].timestamp <= bucketEnd) {
                if (allDevices[deviceIdx].type === "bt") btCount++;
                else wifiCount++;
                deviceIdx++;
            }

            var minutes = (b + 1);
            labels.push(minutes + "m");
            btCumulative.push(btCount);
            wifiCumulative.push(wifiCount);
            totalCumulative.push(btCount + wifiCount);
        }

        return {
            labels: labels,
            bt: btCumulative,
            wifi: wifiCumulative,
            total: totalCumulative
        };
    }

    // Compute brand distribution for pie chart
    function computeBrandDistribution(data) {
        var tribes = computeTechTribes(data);
        var labels = [];
        var values = [];
        var colors = [];

        tribes.forEach(function (t) {
            labels.push(t.name);
            values.push(t.count);
            colors.push(t.color);
        });

        return { labels: labels, values: values, colors: colors };
    }

    // Compute WiFi security distribution
    function computeSecurityDistribution(data) {
        var stats = data.stats || {};
        return {
            labels: ["WPA3", "WPA2", "WPA", "WEP", "Open"],
            values: [
                stats.wpa3_networks || 0,
                stats.wpa2_networks || 0,
                stats.wpa_networks || 0,
                stats.wep_networks || 0,
                stats.open_wifi_count || 0
            ],
            colors: ["#00ff41", "#00cc33", "#ffaa00", "#ff0040", "#ff0040"]
        };
    }

    // Format duration in seconds to readable string
    function formatDuration(seconds) {
        var h = Math.floor(seconds / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        var s = seconds % 60;
        if (h > 0) return h + "h " + m + "m";
        return m + "m " + s + "s";
    }

    return {
        computeEconomyScore: computeEconomyScore,
        computeIncomeEstimate: computeIncomeEstimate,
        computeDangerScore: computeDangerScore,
        computeTechTribes: computeTechTribes,
        computeTimeline: computeTimeline,
        computeBrandDistribution: computeBrandDistribution,
        computeSecurityDistribution: computeSecurityDistribution,
        formatDuration: formatDuration
    };
})();
