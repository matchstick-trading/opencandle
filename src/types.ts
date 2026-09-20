export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/** Existing interface-over-storage contract. This shape itself is not serializable. */
export interface OpenCandleV1 {
  readonly '~bar': {
    readonly version: 1;
    readonly vendor: string;
    readonly timestamp: number;
    readonly open: number;
    readonly high: number;
    readonly low: number;
    readonly close: number;
    readonly volume: number;
    meta<T = unknown>(key: string): T | undefined;
  };
}

/** Compact OpenCandle/CCXT order: timestamp, open, high, low, close, volume. */
export type OpenCandleTupleV1 = readonly [
  timestamp: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
];

/** Canonical JSON-safe record used at persistence and transport boundaries. */
export interface OpenCandleRecordV1 {
  version: 1;
  vendor: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  meta: Record<string, JsonValue>;
}

export interface OpenCandleFeedV1 {
  version: 1;
  vendor: string;
  symbol: string;
  interval: string;
  candles: OpenCandleRecordV1[];
  startTime: number;
  endTime: number;
}

export interface OpenCandleState {
  symbol: string;
  interval: string;
  candles: Map<number, OpenCandleRecordV1>;
  lastUpdate: number;
}

export interface OpenCandleDiff {
  symbol: string;
  interval: string;
  candle: OpenCandleRecordV1;
}

export interface NormalizeOpenCandleOptions {
  vendor?: string;
  /** The V1 callable interface cannot discover metadata keys, so callers opt in explicitly. */
  metaKeys?: readonly string[];
}

export interface CreateOpenCandleFeedOptions {
  vendor: string;
  symbol: string;
  interval: string;
  metaKeys?: readonly string[];
}

export type OpenCandleFeedEncoding = 'object-v1' | 'tuple-v1';
