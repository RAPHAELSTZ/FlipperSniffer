// FlipperSniffer - Upload Module
// Handles file drag-and-drop and JSON parsing
// Supports: single session file, or session + GPS track for merge

var Upload = (function () {
    var dropZone = null;
    var fileInput = null;
    var fileInfo = null;
    var analyzeBtn = null;
    var demoBtn = null;
    var sessionData = null;

    // GPS track elements
    var gpsDropZone = null;
    var gpsFileInput = null;
    var gpsFileInfo = null;
    var gpsTrackData = null;

    function init() {
        dropZone = document.getElementById("drop-zone");
        fileInput = document.getElementById("file-input");
        fileInfo = document.getElementById("file-info");
        analyzeBtn = document.getElementById("analyze-btn");
        demoBtn = document.getElementById("demo-btn");

        // GPS track elements
        gpsDropZone = document.getElementById("gps-drop-zone");
        gpsFileInput = document.getElementById("gps-file-input");
        gpsFileInfo = document.getElementById("gps-file-info");

        // ─── Main session file ───
        dropZone.addEventListener("dragover", function (e) {
            e.preventDefault();
            dropZone.classList.add("drag-over");
        });

        dropZone.addEventListener("dragleave", function () {
            dropZone.classList.remove("drag-over");
        });

        dropZone.addEventListener("drop", function (e) {
            e.preventDefault();
            dropZone.classList.remove("drag-over");
            var files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFile(files[0]);
            }
        });

        dropZone.addEventListener("click", function () {
            fileInput.click();
        });

        fileInput.addEventListener("change", function () {
            if (fileInput.files.length > 0) {
                handleFile(fileInput.files[0]);
            }
        });

        // ─── GPS track file ───
        if (gpsDropZone) {
            gpsDropZone.addEventListener("dragover", function (e) {
                e.preventDefault();
                gpsDropZone.classList.add("drag-over");
            });

            gpsDropZone.addEventListener("dragleave", function () {
                gpsDropZone.classList.remove("drag-over");
            });

            gpsDropZone.addEventListener("drop", function (e) {
                e.preventDefault();
                gpsDropZone.classList.remove("drag-over");
                var files = e.dataTransfer.files;
                if (files.length > 0) {
                    handleGpsFile(files[0]);
                }
            });

            gpsDropZone.addEventListener("click", function () {
                gpsFileInput.click();
            });

            gpsFileInput.addEventListener("change", function () {
                if (gpsFileInput.files.length > 0) {
                    handleGpsFile(gpsFileInput.files[0]);
                }
            });
        }

        // ─── Analyze button ───
        analyzeBtn.addEventListener("click", function () {
            if (!sessionData) return;

            // If we have a GPS track, merge first
            if (gpsTrackData) {
                var result = Merge.mergeSessionWithTrack(sessionData, gpsTrackData);
                if (result.success) {
                    showMergeStats(result.stats);
                    App.loadSession(result.data);
                } else {
                    alert("GPS merge failed: " + result.error);
                }
            } else {
                App.loadSession(sessionData);
            }
        });

        // ─── Demo button ───
        demoBtn.addEventListener("click", function () {
            sessionData = generateDemoData();
            gpsTrackData = null;
            showFileInfo("demo_session.json");
            App.loadSession(sessionData);
        });
    }

    function handleFile(file) {
        if (!file.name.endsWith(".json")) {
            alert("Please upload a .json file exported from FlipperSniffer");
            return;
        }

        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var parsed = JSON.parse(e.target.result);

                // Auto-detect: is this a GPS track or a session file?
                if (parsed.type === "flipper_sniffer_gps_track") {
                    handleGpsTrackDetected(parsed, file.name);
                    return;
                }

                if (!validateSession(parsed)) {
                    alert("Invalid session file. Make sure it was exported from FlipperSniffer.");
                    return;
                }
                sessionData = parsed;
                showFileInfo(file.name);
                checkSessionNeedsGps(parsed);
            } catch (err) {
                alert("Error parsing JSON: " + err.message);
            }
        };
        reader.readAsText(file);
    }

    function handleGpsFile(file) {
        if (!file.name.endsWith(".json")) {
            alert("Please upload a .json GPS track file");
            return;
        }

        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var parsed = JSON.parse(e.target.result);

                if (!Merge.validateTrack(parsed)) {
                    alert("Invalid GPS track file. Use the GPS Companion page to record a track.");
                    return;
                }

                gpsTrackData = parsed;
                showGpsFileInfo(file.name, parsed);
            } catch (err) {
                alert("Error parsing GPS track: " + err.message);
            }
        };
        reader.readAsText(file);
    }

    // If user drops a GPS track in the main zone, auto-fill the GPS section
    function handleGpsTrackDetected(parsed, filename) {
        gpsTrackData = parsed;
        showGpsFileInfo(filename, parsed);
        var gpsSection = document.getElementById("gps-upload-section");
        if (gpsSection) gpsSection.classList.remove("hidden");
    }

    // Check if the session has GPS data or needs a companion track
    function checkSessionNeedsGps(data) {
        var hasGps = false;
        var path = data.session && data.session.path;
        if (path && path.length > 1) {
            hasGps = true;
        }
        if (!hasGps && data.devices && data.devices.bluetooth) {
            for (var i = 0; i < data.devices.bluetooth.length; i++) {
                if (data.devices.bluetooth[i].lat && data.devices.bluetooth[i].lon) {
                    hasGps = true;
                    break;
                }
            }
        }

        var gpsSection = document.getElementById("gps-upload-section");
        if (gpsSection) {
            gpsSection.classList.remove("hidden");
            var gpsHint = document.getElementById("gps-hint");
            if (gpsHint) {
                if (hasGps) {
                    gpsHint.textContent = "Session already has GPS data. Upload a track to override.";
                } else {
                    gpsHint.textContent = "No GPS data detected. Upload a companion GPS track to add location data.";
                }
            }
        }
    }

    function validateSession(data) {
        return (
            data &&
            data.session &&
            data.session.id &&
            data.devices &&
            (data.devices.bluetooth || data.devices.wifi)
        );
    }

    function showFileInfo(filename) {
        fileInfo.classList.remove("hidden");
        fileInfo.querySelector(".file-name").textContent = filename;
        analyzeBtn.classList.remove("hidden");
        analyzeBtn.disabled = false;
    }

    function showGpsFileInfo(filename, trackData) {
        if (!gpsFileInfo) return;
        gpsFileInfo.classList.remove("hidden");
        var pts = trackData.points ? trackData.points.length : 0;
        var dist = trackData.stats ? trackData.stats.distance_km : 0;
        gpsFileInfo.querySelector(".file-name").textContent = filename;
        var detailEl = gpsFileInfo.querySelector(".gps-detail");
        if (detailEl) {
            detailEl.textContent = pts + " GPS points, " + dist + " km";
        }
    }

    function showMergeStats(stats) {
        var total = stats.matched + stats.unmatched;
        var pct = total > 0 ? Math.round((stats.matched / total) * 100) : 0;
        console.log(
            "[Merge] " + stats.matched + "/" + total + " devices matched (" + pct + "%), " +
            stats.gps_points + " GPS points, " + stats.track_distance_km + " km track"
        );
    }

    function getData() {
        return sessionData;
    }

    return {
        init: init,
        getData: getData,
    };
})();
