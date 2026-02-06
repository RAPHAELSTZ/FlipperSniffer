// FlipperSniffer - GPS Merge Module
// Merges a Flipper session (devices with timestamps, no GPS)
// with a GPS track from the companion page (GPS points with timestamps)
// Matching is done by finding the closest GPS point for each device timestamp

var Merge = (function () {

    // Validate GPS track file format
    function validateTrack(data) {
        return (
            data &&
            data.type === "flipper_sniffer_gps_track" &&
            Array.isArray(data.points) &&
            data.points.length > 0
        );
    }

    // Find the closest GPS point to a given timestamp using binary search
    function findClosestPoint(points, timestamp) {
        if (points.length === 0) return null;
        if (points.length === 1) return points[0];

        var lo = 0;
        var hi = points.length - 1;

        // Binary search for closest timestamp
        while (lo < hi - 1) {
            var mid = Math.floor((lo + hi) / 2);
            if (points[mid].timestamp <= timestamp) {
                lo = mid;
            } else {
                hi = mid;
            }
        }

        // Compare the two candidates
        var diffLo = Math.abs(points[lo].timestamp - timestamp);
        var diffHi = Math.abs(points[hi].timestamp - timestamp);

        return diffLo <= diffHi ? points[lo] : points[hi];
    }

    // Merge session data with GPS track
    // Returns a new session object with GPS coordinates injected
    function mergeSessionWithTrack(sessionData, trackData) {
        if (!validateTrack(trackData)) {
            return { success: false, error: "Invalid GPS track file" };
        }

        // Sort GPS points by timestamp (should already be, but ensure)
        var sortedPoints = trackData.points.slice().sort(function (a, b) {
            return a.timestamp - b.timestamp;
        });

        var trackStart = sortedPoints[0].timestamp;
        var trackEnd = sortedPoints[sortedPoints.length - 1].timestamp;
        var merged = JSON.parse(JSON.stringify(sessionData)); // Deep clone
        var matchedDevices = 0;
        var unmatchedDevices = 0;
        var maxTimeDiff = 30000; // 30 seconds max gap

        // Merge Bluetooth devices
        if (merged.devices && merged.devices.bluetooth) {
            merged.devices.bluetooth.forEach(function (dev) {
                var ts = dev.timestamp || dev.first_seen || 0;
                if (ts === 0) { unmatchedDevices++; return; }

                var closest = findClosestPoint(sortedPoints, ts);
                var diff = Math.abs(closest.timestamp - ts);

                if (diff <= maxTimeDiff) {
                    dev.lat = closest.lat;
                    dev.lon = closest.lon;
                    matchedDevices++;
                } else {
                    unmatchedDevices++;
                }
            });
        }

        // Merge WiFi networks
        if (merged.devices && merged.devices.wifi) {
            merged.devices.wifi.forEach(function (net) {
                var ts = net.timestamp || net.first_seen || 0;
                if (ts === 0) { unmatchedDevices++; return; }

                var closest = findClosestPoint(sortedPoints, ts);
                var diff = Math.abs(closest.timestamp - ts);

                if (diff <= maxTimeDiff) {
                    net.lat = closest.lat;
                    net.lon = closest.lon;
                    matchedDevices++;
                } else {
                    unmatchedDevices++;
                }
            });
        }

        // Merge NFC tags
        if (merged.devices && merged.devices.nfc) {
            merged.devices.nfc.forEach(function (tag) {
                var ts = tag.timestamp || tag.first_seen || 0;
                if (ts === 0) { unmatchedDevices++; return; }

                var closest = findClosestPoint(sortedPoints, ts);
                var diff = Math.abs(closest.timestamp - ts);

                if (diff <= maxTimeDiff) {
                    tag.lat = closest.lat;
                    tag.lon = closest.lon;
                    matchedDevices++;
                } else {
                    unmatchedDevices++;
                }
            });
        }

        // Inject GPS path into session
        merged.session.path = sortedPoints.map(function (p) {
            return { lat: p.lat, lon: p.lon, timestamp: p.timestamp };
        });

        // Update distance from GPS track stats
        if (trackData.stats) {
            merged.session.distance_km = trackData.stats.distance_km || 0;
            merged.session.avg_speed = trackData.stats.avg_speed_kmh || 0;
        }

        return {
            success: true,
            data: merged,
            stats: {
                matched: matchedDevices,
                unmatched: unmatchedDevices,
                gps_points: sortedPoints.length,
                track_duration: Math.round((trackEnd - trackStart) / 1000),
                track_distance_km: trackData.stats ? trackData.stats.distance_km : 0
            }
        };
    }

    return {
        validateTrack: validateTrack,
        mergeSessionWithTrack: mergeSessionWithTrack
    };

})();
