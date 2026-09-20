import { describe, it } from 'node:test';
import { deepStrictEqual, throws, doesNotThrow } from 'node:assert';
import {
  normalizeOpenCandle,
  createOpenCandleFeed,
} from './normalize.js';
import {
  stringifyOpenCandleFeed,
  parseOpenCandleFeed,
} from './feed-codec.js';

const tuple = [1_700_000_000_000, 100, 105, 99, 102, 500] as const;

describe('OpenCandle normalization', () => {
  it('normalizes tuple, object, proto-shaped, and callable interface inputs', () => {
    const object = {
      timestamp: tuple[0], open: 100, high: 105, low: 99, close: 102, volume: 500,
    };
    const proto = { version: 1, vendor: 'demo', ...object, meta: { signal: 'BUY' } };
    const wrapper = {
      '~bar': {
        version: 1 as const,
        vendor: 'demo',
        get timestamp() { return tuple[0]; },
        get open() { return 100; },
        get high() { return 105; },
        get low() { return 99; },
        get close() { return 102; },
        get volume() { return 500; },
        meta(key: string) { return key === 'signal' ? 'BUY' : undefined; },
      },
    };

    const expected = normalizeOpenCandle(proto);
    deepStrictEqual(normalizeOpenCandle(tuple, { vendor: 'demo' }), { ...expected, meta: {} });
    deepStrictEqual(normalizeOpenCandle(object, { vendor: 'demo' }), { ...expected, meta: {} });
    deepStrictEqual(normalizeOpenCandle(wrapper, { metaKeys: ['signal'] }), expected);
    doesNotThrow(() => structuredClone(expected));
  });

  it('rejects ambiguous arrays and invalid OHLC bounds', () => {
    throws(() => normalizeOpenCandle([...tuple, 7]), /Ambiguous OpenCandle array/);
    throws(() => normalizeOpenCandle({
      timestamp: tuple[0], open: 100, high: 101, low: 99, close: 102, volume: 500,
    }), /OHLC bounds/);
  });

  it('rejects non-JSON metadata objects at the persistence boundary', () => {
    throws(() => normalizeOpenCandle({
      timestamp: tuple[0], open: 100, high: 105, low: 99, close: 102, volume: 500,
      meta: { unsafe: new Date() },
    }), /plain JSON object/);
  });

  it('round-trips object and compact LLM feeds', () => {
    const feed = createOpenCandleFeed([
      tuple,
      [tuple[0] + 60_000, 102, 108, 101, 107, 600],
    ], { vendor: 'demo', symbol: 'BTC/USD', interval: '1m' });
    const objectJson = stringifyOpenCandleFeed(feed, 'object-v1');
    const compactJson = stringifyOpenCandleFeed(feed, 'tuple-v1');

    deepStrictEqual(parseOpenCandleFeed(objectJson), feed);
    deepStrictEqual(parseOpenCandleFeed(compactJson), feed);

    if (compactJson.length >= objectJson.length) {
      throw new Error('Expected compact encoding to be shorter than object encoding');
    }
  });
});
