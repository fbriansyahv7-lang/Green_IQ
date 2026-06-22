import paho.mqtt.client as mqtt
import json
import time

broker = "4f3b2ab312f04696a4f71ac4d7274352.s1.eu.hivemq.cloud"
port = 8883
username = "Cyrene"
password = "33550336Cycles"
topic = "greeniq/sensor"

client = mqtt.Client()
client.username_pw_set(username, password)
client.tls_set()

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")

client.on_connect = on_connect
client.connect(broker, port, 60)

# Kirim data
data = {
    "label": "perangkat1",
    "suhu": 28.5,
    "kelembaban": 65,
    "tekanan": 1013.25,
    "kelembaban_tanah": 45
}

client.publish(topic, json.dumps(data))
print("Data terkirim!")
time.sleep(1)
client.disconnect()
