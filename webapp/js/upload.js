// FlipperSniffer - Upload Module
// Handles file drag-and-drop and JSON parsing

var Upload = (function () {
    var dropZone = null;
    var fileInput = null;
    var fileInfo = null;
    var analyzeBtn = null;
    var demoBtn = null;
    var sessionData = null;

    function init() {
        dropZone = document.getElementById("drop-zone");
        fileInput = document.getElementById("file-input");
        fileInfo = document.getElementById("file-info");
        analyzeBtn = document.getElementById("analyze-btn");
        demoBtn = document.getElementById("demo-btn");

        // Drag and drop events
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

        // Click to browse
        dropZone.addEventListener("click", function () {
            fileInput.click();
        });

        fileInput.addEventListener("change", function () {
            if (fileInput.files.length > 0) {
                handleFile(fileInput.files[0]);
            }
        });

        // Analyze button
        analyzeBtn.addEventListener("click", function () {
            if (sessionData) {
                App.loadSession(sessionData);
            }
        });

        // Demo button
        demoBtn.addEventListener("click", function () {
            sessionData = generateDemoData();
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
                sessionData = JSON.parse(e.target.result);
                if (!validateSession(sessionData)) {
                    alert("Invalid session file. Make sure it was exported from FlipperSniffer.");
                    return;
                }
                showFileInfo(file.name);
            } catch (err) {
                alert("Error parsing JSON: " + err.message);
            }
        };
        reader.readAsText(file);
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

    function getData() {
        return sessionData;
    }

    return {
        init: init,
        getData: getData,
    };
})();
