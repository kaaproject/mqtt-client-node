## 1.0.0

Initial release of `KaaMqttClient` with the following features:
- MQTT client connection management with automatic reconnection and error handling.
- Subscription to MQTT topics with response and error callbacks.
- Publishing data samples to topics for data collection.
- Publishing plain data samples with a metric name.
- Retrieval and update of metadata keys and values.
- Command execution and result reporting for pending commands.
- Configuration management including retrieval and reporting of applied configurations.
- Software version reporting and OTA (Over-The-Air) update management.
- Clean disconnection handling by unsubscribing from all topics and ending the MQTT client session.
