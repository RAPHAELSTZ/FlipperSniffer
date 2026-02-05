// FlipperSniffer - Scanner Module
// BLE, WiFi, and NFC scanning with deduplication

let ble = require("ble");
let subghz = require("subghz");

// Known manufacturer OUI prefixes (first 3 bytes of MAC)
let OUI_DB = {
    "00:1A:7D": "Apple Inc.",
    "F8:FF:C2": "Apple Inc.",
    "A4:83:E7": "Apple Inc.",
    "AC:BC:32": "Apple Inc.",
    "D0:D2:B0": "Apple Inc.",
    "6C:4A:85": "Apple Inc.",
    "3C:E0:72": "Apple Inc.",
    "DC:A9:04": "Apple Inc.",
    "28:6A:BA": "Apple Inc.",
    "F0:B4:79": "Apple Inc.",
    "38:F9:D3": "Apple Inc.",
    "00:1E:C2": "Samsung",
    "94:35:0A": "Samsung",
    "AC:5F:3E": "Samsung",
    "CC:07:AB": "Samsung",
    "50:B7:C3": "Samsung",
    "10:D5:42": "Samsung",
    "E4:7D:BD": "Samsung",
    "3C:5A:B4": "Google",
    "F4:F5:D8": "Google",
    "54:60:09": "Google",
    "A4:77:33": "Google",
    "94:E9:79": "Xiaomi",
    "64:CE:D1": "Xiaomi",
    "7C:1C:4E": "Xiaomi",
    "78:11:DC": "Xiaomi",
    "FC:64:BA": "Xiaomi",
    "00:EC:0A": "Xiaomi",
    "D4:6A:6A": "Huawei",
    "48:46:FB": "Huawei",
    "70:8A:09": "Huawei",
    "A0:8C:F8": "Huawei",
    "00:26:AB": "Sony",
    "04:5D:4B": "Sony",
    "30:52:CB": "Sony",
    "B4:52:7E": "Sony",
    "00:17:C4": "Motorola",
    "68:C4:4D": "Motorola",
    "B8:27:EB": "Raspberry Pi",
    "DC:A6:32": "Raspberry Pi",
    "E4:5F:01": "Raspberry Pi",
    "00:15:5D": "Microsoft",
    "00:50:F2": "Microsoft",
    "7C:1E:52": "Microsoft",
    "28:18:78": "Microsoft",
    "00:23:76": "HTC",
    "D8:B1:2A": "HTC",
    "00:24:23": "AzureWave (IoT)",
    "AC:23:3F": "Shenzhen (IoT)",
    "B0:A7:B9": "Espressif (IoT)",
    "24:0A:C4": "Espressif (IoT)",
    "A4:CF:12": "Espressif (IoT)",
    "30:AE:A4": "Espressif (IoT)",
};

// Identify manufacturer from MAC address
function identify_manufacturer(mac) {
    if (!mac) return "Unknown";
    let prefix = mac.substring(0, 8).toUpperCase();
    return OUI_DB[prefix] || "Unknown";
}

// Classify device brand category
function classify_brand(manufacturer, name) {
    let n = (name || "").toLowerCase();

    if (manufacturer.indexOf("Apple") !== -1 || n.indexOf("iphone") !== -1 || n.indexOf("ipad") !== -1 || n.indexOf("macbook") !== -1 || n.indexOf("airpods") !== -1 || n.indexOf("apple") !== -1) {
        return "Apple";
    }
    if (manufacturer.indexOf("Samsung") !== -1 || n.indexOf("galaxy") !== -1 || n.indexOf("samsung") !== -1) {
        return "Samsung";
    }
    if (manufacturer.indexOf("Google") !== -1 || n.indexOf("pixel") !== -1 || n.indexOf("nest") !== -1) {
        return "Google";
    }
    if (manufacturer.indexOf("Xiaomi") !== -1 || n.indexOf("xiaomi") !== -1 || n.indexOf("redmi") !== -1 || n.indexOf("poco") !== -1) {
        return "Xiaomi";
    }
    if (manufacturer.indexOf("Huawei") !== -1 || n.indexOf("huawei") !== -1 || n.indexOf("honor") !== -1) {
        return "Huawei";
    }
    if (manufacturer.indexOf("Sony") !== -1 || n.indexOf("sony") !== -1 || n.indexOf("xperia") !== -1) {
        return "Sony";
    }
    if (manufacturer.indexOf("Microsoft") !== -1 || n.indexOf("surface") !== -1) {
        return "Microsoft";
    }
    if (manufacturer.indexOf("Raspberry") !== -1 || manufacturer.indexOf("Espressif") !== -1 || manufacturer.indexOf("IoT") !== -1) {
        return "IoT";
    }
    return "Other";
}

// Classify WiFi security level
function classify_security(security) {
    if (!security) return "Unknown";
    let s = security.toUpperCase();
    if (s.indexOf("WPA3") !== -1) return "WPA3";
    if (s.indexOf("WPA2") !== -1) return "WPA2";
    if (s.indexOf("WPA") !== -1) return "WPA";
    if (s.indexOf("WEP") !== -1) return "WEP";
    if (s === "OPEN" || s === "NONE" || s === "") return "Open";
    return security;
}

// Scanner state
let scan_state = {
    is_scanning: false,
    bt_callback: null,
    wifi_callback: null,
};

// Start BLE scanning
function start_ble_scan(callback) {
    scan_state.bt_callback = callback;
    scan_state.is_scanning = true;

    ble.setup();
    ble.startScan(function (device) {
        if (!scan_state.is_scanning) return;

        let mac = device.address || "";
        let name = device.name || "";
        let rssi = device.rssi || -100;
        let manufacturer = identify_manufacturer(mac);
        let brand = classify_brand(manufacturer, name);

        let result = {
            type: "bluetooth",
            mac: mac,
            name: name,
            rssi: rssi,
            manufacturer: manufacturer,
            brand: brand,
            timestamp: Date.now(),
        };

        if (scan_state.bt_callback) {
            scan_state.bt_callback(result);
        }
    });

    print("[Scanner] BLE scan started");
}

// Stop BLE scanning
function stop_ble_scan() {
    scan_state.is_scanning = false;
    ble.stopScan();
    print("[Scanner] BLE scan stopped");
}

// Start WiFi scanning (uses Flipper's WiFi dev board if available)
function start_wifi_scan(callback) {
    scan_state.wifi_callback = callback;

    // WiFi scanning via ESP32 UART bridge
    serial.setup("usart", 115200);
    serial.write("AT+WIFISCAN\r\n");

    // Read results
    let line = serial.readln(1000);
    while (line) {
        let parts = line.split(",");
        if (parts.length >= 5) {
            let result = {
                type: "wifi",
                bssid: parts[0] || "",
                ssid: parts[1] || "",
                channel: parseInt(parts[2]) || 0,
                security: classify_security(parts[3] || ""),
                rssi: parseInt(parts[4]) || -100,
                timestamp: Date.now(),
            };

            if (callback) {
                callback(result);
            }
        }
        line = serial.readln(1000);
    }
}

// Classify device type from name/manufacturer
function classify_device_type(name, manufacturer) {
    let n = (name || "").toLowerCase();

    if (n.indexOf("iphone") !== -1 || n.indexOf("pixel") !== -1 || n.indexOf("galaxy s") !== -1 || n.indexOf("galaxy a") !== -1 || n.indexOf("redmi") !== -1 || n.indexOf("xperia") !== -1) {
        return "phone";
    }
    if (n.indexOf("macbook") !== -1 || n.indexOf("surface") !== -1 || n.indexOf("thinkpad") !== -1 || n.indexOf("laptop") !== -1) {
        return "laptop";
    }
    if (n.indexOf("ipad") !== -1 || n.indexOf("tab") !== -1 || n.indexOf("galaxy tab") !== -1) {
        return "tablet";
    }
    if (n.indexOf("airpods") !== -1 || n.indexOf("buds") !== -1 || n.indexOf("headphone") !== -1 || n.indexOf("jbl") !== -1 || n.indexOf("bose") !== -1 || n.indexOf("sony wh") !== -1 || n.indexOf("sony wf") !== -1) {
        return "audio";
    }
    if (n.indexOf("watch") !== -1 || n.indexOf("band") !== -1 || n.indexOf("fitbit") !== -1 || n.indexOf("garmin") !== -1) {
        return "wearable";
    }
    if (manufacturer.indexOf("Espressif") !== -1 || manufacturer.indexOf("Raspberry") !== -1 || manufacturer.indexOf("IoT") !== -1) {
        return "iot";
    }
    return "unknown";
}

module.exports = {
    start_ble: start_ble_scan,
    stop_ble: stop_ble_scan,
    scan_wifi: start_wifi_scan,
    identify_manufacturer: identify_manufacturer,
    classify_brand: classify_brand,
    classify_security: classify_security,
    classify_device_type: classify_device_type,
};
