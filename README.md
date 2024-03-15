# KaaIoT Mqtt Client

This client works in Node.js environment. Requires Node.js 16+. Based on [MQTT.js](https://www.npmjs.com/package/mqtt) library.

## Installation

```sh
npm i @kaaiot/mqtt-client
```

## Usage

Import `createKaaMqttClient`, provide `connectionUrl`, you device `appVersionName` and `token`. 

```ts
import { createKaaMqttClient } from '@kaaiot/mqtt-client';

const client = createKaaMqttClient({ appVersionName: '1.0', token: 'your-token', connectionUrl: 'mqtt://mqtt.cloud.kaaiot.com:1883'  });

client.publishMetadata({ deviceModel: 20 })
```

## Available methods

### createKaaMqttClient(kaaOptions, mqttClientOptions: mqtt.Options)
`mqttClientOptions` are the options compatible with [mqtt.Client](https://www.npmjs.com/package/mqtt#client) constructor options

### `publishDataCollection(dataSamples: DataSample | DataSample[], callback?: StatusCallback<void>, errorCallback?: ErrorCallback, requestId?: string): void`
Publishes single or multiple data samples.
```js
client.publishDataCollection([{ temperature: 22.5 }], (status) => {
  console.log('Data published with status:', status);
});
```

### `publishPlainDataSample(metricName: string, dataSample: PlainDataSample, callback?: StatusCallback<void>, errorCallback?: ErrorCallback, requestId?: string): void`
Publishes a plain data sample with a metric name.
```js
client.publishPlainDataSample('temperature', '22.5');
```

### `getAllMetadataKeys(callback?: ResponseCallback<string[]>, errorCallback?: ErrorCallback, requestId?: string): void`
Retrieves all metadata keys.
```js
client.getAllMetadataKeys((keys) => {
  console.log('Metadata keys:', keys);
});
```

### `getMetadata(callback?: StatusCallback<Record<string, any>>, errorCallback?: ErrorCallback, requestId?: string): void`
Retrieves all metadata values.
```js
client.getMetadata((metadata) => {
  console.log('Metadata:', metadata);
});
```

### `publishMetadata(payload: MetadataPayload, callback?: StatusCallback, errorCallback?: ErrorCallback, requestId?: string): void`
Publishes a full metadata update.
```js
client.publishMetadata({ deviceId: '12345' });
```

### `publishMetadataKeys(metadata: MetadataPayload, callback?: StatusCallback, errorCallback?: ErrorCallback, requestId?: string): void`
Partially updates metadata keys.
```js
client.publishMetadataKeys({ deviceId: '12345' });
```

### `deleteMetadataKeys(keys: string[], callback?: StatusCallback, errorCallback?: ErrorCallback, requestId?: string): void`
Deletes a list of metadata keys.
```js
client.deleteMetadataKeys(['deviceId']);
```

### `getPendingCommands<T>(commandType: string, callback?: CommandsPendingCallback<T>, errorCallback?: ErrorCallback): void`
Gets a list of pending commands.
```js
client.getPendingCommands('reboot', (commands, topic, reportHandler) => {
  // Handle commands and report results
});
```

### `reportCommandExecutionResult<T>(commandType: string, results: CommandResult<T>[], errorCallback?: ErrorCallback, requestId?: string): void`
Reports the results of command execution.
```js
client.reportCommandExecutionResult('reboot', [{ id: 'cmd1', statusCode: 200, payload: 'OK' }]);
```

### `getConfigurationJson(payload: GetConfigurationPayload, callback?: ConfigurationPendingCallback, errorCallback?: ErrorCallback, requestId?: string): void`
Retrieves the configuration in JSON format.
```js
client.getConfigurationJson({}, (config) => {
  console.log('Configuration:', config);
});
```

### `reportAppliedConfiguration(payload: AppliedConfigurationPayload, callback?: ResponseCallback, errorCallback?: ErrorCallback, requestId?: string): void`
Reports the applied configuration.
```js
client.reportAppliedConfiguration({ configId: 'cfg123', statusCode: 200 });
```

### `reportCurrentSoftwareVersion(payload: ReportSoftwareRequestPayload, callback?: ResponseCallback, errorCallback?: ErrorCallback): void`
Reports the current software version.
```js
client.reportCurrentSoftwareVersion({ configId: 'sw123' });
```

### `getSoftwareUpdate(callback?: ResponseCallback<SoftwareResponse>, errorCallback?: ErrorCallback, requestId?: string): void`
Retrieves the software update information.
```js
client.getSoftwareUpdate((softwareInfo) => {
  console.log('Software update info:', softwareInfo);
});
```
