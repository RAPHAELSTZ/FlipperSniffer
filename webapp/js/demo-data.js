// FlipperSniffer - Demo Data Generator
// Generates realistic sample data for testing without a Flipper Zero

function generateDemoData() {
    // Paris area coordinates (around Le Marais)
    var baseLat = 48.8566;
    var baseLon = 2.3522;
    var startTime = Date.now() - 1800000; // 30 min ago

    // Generate walking path (roughly 2.3 km walk)
    var path = [];
    var numPoints = 60;
    var currentLat = baseLat;
    var currentLon = baseLon;

    for (var i = 0; i < numPoints; i++) {
        currentLat += (Math.random() - 0.45) * 0.0004;
        currentLon += (Math.random() - 0.3) * 0.0005;
        path.push({
            lat: currentLat,
            lon: currentLon,
            timestamp: startTime + (i * 30000)
        });
    }

    // Manufacturer pools
    var appleNames = ["iPhone", "iPhone 15", "iPhone 14 Pro", "iPad", "MacBook Pro", "AirPods Pro", "Apple Watch", "AirPods Max", "HomePod mini"];
    var samsungNames = ["Galaxy S24", "Galaxy S23", "Galaxy A54", "Galaxy Buds2", "Galaxy Watch5", "Galaxy Tab S9"];
    var googleNames = ["Pixel 8", "Pixel 7a", "Pixel Buds Pro", "Nest Mini"];
    var xiaomiNames = ["Redmi Note 12", "Poco F5", "Mi Band 8", "Xiaomi 14"];
    var otherNames = ["OnePlus 12", "Sony WH-1000XM5", "Bose QC45", "JBL Flip 6", "Fitbit Versa", "Garmin Fenix", "Surface Pro", "ThinkPad X1"];

    var btDevices = [];
    var seenMacs = {};

    function randomMAC(prefix) {
        var hex = "0123456789ABCDEF";
        var mac = prefix;
        for (var j = 0; j < 3; j++) {
            mac += ":" + hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)];
        }
        return mac;
    }

    function addBTDevice(name, macPrefix, manufacturer, brand, count) {
        for (var k = 0; k < count; k++) {
            var mac = randomMAC(macPrefix);
            if (seenMacs[mac]) continue;
            seenMacs[mac] = true;

            var pathIdx = Math.floor(Math.random() * path.length);
            var p = path[pathIdx];
            btDevices.push({
                mac: mac,
                name: name + (count > 3 ? "" : ""),
                rssi: -30 - Math.floor(Math.random() * 60),
                lat: p.lat + (Math.random() - 0.5) * 0.001,
                lon: p.lon + (Math.random() - 0.5) * 0.001,
                timestamp: p.timestamp + Math.floor(Math.random() * 10000),
                manufacturer: manufacturer,
                brand: brand,
                device_type: name.toLowerCase().indexOf("phone") !== -1 || name.indexOf("iPhone") !== -1 || name.indexOf("Galaxy S") !== -1 || name.indexOf("Pixel") !== -1 || name.indexOf("Redmi") !== -1 ? "phone" :
                    name.indexOf("MacBook") !== -1 || name.indexOf("Surface") !== -1 || name.indexOf("ThinkPad") !== -1 ? "laptop" :
                    name.indexOf("AirPods") !== -1 || name.indexOf("Buds") !== -1 || name.indexOf("WH-") !== -1 || name.indexOf("QC") !== -1 || name.indexOf("JBL") !== -1 ? "audio" :
                    name.indexOf("Watch") !== -1 || name.indexOf("Band") !== -1 || name.indexOf("Fitbit") !== -1 || name.indexOf("Garmin") !== -1 ? "wearable" :
                    name.indexOf("iPad") !== -1 || name.indexOf("Tab") !== -1 ? "tablet" : "unknown",
                detections: 1 + Math.floor(Math.random() * 5)
            });
        }
    }

    // Generate ~147 BT devices
    appleNames.forEach(function(name) { addBTDevice(name, "F8:FF:C2", "Apple Inc.", "Apple", Math.floor(3 + Math.random() * 8)); });
    samsungNames.forEach(function(name) { addBTDevice(name, "94:35:0A", "Samsung", "Samsung", Math.floor(2 + Math.random() * 6)); });
    googleNames.forEach(function(name) { addBTDevice(name, "3C:5A:B4", "Google", "Google", Math.floor(1 + Math.random() * 4)); });
    xiaomiNames.forEach(function(name) { addBTDevice(name, "94:E9:79", "Xiaomi", "Xiaomi", Math.floor(1 + Math.random() * 3)); });
    otherNames.forEach(function(name) {
        var brand = name.indexOf("Sony") !== -1 ? "Sony" : name.indexOf("Surface") !== -1 ? "Microsoft" : name.indexOf("Fitbit") !== -1 || name.indexOf("Garmin") !== -1 ? "IoT" : "Other";
        addBTDevice(name, "00:26:AB", brand === "Sony" ? "Sony" : "Unknown", brand, Math.floor(1 + Math.random() * 3));
    });

    // WiFi networks
    var wifiNetworks = [];
    var ssids = [
        { ssid: "Freebox-A3F2B1", security: "WPA2" },
        { ssid: "Livebox-4521", security: "WPA2" },
        { ssid: "SFR_WiFi", security: "WPA2" },
        { ssid: "Bouygues Telecom Wi-Fi", security: "WPA2" },
        { ssid: "eduroam", security: "WPA2" },
        { ssid: "FreeWiFi", security: "Open" },
        { ssid: "FreeWifi_secure", security: "WPA2" },
        { ssid: "SFR WiFi FON", security: "Open" },
        { ssid: "Starbucks WiFi", security: "Open" },
        { ssid: "McDonalds_Free_WiFi", security: "Open" },
        { ssid: "Hotel_Guest", security: "WPA" },
        { ssid: "Cafe_Libre", security: "Open" },
        { ssid: "NETGEAR_5G", security: "WPA3" },
        { ssid: "TP-Link_2.4G", security: "WPA2" },
        { ssid: "HUAWEI-B535-AA21", security: "WPA2" },
        { ssid: "AndroidAP", security: "WPA2" },
        { ssid: "iPhone de Marie", security: "WPA2" },
        { ssid: "HP-Print-A2-LaserJet", security: "Open" },
        { ssid: "CanalBox-7788", security: "WPA2" },
        { ssid: "NUMERICABLE-3311", security: "WEP" },
        { ssid: "DIRECT-tv-samsung", security: "WPA2" },
        { ssid: "Chromecast.2847", security: "WPA2" },
        { ssid: "old_router_2005", security: "WEP" },
        { ssid: "Entreprise_Corp", security: "WPA3" },
        { ssid: "BBOX-12F456", security: "WPA2" }
    ];

    var seenBSSIDs = {};
    for (var w = 0; w < 89; w++) {
        var ssidInfo = ssids[w % ssids.length];
        var bssid = randomMAC("11:22:33");
        if (seenBSSIDs[bssid]) continue;
        seenBSSIDs[bssid] = true;

        var pathIdx2 = Math.floor(Math.random() * path.length);
        var p2 = path[pathIdx2];
        wifiNetworks.push({
            bssid: bssid,
            ssid: ssidInfo.ssid + (w > ssids.length ? "_" + w : ""),
            channel: [1, 6, 11, 36, 40, 44, 48][Math.floor(Math.random() * 7)],
            security: ssidInfo.security,
            rssi: -40 - Math.floor(Math.random() * 50),
            lat: p2.lat + (Math.random() - 0.5) * 0.001,
            lon: p2.lon + (Math.random() - 0.5) * 0.001,
            timestamp: p2.timestamp + Math.floor(Math.random() * 10000),
            detections: 1 + Math.floor(Math.random() * 8)
        });
    }

    // NFC tags
    var nfcTags = [
        { uid: "04:A1:B2:C3:D4:E5:F6", tag_type: "NTAG215" },
        { uid: "04:11:22:33:44:55:66", tag_type: "Mifare Classic 1K" },
        { uid: "04:AA:BB:CC:DD:EE:FF", tag_type: "NTAG213" }
    ];
    nfcTags.forEach(function(tag, idx) {
        var pIdx = Math.floor(Math.random() * path.length);
        var pp = path[pIdx];
        tag.lat = pp.lat;
        tag.lon = pp.lon;
        tag.timestamp = pp.timestamp;
    });

    // Compute stats
    var stats = {
        unique_devices_bt: btDevices.length,
        unique_devices_wifi: wifiNetworks.length,
        unique_devices_nfc: nfcTags.length,
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
        wpa3_networks: 0
    };

    btDevices.forEach(function(d) {
        if (d.brand === "Apple") stats.apple_total++;
        else if (d.brand === "Samsung") stats.samsung_count++;
        else if (d.brand === "Google") stats.google_count++;
        else if (d.brand === "Xiaomi") stats.xiaomi_count++;
        else if (d.brand === "IoT") stats.iot_count++;
        else stats.other_count++;
    });
    stats.iphone_count = Math.floor(stats.apple_total * 0.65);
    stats.android_count = stats.samsung_count + stats.google_count + stats.xiaomi_count;

    wifiNetworks.forEach(function(n) {
        if (n.security === "Open") stats.open_wifi_count++;
        else if (n.security === "WEP") stats.wep_networks++;
        else if (n.security === "WPA") stats.wpa_networks++;
        else if (n.security === "WPA2") stats.wpa2_networks++;
        else if (n.security === "WPA3") stats.wpa3_networks++;
    });

    // Achievements
    var achievements = {
        unlocked: [
            { id: "first_10", title: "Getting Started", description: "10 devices found", icon: "star" },
            { id: "first_50", title: "Signal Scout", description: "50 devices found", icon: "satellite" },
            { id: "first_100", title: "Century Club", description: "100 devices found", icon: "trophy" },
            { id: "walker_1km", title: "Casual Stroll", description: "Walked 1km", icon: "footprints" },
            { id: "walker_5km", title: "Urban Explorer", description: "Walked 5km", icon: "city" },
            { id: "wifi_hunter", title: "WiFi Hunter", description: "50 WiFi networks", icon: "wifi" },
            { id: "apple_valley", title: "Silicon Valley", description: "50+ Apple devices", icon: "apple" }
        ],
        locked: [
            { id: "first_500", title: "Spectrum Overlord", description: "500 devices found", icon: "crown" },
            { id: "walker_10km", title: "Marathon Hacker", description: "Walked 10km", icon: "runner" },
            { id: "open_sesame", title: "Open Sesame", description: "10 open WiFi networks", icon: "lock_open" },
            { id: "night_owl", title: "Night Owl", description: "Session 10pm-6am", icon: "owl" },
            { id: "long_session", title: "Endurance", description: "1 hour+ session", icon: "clock" }
        ],
        total_unlocked: 7,
        total: 12
    };

    return {
        session: {
            id: "a3f9b2c4",
            start_time: startTime,
            end_time: startTime + 1800000,
            duration: 1800,
            distance_km: 2.3,
            avg_speed: 4.6,
            path: path
        },
        devices: {
            bluetooth: btDevices,
            wifi: wifiNetworks,
            nfc: nfcTags
        },
        stats: stats,
        achievements: achievements
    };
}
