import { describe, it } from 'node:test';
import { deepStrictEqual, throws } from 'node:assert';
import { createOpenCandleFeed } from './normalize.js';
import {
  stringifyOpenCandleFeed,
  parseOpenCandleFeed,
  normalizeOpenCandleFeed,
} from './feed-codec.js';

const tuples = [
  [1_700_000_000_000, 100, 105, 99, 102, 500],
  [1_700_000_060_000, 102, 108, 101, 107, 600],
  [1_700_000_120_000, 107, 110, 106, 109, 450],
] as const;

describe('feed-codec', () => {
  it('round-trips a feed through object-v1 encoding', () => {
    const feed = createOpenCandleFeed([...tuples], {
      vendor: 'test', symbol: 'ETH/USD', interval: '1m',
    });
    const json = stringifyOpenCandleFeed(feed, 'object-v1');
    deepStrictEqual(parseOpenCandleFeed(json), feed);
  });

  it('round-trips a feed through tuple-v1 encoding', () => {
    const feed = createOpenCandleFeed([...tuples], {
      vendor: 'test', symbol: 'ETH/USD', interval: '1m',
    });
    const json = stringifyOpenCandleFeed(feed, 'tuple-v1');
    deepStrictEqual(parseOpenCandleFeed(json), feed);
  });

  it('normalizeOpenCandleFeed builds a feed from raw inputs', () => {
    const feed = normalizeOpenCandleFeed([...tuples], {
      vendor: 'test', symbol: 'ETH/USD', interval: '1m',
    });
    deepStrictEqual(feed.candles.length, 3);
    deepStrictEqual(feed.symbol, 'ETH/USD');
    deepStrictEqual(feed.startTime, tuples[0][0]);
    deepStrictEqual(feed.endTime, tuples[2][0]);
  });

  it('rejects invalid feed format', () => {
    throws(() => parseOpenCandleFeed('{"format":"wrong"}'), /Unsupported OpenCandle feed format/);
  });

  it('rejects invalid JSON', () => {
    throws(() => parseOpenCandleFeed('not json'), /Invalid OpenCandle JSON/);
  });
});
