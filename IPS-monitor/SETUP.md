# Setup guide

## 1. Create the Firebase project
1. Go to the [Firebase console](https://console.firebase.google.com) → **Add project**.
2. Once created, go to **Build → Realtime Database → Create Database**. Pick a region close to you, start in **locked mode**.
3. In **Realtime Database → Rules**, paste the contents of `database.rules.json` from this folder (you'll fill in `DEVICE_UID_HERE` in step 3) and **Publish**.

## 2. Enable sign-in methods
Go to **Build → Authentication → Sign-in method** and enable:
- **Anonymous** — this is what lets the website write to `/control` when someone taps Force ON / Force OFF / Auto.
- **Email/Password** — this is what the NodeMCU uses to authenticate.

## 3. Create the device account
Still in **Authentication → Users**, click **Add user**. Use any email-shaped string (it doesn't need to be real, e.g. `device@yourproject.local`) and a strong password. After it's created, **copy the User UID** — paste it into `database.rules.json` wherever you see `DEVICE_UID_HERE`, then re-publish the rules.

## 4. Get your web app config
**Project settings → General → Your apps → Add app → Web**. Copy the resulting `firebaseConfig` object into `assets/firebase-config.js` in this project, replacing the placeholder values.

## 5. Fill in the firmware
Open `IPS_Battery_Monitor.ino` and set, near the top:
```cpp
#define FB_API_KEY      "..."   // same apiKey as firebaseConfig
#define FB_DB_URL       "..."   // same databaseURL as firebaseConfig
#define FB_DEVICE_EMAIL "..."   // the email you used in step 3
#define FB_DEVICE_PASS  "..."   // the password you used in step 3
```
You'll also need the **ArduinoJson** library (by Benoit Blanchon) installed via the Arduino Library Manager — everything else (`ESP8266HTTPClient`, `WiFiClientSecure`, `time.h`) ships with the ESP8266 core.

Flash the board as usual.

## 6. Host the site on GitHub Pages
1. Push this folder (`index.html`, `assets/`) to a GitHub repo.
2. **Settings → Pages → Deploy from branch**, pick `main` and `/ (root)`.
3. Your dashboard will be live at `https://yourusername.github.io/reponame/`.

## Notes and tradeoffs
- The ESP8266 uses `WiFiClientSecure::setInsecure()` for the Firebase calls (skips certificate pinning) to save RAM, since it's already running Blynk's own TLS connection concurrently. This is a common tradeoff on ESP8266 but means it doesn't verify Firebase's certificate chain — acceptable for a hobby project, but worth knowing.
- Running Blynk and Firebase side by side is memory-tight on an ESP8266 (~80KB RAM). If you see crashes/reboots, the biggest lever is increasing `FB_CONTROL_POLL_MS` and `BLYNK_SEND_INTERVAL_MS` to reduce how often two things need memory at once, or dropping Blynk in favor of Firebase-only control (you can revisit this later — just say so).
- Website control commands take up to 5 seconds to reach the device (it polls `/control/chargeCmd` every 5s rather than holding a permanent streaming connection, which is lighter on memory).
- History is sampled every 5 minutes and pruned past 90 days automatically, in a background task that runs every 6 hours.
