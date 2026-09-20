# OpenCandle

Open schema for OHLCV (candlestick) market data with extensible metadata. Write Once. Trade Everywhere.

The `meta` field on each candle lets tools attach per-bar facts -- signals, labels, indicators, classifications -- without modifying the core schema.

## Input formats

OpenCandle normalizes three representations into one canonical record:

| Format | Shape |
|--------|-------|
| **Tuple** | `[timestamp, open, high, low, close, volume]` (CCXT order) |
| **Object** | `{ timestamp, open, high, low, close, volume, meta? }` |
| **Interface** | `{ '~bar': { version, vendor, timestamp, open, high, low, close, volume, meta() } }` |

## Canonical record

```typescript
interface OpenCandleRecordV1 {
  version: 1;
  vendor: string;
  timestamp: number;   // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  meta: Record<string, JsonValue>;
}
```

## Usage

```typescript
import { normalizeOpenCandle, createOpenCandleFeed } from '@matchstick-trading/opencandle';

// From a CCXT-style tuple
const candle = normalizeOpenCandle([1726704000000, 5432.25, 5445.00, 5420.50, 5438.75, 125000]);

// From an object
const candle2 = normalizeOpenCandle({
  timestamp: 1726704000000,
  open: 5432.25, high: 5445.00, low: 5420.50, close: 5438.75,
  volume: 125000,
  meta: { signal: 'buy', confidence: 0.92 }
});

// Build a feed
const feed = createOpenCandleFeed(tuples, {
  vendor: 'kraken', symbol: 'BTC/USD', interval: '1m'
});
```

## Protobuf

See [`proto/opencandle.proto`](proto/opencandle.proto) for the wire format.

## License

MIT -- [Matchstick Trading](https://github.com/matchstick-trading)
