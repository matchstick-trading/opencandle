import type {
  CreateOpenCandleFeedOptions,
  JsonValue,
  NormalizeOpenCandleOptions,
  OpenCandleFeedV1,
  OpenCandleRecordV1,
  OpenCandleTupleV1,
} from './types.js';

const CANDLE_FIELDS = ['timestamp', 'open', 'high', 'low', 'close', 'volume'] as const;

/** Normalize documented OpenCandle V1 storage representations into cloneable data. */
export function normalizeOpenCandle(
  input: unknown,
  options: NormalizeOpenCandleOptions = {},
): OpenCandleRecordV1 {
  if (Array.isArray(input)) return fromTuple(input, options.vendor ?? 'tuple');

  const candidate = record(input, 'OpenCandle');
  if ('~bar' in candidate) return fromInterface(candidate['~bar'], options);
  return fromObject(candidate, options.vendor);
}

export function createOpenCandleFeed(
  inputs: readonly unknown[],
  options: CreateOpenCandleFeedOptions,
): OpenCandleFeedV1 {
  if (inputs.length === 0) throw new Error('OpenCandle feed requires at least one candle');
  const candles = inputs
    .map((input) => normalizeOpenCandle(input, options))
    .sort((left, right) => left.timestamp - right.timestamp);
  const timestamps = new Set<number>();
  for (const candle of candles) {
    if (timestamps.has(candle.timestamp)) {
      throw new Error(`OpenCandle feed contains duplicate timestamp ${candle.timestamp}`);
    }
    timestamps.add(candle.timestamp);
  }
  const first = candles[0];
  const last = candles[candles.length - 1];
  if (!first || !last) throw new Error('OpenCandle feed requires at least one candle');
  return {
    version: 1,
    vendor: nonEmpty(options.vendor, 'feed vendor'),
    symbol: nonEmpty(options.symbol, 'feed symbol'),
    interval: nonEmpty(options.interval, 'feed interval'),
    candles,
    startTime: first.timestamp,
    endTime: last.timestamp,
  };
}

export function toOpenCandleTuple(candle: OpenCandleRecordV1): OpenCandleTupleV1 {
  return [
    candle.timestamp,
    candle.open,
    candle.high,
    candle.low,
    candle.close,
    candle.volume,
  ];
}

function fromTuple(input: unknown[], vendor: string): OpenCandleRecordV1 {
  if (input.length !== CANDLE_FIELDS.length) {
    throw new Error(
      `Ambiguous OpenCandle array: expected exactly 6 fields, received ${input.length}`,
    );
  }
  return validated({
    version: 1,
    vendor: nonEmpty(vendor, 'vendor'),
    timestamp: numeric(input[0], 'timestamp'),
    open: numeric(input[1], 'open'),
    high: numeric(input[2], 'high'),
    low: numeric(input[3], 'low'),
    close: numeric(input[4], 'close'),
    volume: numeric(input[5], 'volume'),
    meta: {},
  });
}

function fromInterface(
  input: unknown,
  options: NormalizeOpenCandleOptions,
): OpenCandleRecordV1 {
  const core = record(input, 'OpenCandle ~bar');
  if (core.version !== 1) throw new Error(`Unsupported OpenCandle version: ${String(core.version)}`);
  if (typeof core.meta !== 'function') throw new Error('Invalid OpenCandle ~bar.meta accessor');
  const metadata: Record<string, JsonValue> = {};
  const keys = options.metaKeys ?? [];
  if (new Set(keys).size !== keys.length) throw new Error('OpenCandle metadata keys must be unique');
  for (const key of keys) {
    const normalizedKey = nonEmpty(key, 'metadata key');
    const value = core.meta(normalizedKey) as unknown;
    if (value !== undefined) metadata[normalizedKey] = jsonValue(value, `meta.${normalizedKey}`);
  }
  return validated({
    version: 1,
    vendor: nonEmpty(options.vendor ?? core.vendor, 'vendor'),
    timestamp: numeric(core.timestamp, 'timestamp'),
    open: numeric(core.open, 'open'),
    high: numeric(core.high, 'high'),
    low: numeric(core.low, 'low'),
    close: numeric(core.close, 'close'),
    volume: numeric(core.volume, 'volume'),
    meta: metadata,
  });
}

function fromObject(
  input: Record<string, unknown>,
  fallbackVendor: string | undefined,
): OpenCandleRecordV1 {
  if (input.version !== undefined && input.version !== 1) {
    throw new Error(`Unsupported OpenCandle version: ${String(input.version)}`);
  }
  const metadata = input.meta === undefined
    ? {}
    : jsonObject(input.meta, 'meta');
  return validated({
    version: 1,
    vendor: nonEmpty(input.vendor ?? fallbackVendor ?? 'object', 'vendor'),
    timestamp: numeric(input.timestamp, 'timestamp'),
    open: numeric(input.open, 'open'),
    high: numeric(input.high, 'high'),
    low: numeric(input.low, 'low'),
    close: numeric(input.close, 'close'),
    volume: numeric(input.volume, 'volume'),
    meta: metadata,
  });
}

function validated(candle: OpenCandleRecordV1): OpenCandleRecordV1 {
  if (!Number.isSafeInteger(candle.timestamp) || candle.timestamp < 0) {
    throw new Error('Invalid OpenCandle timestamp: expected non-negative Unix milliseconds');
  }
  if (candle.volume < 0) throw new Error('Invalid OpenCandle volume: expected non-negative value');
  const ceiling = Math.max(candle.open, candle.close, candle.low);
  const floor = Math.min(candle.open, candle.close, candle.high);
  if (candle.high < ceiling || candle.low > floor) {
    throw new Error('Invalid OpenCandle OHLC bounds');
  }
  return candle;
}

function numeric(value: unknown, field: string): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim().length > 0
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(parsed)) throw new Error(`Invalid OpenCandle ${field}: expected finite number`);
  return parsed;
}

function nonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid OpenCandle ${field}: expected non-empty string`);
  }
  return value.trim();
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${field}: expected object`);
  }
  return value as Record<string, unknown>;
}

function jsonObject(value: unknown, field: string): Record<string, JsonValue> {
  const source = record(value, field);
  const prototype = Object.getPrototypeOf(source) as unknown;
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`Invalid ${field}: expected plain JSON object`);
  }
  const result: Record<string, JsonValue> = {};
  for (const [key, candidate] of Object.entries(source)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
      throw new Error(`Invalid ${field} key: ${key}`);
    }
    result[key] = jsonValue(candidate, `${field}.${key}`);
  }
  return result;
}

function jsonValue(value: unknown, field: string): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Invalid ${field}: number must be finite`);
    return value;
  }
  if (value instanceof Uint8Array) return [...value];
  if (Array.isArray(value)) return value.map((candidate, index) => jsonValue(candidate, `${field}[${index}]`));
  return jsonObject(value, field);
}
