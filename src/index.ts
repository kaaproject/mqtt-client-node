import { IClientOptions } from 'mqtt/*';
import { MQTTClientOptions } from './types';
import { KaaMqttClient } from './KaaMqttClient';

export { KaaMqttClient } from './KaaMqttClient';
export function createKaaMqttClient(
  clientOptions: MQTTClientOptions,
  options?: IClientOptions,
): KaaMqttClient {
  return new KaaMqttClient(clientOptions, options);
}
