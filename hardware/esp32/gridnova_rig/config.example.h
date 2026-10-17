// Copy this file to config.h and fill it in. config.h is git-ignored: never commit real keys.
#pragma once

#define WIFI_SSID      "your-wifi"
#define WIFI_PASSWORD  "your-wifi-password"

// Your GridNova server, HTTPS only. Use the hostname without a scheme or path.
#define SERVER_HOST    "your-app.up.railway.app"
#define SERVER_PORT    443

// Must match an entry in the server's GRIDNOVA_DEVICE_KEYS ("<id>:<key>").
#define DEVICE_ID      "esp32-demo-01"
#define DEVICE_KEY     "replace-with-the-24-plus-character-key"

// Root certificate of the server's TLS chain (PEM). The sketch refuses to talk to a server it cannot verify;
// there is deliberately no "insecure" switch. Get the chain's root with:  openssl s_client -showcerts -connect HOST:443
static const char ROOT_CA[] = R"EOF_CA(
-----BEGIN CERTIFICATE-----
PASTE THE ROOT CERTIFICATE HERE
-----END CERTIFICATE-----
)EOF_CA";

// ---- Pins: EXAMPLES ONLY. Check every one against YOUR wiring before powering anything. ----
// All outputs need an external 10k pull-down so every source and load is OFF while the ESP32 boots or resets.
#define PIN_SRC_ADAPTER_EN    25  // enable of the adapter-side switch of the source selector
#define PIN_SRC_POWERBANK_EN  26  // enable of the power-bank-side switch of the source selector
#define PIN_LOAD_CRITICAL     16  // LED branch drivers (logic-level MOSFET gates), low-voltage only
#define PIN_LOAD_HOSTEL       17
#define PIN_LOAD_LIBRARY      18
#define PIN_LOAD_EXTRA        19
#define PIN_ESTOP_BUTTON       4  // normally-open button to GND, internal pull-up, pressed = stop
#define PIN_SDA               21
#define PIN_SCL               22

// INA219 I2C addresses (set by the A0/A1 solder pads on each module).
#define INA_ADDR_ADAPTER      0x40
#define INA_ADDR_BATTERY      0x41
