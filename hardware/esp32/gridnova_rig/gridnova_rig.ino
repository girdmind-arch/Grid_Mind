// GridNova tabletop rig: ESP32-WROOM-32 firmware example (Arduino core for ESP32 3.x).
//
// What it does: every 2 s it reports measured volts/amps from two INA219 modules, the selected source and the
// LED branch states to the GridNova server over HTTPS, then asks for commands and carries out the few it knows.
// What it never does: run a command it does not recognise, switch the critical branch off by command, wait for
// the network before turning loads off in an emergency, or report a value it could not measure.
//
// Read hardware/README.md first. The source selector MUST be a power-mux arrangement that cannot connect the
// adapter and the power bank together on its own (break-before-make in hardware). This code adds dead time and
// a software interlock, but software alone is not a safety device.
//
// Libraries: ArduinoJson (7.x), Adafruit INA219. Board: "ESP32 Dev Module".
// NOT compiled or run in the environment that wrote it: build it, then test with loads disconnected first.

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <time.h>
#include <ArduinoJson.h>
#include <Adafruit_INA219.h>
#include "config.h"

#define FIRMWARE_VERSION "0.1.0"

// ---- timing and limits (keep in step with backend/gridnova/hardware.py) ----
static const uint32_t LOOP_MS = 2000;
static const uint32_t FAILSAFE_MS = 30000;      // no good server exchange for this long: shed non-essential loads
static const uint32_t SOURCE_DEAD_MS = 100;     // both source switches off for this long while changing over
static const uint32_t SOURCE_MIN_GAP_MS = 5000; // never switch the selector twice within this time
static const float MAX_V = 6.0f, MIN_A = -0.1f, MAX_A = 1.9f;  // INA219 on the 32V/2A calibration: >1.9 A is out of range
static const float PARALLEL_A = 0.25f;          // current on the NON-selected side = parallel connection suspected

// ---- fixed vocabulary: the ONLY things a command can name ----
enum Load { L_CRITICAL, L_HOSTEL, L_LIBRARY, L_EXTRA, L_COUNT };
static const char *LOAD_NAME[L_COUNT] = {"critical", "hostel", "library", "extra"};
static const uint8_t LOAD_PIN[L_COUNT] = {PIN_LOAD_CRITICAL, PIN_LOAD_HOSTEL, PIN_LOAD_LIBRARY, PIN_LOAD_EXTRA};
enum Source { S_NONE, S_ADAPTER, S_POWERBANK };
static const char *SOURCE_NAME[] = {"none", "adapter", "powerbank"};

static Adafruit_INA219 inaAdapter(INA_ADDR_ADAPTER), inaBattery(INA_ADDR_BATTERY);
static bool loadOn[L_COUNT] = {false, false, false, false};
static Source source = S_NONE;
static bool estopLatched = false;
static bool controlArmed = false, controlEstop = false;  // last flags from the server
static bool firstContact = false;
static uint32_t lastGoodMs = 0, lastSourceMs = 0, lastLoopMs = 0, seqNo = 0, parallelHits = 0;
static char bootId[17];

// ---------------------------------------------------------------- outputs
static void setLoad(Load l, bool on) {
  loadOn[l] = on;
  digitalWrite(LOAD_PIN[l], on ? HIGH : LOW);
}

static void allLoadsOff() {
  for (int i = 0; i < L_COUNT; i++) setLoad((Load)i, false);
}

static void sourcesOff() {
  digitalWrite(PIN_SRC_ADAPTER_EN, LOW);
  digitalWrite(PIN_SRC_POWERBANK_EN, LOW);
  source = S_NONE;
}

// Break-before-make: both switches off, wait, then enable exactly one. Returns false if refused.
static bool selectSource(Source s) {
  if (s == source) return true;
  if (millis() - lastSourceMs < SOURCE_MIN_GAP_MS && lastSourceMs != 0) return false;
  sourcesOff();
  delay(SOURCE_DEAD_MS);
  digitalWrite(s == S_ADAPTER ? PIN_SRC_ADAPTER_EN : PIN_SRC_POWERBANK_EN, HIGH);
  source = s;
  lastSourceMs = millis();
  return true;
}

// Emergency stop: every load off, selector left where it is (with no load there is nothing to protect).
static void latchEstop() {
  allLoadsOff();
  estopLatched = true;
}

// ---------------------------------------------------------------- sensors
struct Reading { bool ok; float v, a; };

static bool present(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

// "ok" only when the module answers AND the numbers are physically sensible. Otherwise no value is sent.
static const char *readSensor(Adafruit_INA219 &ina, uint8_t addr, Reading &r) {
  r.ok = false;
  if (!present(addr)) return "missing";
  float v = ina.getBusVoltage_V(), a = ina.getCurrent_mA() / 1000.0f;
  if (isnan(v) || isnan(a) || v < 0 || v > MAX_V || a < MIN_A || a > MAX_A) return "fault";
  r.ok = true; r.v = v; r.a = a;
  return "ok";
}

// ---------------------------------------------------------------- network
static WiFiClientSecure tls;

static int http(const char *method, const String &path, const String &body, String &out) {
  HTTPClient h;
  if (!h.begin(tls, SERVER_HOST, SERVER_PORT, path, true)) return -1;
  h.setTimeout(6000);
  h.addHeader("X-Device-Id", DEVICE_ID);
  h.addHeader("Authorization", String("Bearer ") + DEVICE_KEY);
  h.addHeader("Content-Type", "application/json");
  int code = strcmp(method, "POST") == 0 ? h.POST(body) : h.GET();
  if (code > 0) out = h.getString();
  h.end();
  return code;
}

static bool timeValid() { return time(nullptr) > 1700000000; }

// ---------------------------------------------------------------- commands
static void ack(const char *id, const char *result, const char *reason) {
  JsonDocument d;
  d["deviceId"] = DEVICE_ID;
  d["result"] = result;
  if (reason) d["reason"] = reason;
  d["ts"] = (double)time(nullptr);
  d["source"] = SOURCE_NAME[source];
  JsonObject l = d["loads"].to<JsonObject>();
  for (int i = 0; i < L_COUNT; i++) l[LOAD_NAME[i]] = loadOn[i];
  String body, out;
  serializeJson(d, body);
  http("POST", String("/api/hardware/device/commands/") + id + "/ack", body, out);
}

static void runCommand(JsonObject c) {
  const char *id = c["id"] | "";
  const char *type = c["type"] | "";
  if (!id[0]) return;
  if ((double)(c["expiresAtEpoch"] | 0.0) < (double)time(nullptr)) return ack(id, "rejected", "expired before it was run");

  if (!strcmp(type, "estop")) { latchEstop(); return ack(id, "applied", nullptr); }
  if (!strcmp(type, "clear_estop")) {
    if (digitalRead(PIN_ESTOP_BUTTON) == LOW) return ack(id, "rejected", "the emergency-stop button is still pressed");
    estopLatched = false;  // loads stay OFF until a command turns them on
    return ack(id, "applied", nullptr);
  }
  if (estopLatched) return ack(id, "rejected", "emergency stop is latched");
  if (!controlArmed) return ack(id, "rejected", "server says not armed");

  if (!strcmp(type, "select_source")) {
    const char *s = c["params"]["source"] | "";
    Source want = !strcmp(s, "adapter") ? S_ADAPTER : !strcmp(s, "powerbank") ? S_POWERBANK : S_NONE;
    if (want == S_NONE) return ack(id, "rejected", "unknown source");
    bool switched = selectSource(want);  // called once: it moves hardware
    return ack(id, switched ? "applied" : "rejected", switched ? nullptr : "selector changed too recently");
  }
  if (!strcmp(type, "set_load")) {
    const char *name = c["params"]["load"] | "";
    if (c["params"]["on"].isNull() || !c["params"]["on"].is<bool>()) return ack(id, "rejected", "on must be true or false");
    bool on = c["params"]["on"];
    for (int i = 0; i < L_COUNT; i++) {
      if (strcmp(name, LOAD_NAME[i])) continue;
      if (i == L_CRITICAL && !on) return ack(id, "rejected", "the critical branch is never switched off");
      setLoad((Load)i, on);
      return ack(id, "applied", nullptr);
    }
    return ack(id, "rejected", "unknown load");
  }
  ack(id, "rejected", "not on the allow-list");  // anything else, however it is worded
}

static void pollCommands() {
  String out;
  int code = http("GET", "/api/hardware/device/commands", "", out);
  if (code != 200) return;
  JsonDocument d;
  if (deserializeJson(d, out)) return;
  lastGoodMs = millis();
  controlArmed = d["control"]["armed"] | false;
  controlEstop = d["control"]["estop"] | false;
  if (controlEstop && !estopLatched) latchEstop();
  for (JsonObject c : d["commands"].as<JsonArray>()) runCommand(c);
}

// ---------------------------------------------------------------- telemetry
static bool sendTelemetry() {
  Reading ra, rb;
  const char *ha = readSensor(inaAdapter, INA_ADDR_ADAPTER, ra);
  const char *hb = readSensor(inaBattery, INA_ADDR_BATTERY, rb);

  // Software back-up to the hardware selector: current on the side that is NOT selected = a parallel path.
  Reading &other = (source == S_ADAPTER) ? rb : ra;
  if ((source == S_ADAPTER || source == S_POWERBANK) && other.ok && other.a > PARALLEL_A) {
    if (++parallelHits >= 2) { sourcesOff(); latchEstop(); }
  } else parallelHits = 0;

  JsonDocument d;
  d["deviceId"] = DEVICE_ID;
  d["bootId"] = bootId;
  d["seq"] = ++seqNo;
  d["ts"] = (double)time(nullptr);
  d["firmware"] = FIRMWARE_VERSION;
  d["source"] = SOURCE_NAME[source];
  if (ra.ok) { d["adapter"]["voltageV"] = ra.v; d["adapter"]["currentA"] = ra.a; }
  if (rb.ok) { d["battery"]["voltageV"] = rb.v; d["battery"]["currentA"] = rb.a; }
  JsonObject l = d["loads"].to<JsonObject>();
  for (int i = 0; i < L_COUNT; i++) l[LOAD_NAME[i]] = loadOn[i];
  d["health"]["ina219Adapter"] = ha;
  d["health"]["ina219Battery"] = hb;
  d["health"]["muxInterlock"] = "ok";
  d["estop"] = estopLatched;
  d["uptimeS"] = millis() / 1000;
  // No state-of-charge field exists on purpose: a power bank's USB voltage does not tell us.
  String body, out;
  serializeJson(d, body);
  int code = http("POST", "/api/hardware/device/telemetry", body, out);
  if (code == 200) lastGoodMs = millis();
  return code == 200;
}

// ---------------------------------------------------------------- setup / loop
void setup() {
  // FIRST: everything off, before anything can fail.
  for (int i = 0; i < L_COUNT; i++) { pinMode(LOAD_PIN[i], OUTPUT); digitalWrite(LOAD_PIN[i], LOW); }
  pinMode(PIN_SRC_ADAPTER_EN, OUTPUT); pinMode(PIN_SRC_POWERBANK_EN, OUTPUT);
  sourcesOff();
  pinMode(PIN_ESTOP_BUTTON, INPUT_PULLUP);
  Serial.begin(115200);
  snprintf(bootId, sizeof bootId, "%08x%08x", (unsigned)esp_random(), (unsigned)esp_random());

  Wire.begin(PIN_SDA, PIN_SCL);
  if (present(INA_ADDR_ADAPTER)) { inaAdapter.begin(); inaAdapter.setCalibration_32V_2A(); }
  if (present(INA_ADDR_BATTERY)) { inaBattery.begin(); inaBattery.setCalibration_32V_2A(); }

  tls.setCACert(ROOT_CA);  // verified TLS only
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  configTime(0, 0, "pool.ntp.org", "time.google.com");  // the server rejects readings from a wrong clock
  lastGoodMs = millis();
}

void loop() {
  // The emergency-stop button works with or without Wi-Fi.
  if (digitalRead(PIN_ESTOP_BUTTON) == LOW && !estopLatched) latchEstop();

  // Lost the server for too long: non-essential loads off. The source selector stays put.
  if (firstContact && millis() - lastGoodMs > FAILSAFE_MS) {
    for (int i = 0; i < L_COUNT; i++) if (i != L_CRITICAL) setLoad((Load)i, false);
  }
  if (millis() - lastLoopMs < LOOP_MS) return;
  lastLoopMs = millis();
  if (WiFi.status() != WL_CONNECTED || !timeValid()) return;

  if (sendTelemetry()) {
    if (!firstContact && !estopLatched) {
      // Boot defaults, only after the server answered and nothing is latched: adapter source, critical branch on.
      firstContact = true;
      selectSource(S_ADAPTER);
      setLoad(L_CRITICAL, true);
    }
    pollCommands();
  }
}
