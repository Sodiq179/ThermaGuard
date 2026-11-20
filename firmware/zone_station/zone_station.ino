/*
 * ThermaGuard zone station (reference sketch, ESP32 + SHT31 + black-globe DS18B20).
 *
 * One station per work zone. Publishes every PUBLISH_INTERVAL_MS:
 *
 *   topic:   thermaguard/v1/stations/<STATION_ID>/env
 *   payload: {"air_temp_c": 38.2, "rh_pct": 31.5, "globe_temp_c": 51.0}
 *
 * The globe thermometer is a DS18B20 inside a 150 mm matte-black copper sphere (ISO 7243).
 * Without it, omit "globe_temp_c": the backend then estimates WBGT and labels it as estimated.
 * Mount the station in the same sun exposure as the workers, 1.1 m above ground.
 *
 * Libraries: PubSubClient, Adafruit SHT31, OneWire, DallasTemperature.
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_SHT31.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ---- Configure per device -------------------------------------------------
const char *WIFI_SSID = "site-wifi";
const char *WIFI_PASSWORD = "change-me";
const char *MQTT_HOST = "192.168.1.10";
const uint16_t MQTT_PORT = 1883;
const char *STATION_ID = "ST-Z1";        // must match the zone's station id in Admin
const uint32_t PUBLISH_INTERVAL_MS = 10000;
// ---------------------------------------------------------------------------

Adafruit_SHT31 sht31;
OneWire oneWire(4);
DallasTemperature globe(&oneWire);
WiFiClient wifi;
PubSubClient mqtt(wifi);
char topic[96];

void ensureConnected() {
  while (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    delay(2000);
  }
  while (!mqtt.connected()) {
    if (!mqtt.connect(STATION_ID)) delay(2000);
  }
}

void setup() {
  Serial.begin(115200);
  sht31.begin(0x44);
  globe.begin();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  snprintf(topic, sizeof(topic), "thermaguard/v1/stations/%s/env", STATION_ID);
}

void loop() {
  ensureConnected();
  mqtt.loop();

  static uint32_t last = 0;
  if (millis() - last < PUBLISH_INTERVAL_MS) return;
  last = millis();

  float air = sht31.readTemperature();
  float rh = sht31.readHumidity();
  globe.requestTemperatures();
  float tg = globe.getTempCByIndex(0);
  if (isnan(air) || isnan(rh)) return;

  char payload[128];
  if (tg == DEVICE_DISCONNECTED_C) {
    snprintf(payload, sizeof(payload), "{\"air_temp_c\":%.2f,\"rh_pct\":%.1f}", air, rh);
  } else {
    snprintf(payload, sizeof(payload), "{\"air_temp_c\":%.2f,\"rh_pct\":%.1f,\"globe_temp_c\":%.2f}", air, rh, tg);
  }
  mqtt.publish(topic, payload);
  Serial.println(payload);
}
