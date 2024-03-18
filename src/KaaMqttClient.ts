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
  private subscriptions: Record<
    string,
    { callback?: ResponseCallback<any>; errorCallback?: ErrorCallback }
  > = {};

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
    this.client.on('message', this.handleMessage.bind(this));
  }

  private handleMessage(topic: string, messageBuffer: Buffer): void {
    const message = messageBuffer.toString();
    Object.keys(this.subscriptions).forEach((baseTopic) => {
      if (topic.startsWith(baseTopic)) {
        this.debugLog('[MESSAGE] Handling message for topic', topic);
        const { callback, errorCallback } = this.subscriptions[baseTopic];
        if (topic.endsWith('/status') && callback) {
          const payload = safeJson(message);
          callback(payload, topic);
        } else if (topic.endsWith('/error') && errorCallback) {
          const error = safeJson<ErrorResponse>(message) as ErrorResponse;
          errorCallback(error, topic);
        }
      }
    });
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
    if (!callback && !errorCallback) {
      return;
    }

    this.subscriptions[baseTopic] = { callback, errorCallback };
    this.client.subscribe(`${baseTopic}/+`, (err, granted) => {
      if (err) {
        this.debugLog('[SUBSCRIBE] Error subscribing to topic', baseTopic, err);
        errorCallback &&
          errorCallback(
            { reasonPhrase: err.message, statusCode: 500 },
            baseTopic,
          );
      } else {
        if (granted && granted[0]) {
          this.debugLog('[SUBSCRIBE] Subscribed to topic', granted[0].topic);
        }
      }
    });
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
    this.subscribeToResponseTopics(topic, callback, errorCallback);
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
    this.subscribeToResponseTopics(topic, callback, errorCallback);
    this.client.publish(topic, '');
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
    this.debugLog('[METADATA] Publish full metadata update', topic, payload);
    this.subscribeToResponseTopics(topic, callback, errorCallback);
    this.client.publish(topic, JSON.stringify(payload));
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
    this.subscribeToResponseTopics(topic, callback, errorCallback);
    this.client.publish(topic, JSON.stringify(metadata));
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
    this.subscribeToResponseTopics(topic, callback, errorCallback);
    this.client.publish(topic, JSON.stringify(keys));
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
    this.subscribeToResponseTopics(topic, undefined, errorCallback);
    this.client.publish(topic, payload);
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
    this.debugLog(
      '[SOFTWARE] Reporting current software version',
      topic,
      payload,
    );
    this.subscribeToResponseTopics(topic, callback, errorCallback);
    this.client.publish(topic, JSON.stringify(payload));
  }

  public getSoftwareUpdate(
    callback?: ResponseCallback<SoftwareResponse>,
    errorCallback?: ErrorCallback,
    requestId?: string,
  ): void {
    const topic = `kp1/${this.appVersionName}/cmx_ota/${this.token}/config/json${requestId ? `/${requestId}` : ''}`;
    this.debugLog('[SOFTWARE] Getting software version', topic);
    this.subscribeToResponseTopics(topic, callback, errorCallback);
    this.client.publish(topic, JSON.stringify({}));
  }

  /**
   * Safely unsubscribe from all subscriptions and clear the subscriptions record.
   */
  public disconnect(callback?: mqtt.DoneCallback) {
    const topics = Object.keys(this.subscriptions);
    if (topics.length === 0) {
      this.client.end(callback);
      return;
    }
    this.client.unsubscribe(topics, (err) => {
      if (err) {
        this.debugLog('[DESTROY] Error unsubscribing from topics', err);
      } else {
        this.debugLog('[DESTROY] Successfully unsubscribed from all topics');
      }
      this.subscriptions = {};
      this.client.end(callback);
    });
  }

  public connect() {
    this.client.connect();
  }
}
