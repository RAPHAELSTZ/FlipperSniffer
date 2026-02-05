# FlipperSniffer

Gamified wardriving with social analytics. Scan Bluetooth, WiFi and NFC devices during your walks with a Flipper Zero, then visualize everything on a cyberpunk-style web dashboard with gamification metrics, interactive maps, and shareable stats.

**Think: Pokemon GO meets Strava for RF data.**

---

## How It Works

1. **Walk** with your Flipper Zero running FlipperSniffer
2. The app scans BLE, WiFi and NFC devices continuously, logging each unique device once with its GPS coordinates
3. At the end of your session, **export** the data as a JSON file to the SD card
4. **Upload** the JSON to the web dashboard
5. Explore your walk: interactive map, device heatmaps, economy score, security risk analysis, achievements, and more

---

## Project Structure

```
FlipperSniffer/
├── flipper/                     # Flipper Zero JavaScript app
│   ├── flipper_sniffer.js       # Main app entry point
│   ├── gps.js                   # GPS/NMEA parsing via UART
│   ├── scanner.js               # BLE + WiFi scanning, manufacturer identification
│   ├── database.js              # In-memory DB, deduplication, JSON export
│   └── ui.js                    # Flipper display rendering
│
└── webapp/                      # Web analytics dashboard
    ├── index.html               # Main page (upload + dashboard)
    ├── css/
    │   └── style.css            # Cyberpunk dark theme
    └── js/
        ├── app.js               # Main controller
        ├── upload.js            # File drag-and-drop + JSON parsing
        ├── analytics.js         # Metrics: economy, income, danger, tribes
        ├── map.js               # Leaflet.js map with layers
        ├── charts.js            # Chart.js graphs
        ├── achievements.js      # Achievement badge system
        ├── share.js             # Social sharing (Twitter, Mastodon, image)
        └── demo-data.js         # Demo data generator (no Flipper needed)
```

---

## Flipper Zero App

### Requirements

- Flipper Zero with firmware supporting JavaScript apps (Momentum, Unleashed, or official with JS support)
- GPS module connected via UART (GPIO pins) for location tracking
- Optional: WiFi dev board (ESP32-based) for WiFi scanning

### Hardware Setup - GPS

Connect a GPS module (e.g., BN-220, NEO-6M, NEO-8M) to the Flipper's GPIO:

| GPS Module | Flipper GPIO |
|-----------|-------------|
| TX        | RX (pin 14) |
| RX        | TX (pin 13) |
| VCC       | 3.3V        |
| GND       | GND         |

The app reads NMEA sentences (`$GPGGA`, `$GPRMC`) at 9600 baud.

### Installation

1. Copy the entire `flipper/` folder to your Flipper's SD card:
   ```
   /ext/apps/Scripts/flipper_sniffer/
   ├── flipper_sniffer.js
   ├── gps.js
   ├── scanner.js
   ├── database.js
   └── ui.js
   ```

2. On your Flipper, navigate to **Apps > Scripts > flipper_sniffer**

3. The app starts scanning immediately. Walk around and watch the device count climb.

### Usage

- **Left/Right** to navigate between buttons: `[Pause]` `[End]` `[Stats]`
- **OK** to activate the selected button
- **Pause**: Stops scanning temporarily (useful indoors)
- **End Session**: Saves everything to JSON and shows the export path
- **Stats**: View session summary (unique counts, distance, duration)

### Deduplication

Each device is registered **once** based on its unique identifier:
- **Bluetooth**: MAC address
- **WiFi**: BSSID
- **NFC**: UID

If a device is seen again, the app updates its last-seen timestamp and keeps the best RSSI (strongest signal = closest distance). The GPS coordinates stored correspond to the location where the signal was strongest.

### Export Format

The session is saved to `/ext/exports/session_[id].json`. The JSON contains:

- **session**: id, timestamps, duration, distance, average speed, full GPS path
- **devices.bluetooth**: unique BT devices with MAC, name, RSSI, GPS, manufacturer, brand
- **devices.wifi**: unique WiFi networks with BSSID, SSID, channel, security, RSSI, GPS
- **devices.nfc**: unique NFC tags with UID, type, GPS
- **stats**: pre-computed counts by brand, security type, etc.
- **achievements**: unlocked and locked achievements

---

## Web Dashboard

### Features

- **Interactive Map** (Leaflet.js + OpenStreetMap dark tiles)
  - Walking path with start/end markers
  - Bluetooth devices colored by brand
  - WiFi networks colored by security level
  - Heatmap layer showing device density
  - Toggleable layers

- **Gamified Metrics**
  - **Neighbourhood Economy Score** (0-100): estimates local wealth from device brands
  - **Estimated Average Income**: proxy based on device values and density
  - **Security Risk Score** (0-10): counts open WiFi, WEP networks, IoT devices
  - **Tech Tribes**: brand distribution bars (Apple, Samsung, Google, Xiaomi...)

- **Charts**
  - Discovery timeline (cumulative devices over time)
  - Brand distribution (doughnut chart)
  - WiFi security breakdown (bar chart)

- **Achievements** : badges unlocked during the session

- **Social Sharing**: Tweet, Toot, download as image, or copy stats to clipboard

### Installation

The webapp is fully static (no backend required). You can host it anywhere:

#### Option 1: Open locally

Just open `webapp/index.html` in a browser. Everything works offline.

```bash
# From the project root
open webapp/index.html
# or
python3 -m http.server 8000 --directory webapp
# then open http://localhost:8000
```

#### Option 2: GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings > Pages**
3. Set source to the branch and `/webapp` as the folder (or root if you move files)
4. Your dashboard is live at `https://yourusername.github.io/FlipperSniffer/webapp/`

#### Option 3: Vercel / Netlify

Just point the deployment to the `webapp/` directory. No build step needed.

### Demo Mode

No Flipper Zero? Click **"LOAD DEMO SESSION"** on the upload screen. This generates a realistic sample dataset (Paris area, ~150 BT devices, ~90 WiFi networks, 2.3 km walk) so you can explore the full dashboard.

### Using With Real Data

1. End your FlipperSniffer session on the Flipper
2. Connect the Flipper via USB or pull the SD card
3. Find the export: `SD Card/exports/session_[id].json`
4. Open the web dashboard
5. Drag-and-drop (or click to browse) your JSON file
6. Click **"ANALYZE MY WALK"**

---

## Metrics Explained

### Neighbourhood Economy Score

Estimates the economic level of the area based on which devices are present. Apple devices and high-end laptops score higher, budget Android and IoT devices score lower. This is obviously a rough proxy and meant for entertainment.

### Security Risk Score

Rates the wireless security posture of the area:
- **Open WiFi** and **WEP** networks raise the score significantly
- **WPA3** and enterprise networks lower it
- IoT devices (Espressif, Raspberry Pi) add a small amount

### Tech Tribes

Shows the brand distribution of Bluetooth devices as percentage bars. The manufacturer is identified from the MAC address OUI prefix (first 3 bytes).

---

## Achievements

| Badge | Name | Condition |
|-------|------|-----------|
| Getting Started | 10 total devices | 10+ devices found |
| Signal Scout | 50 total devices | 50+ devices |
| Century Club | 100 total devices | 100+ devices |
| Spectrum Overlord | 500 total devices | 500+ devices |
| Casual Stroll | 1 km walked | 1+ km GPS distance |
| Urban Explorer | 5 km walked | 5+ km |
| Marathon Hacker | 10 km walked | 10+ km |
| WiFi Hunter | 50 WiFi networks | 50+ unique networks |
| Silicon Valley | 50 Apple devices | 50+ Apple brand |
| Open Sesame | 10 open WiFi | 10+ open networks |
| Night Owl | Night session | Session started 10pm-6am |
| Endurance | Long session | 1+ hour duration |

---

## Privacy & Legal

- **All data stays local.** The web dashboard runs entirely in the browser. No data is sent to any server.
- The Flipper app only scans **broadcast** RF signals (BLE advertisements, WiFi beacons). It does not intercept, decrypt, or modify any communications.
- MAC addresses captured are from public broadcasts.
- Check your local laws regarding RF scanning. In most jurisdictions, passive scanning of public broadcast signals is legal, but some regions may have restrictions.
- The "economy score" and "income estimate" are entertainment features based on crude device-value heuristics. They are not accurate or scientific.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Flipper App | JavaScript (Flipper JS runtime) |
| GPS | NMEA over UART (9600 baud) |
| Map | Leaflet.js + CartoDB dark tiles |
| Heatmap | leaflet.heat |
| Charts | Chart.js 4 |
| Share Images | html2canvas |
| Fonts | Orbitron, Share Tech Mono, Rajdhani (Google Fonts) |
| CSS | Custom cyberpunk theme, fully responsive |

---

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a pull request

Ideas welcome: new achievements, better manufacturer detection, SubGHz scanning, Wigle integration, PWA support, leaderboard backend...

---

## License

MIT

---

*Built with a Flipper Zero and Claude.ai*
