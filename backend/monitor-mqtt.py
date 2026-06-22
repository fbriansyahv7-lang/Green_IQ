import paho.mqtt.client as mqtt
import ssl

BROKER = "4f3b2ab312f04696a4f71ac4d7274352.s1.eu.hivemq.cloud"
PORT = 8883
USERNAME = "Cyrene"
PASSWORD = "33550336Cycles"
TOPIC = "greeniq/sensor"


def on_connect(client, userdata, flags, rc):
    print(f"Connected to broker, rc={rc}")
    client.subscribe(TOPIC)
    print(f"Subscribed to {TOPIC}")


def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode('utf-8')
    except Exception:
        payload = msg.payload
    print(f"MSG from topic={msg.topic}: {payload}")


client = mqtt.Client()
client.username_pw_set(USERNAME, PASSWORD)
client.tls_set(ca_certs=None, certfile=None, keyfile=None, cert_reqs=ssl.CERT_NONE)
client.tls_insecure_set(True)
client.on_connect = on_connect
client.on_message = on_message

print("Connecting to broker...")
client.connect(BROKER, PORT, keepalive=60)
print("Entering loop, waiting for messages. Press your hardware button now.")
client.loop_forever()
