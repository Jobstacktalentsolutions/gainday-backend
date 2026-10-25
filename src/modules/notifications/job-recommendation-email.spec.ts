import { descriptionSnippet, stripMarkdown } from './job-recommendation-email';

describe('stripMarkdown', () => {
  it('removes heading markers, including ones run into the sentence', () => {
    expect(
      stripMarkdown(
        '## Role Overview The role drives growth. ## Key Responsibilities',
      ),
    ).toBe('Role Overview The role drives growth. Key Responsibilities');
  });

  it('removes emphasis, list markers, links, and code ticks but keeps the words', () => {
    expect(
      stripMarkdown(
        '- **Lead** the team\n* Use `SQL` daily\n1. See [the guide](https://x.y)',
      ),
    ).toBe('Lead the team Use SQL daily See the guide');
  });

  it('leaves a hash inside a word alone', () => {
    expect(stripMarkdown('Experience with C# and F#')).toBe(
      'Experience with C# and F#',
    );
  });
});

describe('descriptionSnippet', () => {
  it('returns null for an empty description', () => {
    expect(descriptionSnippet(null)).toBeNull();
    expect(descriptionSnippet('   \n  ')).toBeNull();
  });

  it('shows a short description in full, with no dots', () => {
    expect(descriptionSnippet('Own the weekly funnel review.')).toBe(
      'Own the weekly funnel review.',
    );
  });

  it('adds dots when there are more lines than the snippet shows', () => {
    expect(
      descriptionSnippet('Line one\nLine two\nLine three\nLine four'),
    ).toBe('Line one Line two Line three...');
  });

  it('adds dots when the text is cut to the length limit, at a word boundary', () => {
    const long = 'word '.repeat(100);
    const snippet = descriptionSnippet(long);
    expect(snippet?.endsWith(' word...') || snippet?.endsWith('word...')).toBe(
      true,
    );
    expect(snippet!.length).toBeLessThanOrEqual(283);
  });

  it('strips markdown before measuring and trimming', () => {
    expect(descriptionSnippet('## Role Overview\n**Drive** revenue.')).toBe(
      'Role Overview Drive revenue.',
    );
  });
});
