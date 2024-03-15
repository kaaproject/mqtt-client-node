export type ResponseCallback<T = any> = (response: T, topic: string) => void;
export type ErrorCallback<T = ErrorResponse> = (
  message: T,
  topic: string,
) => void;
export type StatusCallback<T = any> = (message: T, topic: string) => void;
export type DataSample = Record<string, any>;
export type PlainDataSample = number | string;
export type MetadataPayload = Record<string, any>;

export interface MQTTClientOptions {
  appVersionName: string;
  token: string;
  connectionUrl?: string;
  hostname?: string;
  port?: number;
  debug?: boolean;
}

export interface ErrorResponse {
  statusCode: number;
  reasonPhrase?: string;
}

export interface CommandStatus<T = Record<string, any> | string | number> {
  id: number;
  payload?: T;
}

export interface CommandResult<T = Record<string, any> | string | number> {
  id: number;
  // Follow HTTP status codes, 200 is OK, 400 is Bad Request, etc.
  statusCode: number;
  reasonPhrase?: string;
  payload?: T;
}

type CommandReportHandler<T> = (
  results: CommandResult<T>[],
  errorCallback?: ErrorCallback,
) => void;

export type CommandsPendingCallback<T = any> = (
  commandsStatuses: CommandStatus<T>[],
  topic: string,
  commandReportHandler: CommandReportHandler<T>,
) => void;

export interface GetConfigurationPayload {
  configId?: string;
  observe?: boolean;
}

export interface AppliedConfigurationPayload {
  configId: string;
  // Follow HTTP status codes, 200 is OK, 400 is Bad Request, etc.
  statusCode: number;
  reasonPhrase?: string;
}

interface ConfigurationResponse {
  configId: string;
  config: Record<string, any>;
  statusCode?: number;
  reasonPhrase?: string;
}

export type ConfigurationReportHandler = (
  config: AppliedConfigurationPayload,
  errorCallback?: ErrorCallback,
) => void;

export type ConfigurationPendingCallback = (
  configResponse: ConfigurationResponse,
  topic: string,
  reportConfig: ConfigurationReportHandler,
) => void;

export interface SoftwareResponse {
  configId: string;
  config: Record<string, any>;
  statusCode?: number;
  reasonPhrase?: string;
}

export interface ReportSoftwareRequestPayload {
  configId: string;
}
