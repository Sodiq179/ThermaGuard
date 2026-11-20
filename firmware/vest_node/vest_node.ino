/*
 * ThermaGuard harness node (reference sketch, ESP32 + DS18B20).
 *
 * Reads torso skin temperature (and optionally a second DS18B20 taped to a PCM pack),
 * then publishes JSON to the ThermaGuard MQTT broker every PUBLISH_INTERVAL_MS:
 *
 *   topic:   thermaguard/v1/vests/<VEST_ID>/telemetry
 *   payload: {"skin_temp_c": 34.6, "battery_pct": 82, "pcm_temp_c": 26.9}
 *
 * Libraries: PubSubClient, OneWire, DallasTemperature (Arduino Library Manager).
 * Wiring: DS18B20 data -> GPIO 4 with a 4.7 kOhm pull-up to 3.3 V. Battery divider -> GPIO 34.
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ---- Configure per device -------------------------------------------------
const char *WIFI_SSID = "site-wifi";
const char *WIFI_PASSWORD = "change-me";
const char *MQTT_HOST = "192.168.1.10";  // computer running docker compose
const uint16_t MQTT_PORT = 1883;
const char *VEST_ID = "V-W001";          // must match the harness id paired in Admin
const uint32_t PUBLISH_INTERVAL_MS = 5000;
// ---------------------------------------------------------------------------

const uint8_t ONE_WIRE_PIN = 4;
const uint8_t BATTERY_PIN = 34;

OneWire oneWire(ONE_WIRE_PIN);
DallasTemperature sensors(&oneWire);
WiFiClient wifi;
PubSubClient mqtt(wifi);
char topic[96];

float batteryPercent() {
  // 2:1 divider on a single-cell Li-Po: 3.3 V (empty) .. 4.2 V (full)
  float volts = analogReadMilliVolts(BATTERY_PIN) * 2.0f / 1000.0f;
  float pct = (volts - 3.3f) / (4.2f - 3.3f) * 100.0f;
  return constrain(pct, 0.0f, 100.0f);
}

void ensureConnected() {
  while (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    delay(2000);
  }
  while (!mqtt.connected()) {
    if (!mqtt.connect(VEST_ID)) delay(2000);
  }
}

void setup() {
  Serial.begin(115200);
  sensors.begin();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  snprintf(topic, sizeof(topic), "thermaguard/v1/vests/%s/telemetry", VEST_ID);
}

void loop() {
  ensureConnected();
  mqtt.loop();

  static uint32_t last = 0;
  if (millis() - last < PUBLISH_INTERVAL_MS) return;
  last = millis();

  sensors.requestTemperatures();
  float skin = sensors.getTempCByIndex(0);
  float pcm = sensors.getDeviceCount() > 1 ? sensors.getTempCByIndex(1) : NAN;
  if (skin == DEVICE_DISCONNECTED_C) return;

  char payload[128];
  if (isnan(pcm)) {
    snprintf(payload, sizeof(payload), "{\"skin_temp_c\":%.2f,\"battery_pct\":%.0f}", skin, batteryPercent());
  } else {
    snprintf(payload, sizeof(payload), "{\"skin_temp_c\":%.2f,\"battery_pct\":%.0f,\"pcm_temp_c\":%.2f}",
             skin, batteryPercent(), pcm);
  }
  mqtt.publish(topic, payload);
  Serial.println(payload);
}
