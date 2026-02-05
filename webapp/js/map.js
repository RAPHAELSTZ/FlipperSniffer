// FlipperSniffer - Map Module
// Leaflet.js integration with dark theme

var MapView = (function () {
    var map = null;
    var layers = {
        path: null,
        bluetooth: null,
        wifi: null,
        heatmap: null
    };
    var layerVisibility = {
        path: true,
        bluetooth: true,
        wifi: true,
        heatmap: false
    };

    var BRAND_COLORS = {
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

    function init(data) {
        // Destroy existing map if any
        if (map) {
            map.remove();
            map = null;
        }

        var path = data.session.path || [];
        var center = [48.8566, 2.3522]; // Default Paris
        if (path.length > 0) {
            center = [path[0].lat, path[0].lon];
        }

        map = L.map("map", {
            center: center,
            zoom: 15,
            zoomControl: true
        });

        // Dark tile layer
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: "abcd",
            maxZoom: 19
        }).addTo(map);

        // Create layers
        createPathLayer(data);
        createBluetoothLayer(data);
        createWifiLayer(data);
        createHeatmapLayer(data);

        // Show visible layers
        updateLayerVisibility();

        // Fit bounds to path
        if (path.length > 1) {
            var bounds = L.latLngBounds(path.map(function (p) { return [p.lat, p.lon]; }));
            map.fitBounds(bounds, { padding: [30, 30] });
        }

        // Setup toggle buttons
        setupToggleButtons();
    }

    function createPathLayer(data) {
        var path = data.session.path || [];
        if (path.length < 2) return;

        var pathGroup = L.layerGroup();

        // Walking path polyline
        var coords = path.map(function (p) { return [p.lat, p.lon]; });
        var polyline = L.polyline(coords, {
            color: "#00ff41",
            weight: 3,
            opacity: 0.8,
            dashArray: null
        });
        pathGroup.addLayer(polyline);

        // Start marker
        var startIcon = L.divIcon({
            className: "custom-marker start-marker",
            html: '<div style="background:#00ff41;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 10px #00ff41;"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });
        L.marker([path[0].lat, path[0].lon], { icon: startIcon })
            .bindPopup("<b>START</b>")
            .addTo(pathGroup);

        // End marker
        if (path.length > 1) {
            var last = path[path.length - 1];
            var endIcon = L.divIcon({
                className: "custom-marker end-marker",
                html: '<div style="background:#ff006e;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 10px #ff006e;"></div>',
                iconSize: [14, 14],
                iconAnchor: [7, 7]
            });
            L.marker([last.lat, last.lon], { icon: endIcon })
                .bindPopup("<b>END</b>")
                .addTo(pathGroup);
        }

        layers.path = pathGroup;
    }

    function createBluetoothLayer(data) {
        var devices = data.devices.bluetooth || [];
        var btGroup = L.layerGroup();

        devices.forEach(function (dev) {
            if (!dev.lat || !dev.lon) return;

            var color = BRAND_COLORS[dev.brand] || BRAND_COLORS["Other"];
            var marker = L.circleMarker([dev.lat, dev.lon], {
                radius: 5,
                fillColor: color,
                color: "#ffffff",
                weight: 1,
                opacity: 0.8,
                fillOpacity: 0.6
            });

            var popupContent =
                "<b>" + (dev.name || "Unknown Device") + "</b><br>" +
                "<span style='color:" + color + "'>" + (dev.brand || "Unknown") + "</span><br>" +
                "MAC: <code>" + dev.mac + "</code><br>" +
                "RSSI: " + dev.rssi + " dBm<br>" +
                "Manufacturer: " + (dev.manufacturer || "Unknown");

            if (dev.detections && dev.detections > 1) {
                popupContent += "<br>Detections: " + dev.detections;
            }

            marker.bindPopup(popupContent);
            btGroup.addLayer(marker);
        });

        layers.bluetooth = btGroup;
    }

    function createWifiLayer(data) {
        var networks = data.devices.wifi || [];
        var wifiGroup = L.layerGroup();

        var SECURITY_COLORS = {
            "WPA3": "#00ff41",
            "WPA2": "#00cc33",
            "WPA": "#ffaa00",
            "WEP": "#ff0040",
            "Open": "#ff0040"
        };

        networks.forEach(function (net) {
            if (!net.lat || !net.lon) return;

            var color = SECURITY_COLORS[net.security] || "#808080";
            var marker = L.circleMarker([net.lat, net.lon], {
                radius: 7,
                fillColor: color,
                color: color,
                weight: 2,
                opacity: 0.9,
                fillOpacity: 0.3
            });

            var popupContent =
                "<b>" + (net.ssid || "Hidden Network") + "</b><br>" +
                "BSSID: <code>" + net.bssid + "</code><br>" +
                "Security: <span style='color:" + color + "'>" + net.security + "</span><br>" +
                "Channel: " + net.channel + "<br>" +
                "RSSI: " + net.rssi + " dBm";

            marker.bindPopup(popupContent);
            wifiGroup.addLayer(marker);
        });

        layers.wifi = wifiGroup;
    }

    function createHeatmapLayer(data) {
        var heatPoints = [];

        (data.devices.bluetooth || []).forEach(function (d) {
            if (d.lat && d.lon) {
                heatPoints.push([d.lat, d.lon, Math.abs(d.rssi) / 100]);
            }
        });

        (data.devices.wifi || []).forEach(function (d) {
            if (d.lat && d.lon) {
                heatPoints.push([d.lat, d.lon, Math.abs(d.rssi) / 100]);
            }
        });

        if (heatPoints.length > 0) {
            layers.heatmap = L.heatLayer(heatPoints, {
                radius: 25,
                blur: 15,
                maxZoom: 17,
                gradient: {
                    0.2: "#0a0e27",
                    0.4: "#1a1f3a",
                    0.6: "#00ff41",
                    0.8: "#ffaa00",
                    1.0: "#ff006e"
                }
            });
        }
    }

    function updateLayerVisibility() {
        for (var key in layers) {
            if (layers[key]) {
                if (layerVisibility[key]) {
                    map.addLayer(layers[key]);
                } else {
                    map.removeLayer(layers[key]);
                }
            }
        }
    }

    function setupToggleButtons() {
        var buttons = document.querySelectorAll(".map-toggle");
        buttons.forEach(function (btn) {
            btn.addEventListener("click", function () {
                var layer = btn.getAttribute("data-layer");
                layerVisibility[layer] = !layerVisibility[layer];
                btn.classList.toggle("active", layerVisibility[layer]);
                updateLayerVisibility();
            });
        });
    }

    return {
        init: init
    };
})();
