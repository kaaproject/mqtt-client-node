import { KaaMqttClient, createKaaMqttClient } from '@kaaiot/mqtt-client';

const mqttHost = 'mqtt://mqtt.cloud.kaaiot.com:1883';
const appVersion = '<your_app_version>';
const token = '<your_token>';

class SimpleEndpoint {
  private client: KaaMqttClient;
  private currentSWVersion = '1.0.0';

  constructor() {
    this.client = createKaaMqttClient({
      connectionUrl: mqttHost,
      appVersionName: appVersion,
      token: token,
      debug: true,
    });

    this.setupCommands();
    this.getMetadataKeys();
    this.getMetadata();
    this.publishPartialMetadata();
    this.publishPlainDataSample();
    this.publishDataSamples();
    this.getConfiguration();
    this.getSoftwareUpdates();
  }

  setupCommands() {
    this.client.getPendingCommands<any>(
      'RESET',
      (commands, _, reportResults) => {
        reportResults(
          commands.map((command) => {
            return {
              ...command,
              statusCode: 200,
            };
          }),
        );
      },
    );
  }

  publishDataSamples() {
    this.client.publishDataCollection({
      temperature: 10 + Math.random() * 10,
      humidity: 50 + Math.random() * 20,
    });
  }

  getMetadataKeys() {
    this.client.getAllMetadataKeys((response, topic) => {
      console.error('\n\nMetadata keys:', response, 'on topic:', topic);
    });
  }

  getMetadata() {
    this.client.getMetadata((response, topic) => {
      console.error('Metadata', response, topic);
    });
  }

  pushMetadata() {
    this.client.publishMetadata({
      location: 'London',
    });
  }

  publishPartialMetadata() {
    this.client.publishMetadataKeys({
      location: 'London, UK',
      color: 'green',
    });
  }

  publishPlainDataSample() {
    this.client.publishPlainDataSample('distance', '20m');
    this.client.publishPlainDataSample('radius', 10);
  }

  getConfiguration() {
    this.client.getConfigurationJson(
      { observe: true },
      (response, _, reportConfig) => {
        reportConfig({
          configId: response.configId,
          statusCode: 200,
          reasonPhrase: 'ok',
        });
      },
    );
  }

  getSoftwareUpdates() {
    this.client.getSoftwareUpdate((response, _) => {
      console.log('Software update', response);
    });
    this.client.reportCurrentSoftwareVersion({
      configId: this.currentSWVersion,
    });
  }
}

new SimpleEndpoint();
