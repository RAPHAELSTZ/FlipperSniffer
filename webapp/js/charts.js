// FlipperSniffer - Charts Module
// Chart.js integration

var Charts = (function () {
    var timelineChart = null;
    var brandChart = null;
    var securityChart = null;

    // Chart.js global defaults (dark theme)
    function setDefaults() {
        Chart.defaults.color = "#9ca3af";
        Chart.defaults.borderColor = "rgba(0, 255, 65, 0.1)";
        Chart.defaults.font.family = "'Share Tech Mono', 'Courier New', monospace";
    }

    function init(data) {
        setDefaults();
        destroyAll();
        createTimeline(data);
        createBrandChart(data);
        createSecurityChart(data);
    }

    function destroyAll() {
        if (timelineChart) { timelineChart.destroy(); timelineChart = null; }
        if (brandChart) { brandChart.destroy(); brandChart = null; }
        if (securityChart) { securityChart.destroy(); securityChart = null; }
    }

    function createTimeline(data) {
        var timeline = Analytics.computeTimeline(data);
        var ctx = document.getElementById("timeline-chart");
        if (!ctx) return;

        timelineChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: timeline.labels,
                datasets: [
                    {
                        label: "Total",
                        data: timeline.total,
                        borderColor: "#00ff41",
                        backgroundColor: "rgba(0, 255, 65, 0.1)",
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHitRadius: 10
                    },
                    {
                        label: "Bluetooth",
                        data: timeline.bt,
                        borderColor: "#00f5ff",
                        backgroundColor: "rgba(0, 245, 255, 0.05)",
                        borderWidth: 1.5,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 0,
                        borderDash: [5, 3]
                    },
                    {
                        label: "WiFi",
                        data: timeline.wifi,
                        borderColor: "#ff006e",
                        backgroundColor: "rgba(255, 0, 110, 0.05)",
                        borderWidth: 1.5,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 0,
                        borderDash: [5, 3]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    mode: "index",
                    intersect: false
                },
                plugins: {
                    legend: {
                        labels: {
                            usePointStyle: true,
                            pointStyle: "line",
                            padding: 15,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: "rgba(17, 24, 39, 0.95)",
                        borderColor: "rgba(0, 255, 65, 0.3)",
                        borderWidth: 1,
                        titleFont: { family: "'Orbitron', sans-serif", size: 11 },
                        bodyFont: { family: "'Share Tech Mono', monospace", size: 12 }
                    }
                },
                scales: {
                    x: {
                        grid: { color: "rgba(255, 255, 255, 0.03)" },
                        ticks: { maxTicksLimit: 10 }
                    },
                    y: {
                        grid: { color: "rgba(255, 255, 255, 0.03)" },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    function createBrandChart(data) {
        var dist = Analytics.computeBrandDistribution(data);
        var ctx = document.getElementById("brand-chart");
        if (!ctx) return;

        brandChart = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: dist.labels,
                datasets: [{
                    data: dist.values,
                    backgroundColor: dist.colors,
                    borderColor: "#0a0e1a",
                    borderWidth: 2,
                    hoverBorderColor: "#ffffff",
                    hoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: "55%",
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            usePointStyle: true,
                            pointStyle: "circle",
                            padding: 12,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: "rgba(17, 24, 39, 0.95)",
                        borderColor: "rgba(0, 255, 65, 0.3)",
                        borderWidth: 1,
                        callbacks: {
                            label: function (context) {
                                var total = context.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                                var pct = Math.round((context.parsed / total) * 100);
                                return " " + context.label + ": " + context.parsed + " (" + pct + "%)";
                            }
                        }
                    }
                }
            }
        });
    }

    function createSecurityChart(data) {
        var sec = Analytics.computeSecurityDistribution(data);
        var ctx = document.getElementById("security-chart");
        if (!ctx) return;

        securityChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: sec.labels,
                datasets: [{
                    label: "Networks",
                    data: sec.values,
                    backgroundColor: sec.colors.map(function (c) { return c + "cc"; }),
                    borderColor: sec.colors,
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "rgba(17, 24, 39, 0.95)",
                        borderColor: "rgba(0, 255, 65, 0.3)",
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: { display: false }
                    },
                    y: {
                        grid: { color: "rgba(255, 255, 255, 0.03)" },
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    return {
        init: init,
        destroyAll: destroyAll
    };
})();
