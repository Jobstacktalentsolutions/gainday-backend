import { isBot } from './bot-filter';

describe('isBot', () => {
  it('lets a browser through', () => {
    expect(
      isBot(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36',
      ),
    ).toBe(false);
  });

  it('filters known crawlers and headless browsers', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isBot('HeadlessChrome/120.0')).toBe(true);
  });

  it('treats a missing user agent as automated', () => {
    expect(isBot(undefined)).toBe(true);
  });
});
