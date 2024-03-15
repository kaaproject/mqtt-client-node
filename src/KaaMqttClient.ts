import * as mqtt from 'mqtt';
import { randomInt } from 'crypto';
import { IClientOptions } from 'mqtt';
import { safeJson } from './json';
import {
  AppliedConfigurationPayload,
  CommandResult,
  CommandsPendingCallback,
  ConfigurationPendingCallback,
  DataSample,
  ErrorCallback,
  ErrorResponse,
  GetConfigurationPayload,
  MQTTClientOptions,
  MetadataPayload,
  PlainDataSample,
  ReportSoftwareRequestPayload,
  ResponseCallback,
  SoftwareResponse,
  StatusCallback,
} from './types';

export class KaaMqttClient {
  private client: mqtt.MqttClient;
  private appVersionName: string;
  private token: string;

  constructor(
    private clientOptions: MQTTClientOptions,
    options?: IClientOptions,
  ) {
    const { appVersionName, token } = clientOptions;
    this.client = mqtt.connect(this.getConnectionUrl(clientOptions), {
      keepalive: 60,
      ...options,
    });
    this.client.on('error', (error) => {
      console.error('Error occurred:', error);
    });
    this.appVersionName = appVersionName;
    this.token = token;
  }

  private debugLog(...args: any[]) {
    if (this.clientOptions.debug) {
      console.debug(...['[KaaMqttClient] ', ...args]);
    }
  }

  private getConnectionUrl(options: MQTTClientOptions): string {
    if (options.hostname) {
      return `mqtt://${options.hostname}:${options.port || 1883}`;
    }

    if (options.connectionUrl) {
      return options.connectionUrl;
    }

    if (!options.hostname && !options.connectionUrl) {
      throw new Error('Either hostname or connectionUrl must be specified');
    }

    return '';
  }

  private subscribeToResponseTopics<R = any>(
    baseTopic: string,
    callback?: ResponseCallback<R>,
    errorCallback?: ErrorCallback,
  ): void {
    this.client.subscribe(`${baseTopic}/+`);
    this.debugLog('[REQUEST SUB] Subscribed to', `${baseTopic}/+`);

    const messageHandler = async (topic: string, messageBufer: Buffer) => {
      if (!topic.startsWith(baseTopic)) {
        return;
      }
      const message = messageBufer?.toString();
      this.debugLog('[RESPONSE] Received response', topic, message);
      if (topic.endsWith('/status')) {
        const payload = safeJson<R>(message);
        callback && callback(payload as R, topic);
      } else if (topic.endsWith('/error')) {
        const error = safeJson<ErrorResponse>(message?.toString());
        errorCallback && errorCallback(error as ErrorResponse, topic);
      }
    };

    this.client.on('message', messageHandler);
  }

  /**
   * Publish single or multiple data samples
   *
   * @param dataSamples
   * @param callback
   * @param errorCallback
   * @param requestId
   */
  public publishDataCollection(
    dataSamples: DataSample | DataSample[],
    callback?: StatusCallback<void>,
    errorCallback?: ErrorCallback,
    requestId?: string,
  ): void {
    const topic = `kp1/${this.appVersionName}/dcx/${this.token}/json${requestId ? `/${requestId}` : ''}`;
    const payload = JSON.stringify(dataSamples);
    this.debugLog('[DATA COLLECTION] Sending data samples', topic, payload);
    this.client.publish(topic, payload);
    this.subscribeToResponseTopics(topic, callback, errorCallback);
  }

  /**
   * Publish plain data sample with a metric name
   *
   * @param metricName
   * @param dataSample
   * @param callback
   * @param errorCallback
   * @param requestId
   */
  public publishPlainDataSample(
    metricName: string,
    dataSample: PlainDataSample,
    callback?: StatusCallback<void>,
    errorCallback?: ErrorCallback,
    requestId?: string,
  ): void {
    const topic = `kp1/${this.appVersionName}/dcx/${this.token}/plain/${metricName}${requestId ? `/${requestId}` : ''}`;
    const payload =
      typeof dataSample === 'string' ? dataSample : dataSample.toString();
    this.debugLog('[DATA COLLECTION] Sending data samples', topic, payload);
    this.client.publish(topic, payload);
    this.subscribeToResponseTopics(topic, callback, errorCallback);
  }

  /**
   * Get all metadata keys
   *
   * @param callback
   * @param errorCallback
   * @param requestId
   */
  public getAllMetadataKeys(
    callback?: ResponseCallback<string[]>,
    errorCallback?: ErrorCallback,
    requestId: string = randomInt(1, 100).toString(),
  ): void {
    const topic = `kp1/${this.appVersionName}/epmx/${this.token}/get/keys/${requestId}`;
    this.debugLog('[METADATA] Getting all metadata keys', topic);
    this.subscribeToResponseTopics(
      topic,
      callback
        ? (message, topic) => {
            const keys = safeJson<string[]>(message) || [];
            callback(keys, topic);
          }
        : undefined,
      errorCallback,
    );
    this.client.publish(topic, '');
  }

  /**
   * Get all metadata values
   *
   * @param callback
   * @param errorCallback
   * @param requestId
   */
  public getMetadata(
    callback?: StatusCallback<Record<string, any>>,
    errorCallback?: ErrorCallback,
    requestId: string = randomInt(1, 100).toString(),
  ): void {
    const topic = `kp1/${this.appVersionName}/epmx/${this.token}/get/${requestId}`;
    this.debugLog('[METADATA] Getting metadata', topic);
    this.client.publish(topic, '');
    this.subscribeToResponseTopics(
      topic,
      callback
        ? (message, topic) => {
            const metadata = safeJson<Record<string, any>>(message);
            if (metadata) {
              callback(metadata, topic);
            }
          }
        : undefined,
      errorCallback,
    );
  }

  /**
   * Full metadata update
   *
   * @param payload
   * @param requestId
   * @param callback
   * @param errorCallback
   */
  public publishMetadata(
    payload: MetadataPayload,
    callback?: StatusCallback,
    errorCallback?: ErrorCallback,
    requestId?: string,
  ): void {
    const topic = `kp1/${this.appVersionName}/epmx/${this.token}/update${requestId ? `/${requestId}` : ''}`;
    this.client.publish(topic, JSON.stringify(payload));
    this.debugLog('[METADATA] Publish full metadata update', topic, payload);
    this.subscribeToResponseTopics(topic, callback, errorCallback);
  }

  /**
   * Partially update metadata keys
   *
   * @param metadata
   * @param requestId
   * @param callback
   * @param errorCallback
   */
  public publishMetadataKeys(
    metadata: MetadataPayload,
    callback?: StatusCallback,
    errorCallback?: ErrorCallback,
    requestId?: string,
  ): void {
    const topic = `kp1/${this.appVersionName}/epmx/${this.token}/update/keys${requestId ? `/${requestId}` : ''}`;
    this.debugLog('[METADATA] Publish metadata keys update', topic, metadata);
    this.client.publish(topic, JSON.stringify(metadata));
    if (requestId && callback && errorCallback) {
      this.subscribeToResponseTopics(topic, callback, errorCallback);
    }
  }

  /**
   * Delete list of metadata keys
   *
   * @param keys
   * @param callback
   * @param errorCallback
   * @param requestId
   */
  public deleteMetadataKeys(
    keys: string[],
    callback?: StatusCallback,
    errorCallback?: ErrorCallback,
    requestId?: string,
  ): void {
    const topic = `kp1/${this.appVersionName}/epmx/${this.token}/delete/keys${requestId ? `/${requestId}` : ''}`;
    this.client.publish(topic, JSON.stringify(keys));
    this.subscribeToResponseTopics(topic, callback, errorCallback);
  }

  /**
   * Get list of pending commands.
   * Callback is called with the list of pending commands and a handler to report the results.
   * Report handler should be called with the results of the command execution.
   *
   * @example
   * ```typescript
   * client.getPendingCommands('commandType', (commands, topic, reportHandler) => {
   *  // Handle commands
   * const results = commands.map((command) => {
   *  // Execute command
   * return {
   * id: command.id,
   * statusCode: 200,
   * payload: 'OK',
   * };
   * });
   * ```
   *
   * @param commandType
   * @param callback
   * @param errorCallback
   */
  public getPendingCommands<T>(
    commandType: string,
    callback?: CommandsPendingCallback<T>,
    errorCallback?: ErrorCallback,
  ): void {
    const topic = `kp1/${this.appVersionName}/cex/${this.token}/command/${commandType}`;
    this.debugLog('[COMMANDS] Subscribing to commands', `${topic}/+`);
    this.subscribeToResponseTopics(
      topic,
      callback
        ? (response) => {
            callback(response, topic, (results, errorCallback) => {
              this.reportCommandExecutionResult(
                commandType,
                results,
                errorCallback,
              );
            });
          }
        : undefined,
      errorCallback,
    );
  }

  public reportCommandExecutionResult<T>(
    commandType: string,
    results: CommandResult<T>[],
    errorCallback?: ErrorCallback,
    requestId?: string,
  ): void {
    const topic = `kp1/${this.appVersionName}/cex/${this.token}/result/${commandType}${requestId ? `/${requestId}` : ''}`;
    const payload = JSON.stringify(results);
    this.client.publish(topic, payload);
    this.subscribeToResponseTopics(topic, () => {}, errorCallback);
  }

  public getConfigurationJson(
    payload: GetConfigurationPayload = {},
    callback?: ConfigurationPendingCallback,
    errorCallback?: ErrorCallback,
    requestId?: string,
  ): void {
    const configTopic = `kp1/${this.appVersionName}/cmx/${this.token}/config/json${requestId ? `/${requestId}` : ''}`;
    this.client.publish(configTopic, JSON.stringify(payload));
    this.debugLog('[CONFIGURATION] Getting configuration', configTopic);
    this.subscribeToResponseTopics(
      configTopic,
      callback
        ? (response, topic) => {
            callback(response, topic, (config, errorCallback) => {
              this.reportAppliedConfiguration(config, undefined, errorCallback);
            });
          }
        : undefined,
      errorCallback,
    );
  }

  public reportAppliedConfiguration(
    payload: AppliedConfigurationPayload,
    callback?: ResponseCallback,
    errorCallback?: ErrorCallback,
    requestId?: string,
  ) {
    const topic = `kp1/${this.appVersionName}/cmx/${this.token}/applied/json${requestId ? `/${requestId}` : ''}`;
    this.client.publish(topic, JSON.stringify(payload));
    this.debugLog(
      '[CONFIGURATION] Reporting applied configuration',
      topic,
      payload,
    );
    this.subscribeToResponseTopics(topic, callback, errorCallback);
  }

  public reportCurrentSoftwareVersion(
    payload: ReportSoftwareRequestPayload,
    callback?: ResponseCallback,
    errorCallback?: ErrorCallback,
  ) {
    const topic = `kp1/${this.appVersionName}/cmx_ota/${this.token}/applied/json`;
    this.client.publish(topic, JSON.stringify(payload));
    this.debugLog(
      '[SOFTWARE] Reporting current software version',
      topic,
      payload,
    );
    this.subscribeToResponseTopics(topic, callback, errorCallback);
  }

  public getSoftwareUpdate(
    callback?: ResponseCallback<SoftwareResponse>,
    errorCallback?: ErrorCallback,
    requestId?: string,
  ): void {
    const topic = `kp1/${this.appVersionName}/cmx_ota/${this.token}/config/json${requestId ? `/${requestId}` : ''}`;
    this.client.publish(topic, JSON.stringify({}));
    this.debugLog('[SOFTWARE] Getting software version', topic);
    this.subscribeToResponseTopics(topic, callback, errorCallback);
  }

  public disconnect(callback?: mqtt.DoneCallback) {
    this.client.end(callback);
  }

  public connect() {
    this.client.connect();
  }
}
