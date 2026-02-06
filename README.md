# FlipperSniffer

Gamified wardriving with social analytics. Scan Bluetooth, WiFi and NFC devices during your walks with a Flipper Zero, then visualize everything on a cyberpunk-style web dashboard with gamification metrics, interactive maps, and shareable stats.

**Think: Pokemon GO meets Strava for RF data.**

---

## How It Works

1. **Launch** FlipperSniffer on your Flipper Zero
2. **Configure** your settings (GPS source, battery mode, scan types...)
3. **Walk** - the app scans BLE and WiFi continuously, logging each unique device once with GPS coordinates
4. **End** your session - data is exported as JSON to the SD card
5. **Upload** the JSON to the web dashboard
6. **Explore**: interactive map, device heatmaps, economy score, security risk, achievements, and more

---

## Project Structure

```
FlipperSniffer/
├── flipper/                     # Flipper Zero JavaScript app
│   ├── flipper_sniffer.js       # Main app entry point
│   ├── settings.js              # Settings management + SD card persistence
│   ├── gps.js                   # GPS via hardware UART module
│   ├── scanner.js               # BLE + WiFi scanning, manufacturer ID
│   ├── database.js              # In-memory DB, deduplication, JSON export
│   ├── ui.js                    # Flipper display rendering (7 screens)
│   └── qrcode.js                # QR code generator for companion link
│
└── webapp/                      # Web analytics dashboard
    ├── index.html               # Main page (upload + dashboard)
    ├── companion.html           # GPS Companion (phone GPS tracker)
    ├── css/
    │   └── style.css            # Cyberpunk dark theme
    └── js/
        ├── app.js               # Main controller
        ├── upload.js            # File drag-and-drop + JSON parsing
        ├── merge.js             # GPS track merge (companion + session)
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
- **For GPS** (optional, two options):
  - **Hardware GPS module** connected via UART (BN-220, NEO-6M, NEO-8M...). Costs ~10-15 EUR. Most reliable option.
  - **Phone GPS Companion** (no extra hardware needed): open the companion page on your phone, walk with both devices, merge the data on the dashboard afterwards. Works on any phone/browser including iPhone Safari.
- Optional: WiFi dev board (ESP32-based) for WiFi scanning

### Installation

1. Copy the entire `flipper/` folder to your Flipper's SD card:
   ```
   /ext/apps/Scripts/flipper_sniffer/
   ├── flipper_sniffer.js
   ├── settings.js
   ├── gps.js
   ├── scanner.js
   ├── database.js
   ├── ui.js
   └── qrcode.js
   ```

2. On your Flipper, navigate to **Apps > Scripts > flipper_sniffer**

3. The app opens to the **Start Screen** where you can adjust settings before scanning.

---

### Settings

When you launch the app, you land on a **Start Screen** that shows a summary of your current settings. Press **[Settings]** to adjust them, or **[> START]** to begin scanning immediately.

Settings are **saved to the SD card** and persist between sessions.

#### GPS

| Option | Description |
|--------|-------------|
| **Module** (default) | Uses a hardware GPS module connected to the Flipper's GPIO via UART (9600 baud). BN-220, NEO-6M, NEO-8M, etc. |
| **Phone** | No GPS hardware. When you start, the Flipper displays a **QR code** that opens the GPS Companion page on your phone with the session ID pre-filled. Both devices record independently, then you merge on the dashboard. Works on any phone including iPhone. |
| **Off** | No GPS at all. Devices are still scanned and counted, but without location data. The map will be empty in the web dashboard, but all other metrics still work. |

#### GPS Module Setup

Connect a GPS module to the Flipper's GPIO:

| GPS Module | Flipper GPIO |
|-----------|-------------|
| TX        | RX (pin 14) |
| RX        | TX (pin 13) |
| VCC       | 3.3V        |
| GND       | GND         |

#### Battery Mode

| Mode | GPS interval | WiFi scan | Loop delay | Best for |
|------|-------------|-----------|------------|----------|
| **Full** | Every 3s | Every 10s | 80ms | Short sessions, max data |
| **Normal** (default) | Every 5s | Every 15s | 100ms | Most walks |
| **Saving** | Every 10s | Every 30s | 200ms | Long sessions (1h+), saving battery |

#### Other Settings

| Setting | Options | Description |
|---------|---------|-------------|
| **Scan BT** | ON / OFF | Enable or disable Bluetooth scanning |
| **Scan WiFi** | ON / OFF | Enable or disable WiFi scanning |
| **Vibrate** | ON / OFF | Haptic feedback on milestones and achievements |
| **Sound** | ON / OFF | Sound effects on achievement unlock |
| **Auto Export** | ON / OFF | Automatically export JSON when ending session |
| **Screen Off** | Never / 15s / 30s / 60s | Screen timeout to save battery |

---

### Usage

#### Start Screen
```
┌──────────────────────────────┐
│ FLIPPER SNIFFER              │
│ v1.1 - WarDriving            │
│                              │
│ GPS: Module    Batt: Normal  │
│ Scan: BT+WiFi               │
│                              │
│ [Settings]        [> START]  │
└──────────────────────────────┘
```
- **Left/Right** to select `[Settings]` or `[> START]`
- **OK** to confirm
- **Back** to exit the app

#### Settings Screen
```
┌──────────────────────────────┐
│ SETTINGS                     │
│                              │
│ > GPS              [Module]  │
│   Battery          [Normal]  │
│   Scan BT          [ON]     │
│   Scan WiFi        [ON]     │
│   Vibrate          [ON]     │
│                              │
│ [< Back]        L/R:Change   │
└──────────────────────────────┘
```
- **Up/Down** to move between settings
- **Left/Right** to change a value
- **OK** or **Back** to save and return to Start Screen

#### Scanning Screen
```
┌──────────────────────────────┐
│ FLIPPER SNIFFER              │
│ #a3f9b2   00:12:34|GPS:OK   │
│ 1.2km walked                 │
│                              │
│ BT:84 WiFi:42 NFC:1         │
│ Total: 127 unique devices    │
│                              │
│ [Pause]    [End]    [Stats]  │
└──────────────────────────────┘
```
- **Left/Right** to navigate buttons
- **OK** to activate

---

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
- **settings**: snapshot of settings used for the session

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

- **Achievements**: badges unlocked during the session

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

### GPS Companion (No GPS Module Needed)

Don't have a GPS module? Use your phone as a GPS tracker instead. Both devices record independently, then data is merged on the dashboard.

#### How It Works

```
 Phone (GPS Companion)              Flipper Zero
 ┌─────────────────────┐           ┌─────────────────────┐
 │ Records GPS path    │           │ Scans BT + WiFi     │
 │ with timestamps     │    walk   │ with timestamps      │
 │                     │ ───────── │                      │
 │ Downloads .json     │  together │ Exports .json        │
 └─────────────────────┘           └─────────────────────┘
           │                                │
           └──────── Dashboard ─────────────┘
                  Merges by timestamp
```

Both devices record timestamps. The dashboard matches each device detection to the closest GPS point in time (within 30 seconds).

#### Step by Step

1. On your Flipper, set **GPS: Phone** in settings
2. Press **START** on the Flipper
3. The Flipper displays a **QR code** - scan it with your phone camera
4. The companion page opens with the session ID pre-filled and GPS starts automatically
5. **Walk together** - both devices record independently
6. When done: tap **STOP** on the companion, press **End** on the Flipper
7. **Download** the GPS track from the companion (downloads `gps_track_*.json`)
8. Open the web dashboard
9. Upload the **Flipper session file** (drag-and-drop)
10. The GPS upload zone appears - upload the **GPS track file**
11. Click **"ANALYZE MY WALK"** - data is merged automatically

```
┌──────────────────────────────┐
│ ┌─────────┐   SCAN ME       │
│ │ QR CODE │   Open on your  │
│ │         │   phone to start│
│ │         │   GPS tracking   │
│ └─────────┘                  │
│                #a3f9b2       │
│                [OK: Start]   │
└──────────────────────────────┘
```

#### Changing the Companion URL

The QR code points to `https://tiptoo.net/flipper/companion.html?s=SESSION_ID` by default. To use your own hosted version:

1. Edit the settings file on the SD card: `/ext/apps_data/flipper_sniffer/settings.json`
2. Change the `companion_url` field to your own URL
3. Or fork the project and change the default in `settings.js`

```json
{
  "companion_url": "https://your-domain.com/path/companion.html",
  ...
}
```

#### Compatibility

The GPS Companion works on **any modern browser** with Geolocation API support:
- iPhone Safari (iOS 14+)
- Android Chrome
- Any desktop browser

No Bluetooth, no special app, no third-party dependency. Just a web page that uses your phone's built-in GPS.

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
| GPS | Hardware UART module (NMEA, 9600 baud) or Phone GPS Companion |
| GPS Companion | Browser Geolocation API + Leaflet.js (standalone HTML) |
| Settings | JSON persistence on SD card |
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
