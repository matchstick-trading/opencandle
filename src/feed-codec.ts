import { createOpenCandleFeed, normalizeOpenCandle, toOpenCandleTuple } from './normalize.js';
import type {
  CreateOpenCandleFeedOptions,
  OpenCandleFeedEncoding,
  OpenCandleFeedV1,
} from './types.js';

export const OPEN_CANDLE_FEED_FORMAT = 'opencandle/feed';
export const OPEN_CANDLE_FEED_FILE_VERSION = 1;
export const OPEN_CANDLE_TUPLE_COLUMNS = [
  'timestamp',
  'open',
  'high',
  'low',
  'close',
  'volume',
] as const;

export function stringifyOpenCandleFeed(
  feed: OpenCandleFeedV1,
  encoding: OpenCandleFeedEncoding = 'object-v1',
): string {
  const common = {
    format: OPEN_CANDLE_FEED_FORMAT,
    fileVersion: OPEN_CANDLE_FEED_FILE_VERSION,
    encoding,
    vendor: feed.vendor,
    symbol: feed.symbol,
    interval: feed.interval,
    startTime: feed.startTime,
    endTime: feed.endTime,
  };
  return JSON.stringify(
    encoding === 'tuple-v1'
      ? { ...common, columns: OPEN_CANDLE_TUPLE_COLUMNS, candles: feed.candles.map(toOpenCandleTuple) }
      : { ...common, candles: feed.candles },
  );
}

export function parseOpenCandleFeed(input: string | unknown): OpenCandleFeedV1 {
  const parsed = typeof input === 'string' ? parseJson(input) : input;
  const file = record(parsed, 'OpenCandle feed file');
  if (file.format !== OPEN_CANDLE_FEED_FORMAT) {
    throw new Error(`Unsupported OpenCandle feed format: ${String(file.format)}`);
  }
  if (file.fileVersion !== OPEN_CANDLE_FEED_FILE_VERSION) {
    throw new Error(`Unsupported OpenCandle feed file version: ${String(file.fileVersion)}`);
  }
  if (file.encoding !== 'object-v1' && file.encoding !== 'tuple-v1') {
    throw new Error(`Unsupported OpenCandle feed encoding: ${String(file.encoding)}`);
  }
  if (file.encoding === 'tuple-v1') validateColumns(file.columns);
  const options: CreateOpenCandleFeedOptions = {
    vendor: string(file.vendor, 'vendor'),
    symbol: string(file.symbol, 'symbol'),
    interval: string(file.interval, 'interval'),
  };
  const inputs = array(file.candles, 'candles');
  const feed = createOpenCandleFeed(inputs, options);
  if (feed.startTime !== number(file.startTime, 'startTime') || feed.endTime !== number(file.endTime, 'endTime')) {
    throw new Error('Invalid OpenCandle feed range');
  }
  return feed;
}

export function normalizeOpenCandleFeed(
  inputs: readonly unknown[],
  options: CreateOpenCandleFeedOptions,
): OpenCandleFeedV1 {
  return createOpenCandleFeed(
    inputs.map((input) => normalizeOpenCandle(input, options)),
    options,
  );
}

function validateColumns(value: unknown): void {
  const columns = array(value, 'columns');
  if (
    columns.length !== OPEN_CANDLE_TUPLE_COLUMNS.length ||
    columns.some((column, index) => column !== OPEN_CANDLE_TUPLE_COLUMNS[index])
  ) {
    throw new Error('Invalid OpenCandle tuple column contract');
  }
}

function parseJson(input: string): unknown {
  try {
    return JSON.parse(input) as unknown;
  } catch (error) {
    throw new Error(`Invalid OpenCandle JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${field}: expected object`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${field}: expected array`);
  return value;
}

function string(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${field}: expected non-empty string`);
  }
  return value;
}

function number(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${field}: expected finite number`);
  }
  return value;
}
