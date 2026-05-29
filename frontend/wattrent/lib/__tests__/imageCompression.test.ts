import { base64ToBytes, compressForOcr } from '../imageCompression';

describe('base64ToBytes', () => {
  it('decodes a simple ASCII payload', () => {
    const bytes = base64ToBytes('SGVsbG8='); // "Hello"
    expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
  });

  it('produces a Uint8Array', () => {
    const bytes = base64ToBytes('SGVsbG8=');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(5);
  });

  it('handles an empty string', () => {
    const bytes = base64ToBytes('');
    expect(bytes.length).toBe(0);
  });
});

describe('compressForOcr', () => {
  it('calls expo-image-manipulator with 1024px width + jpeg + 0.7 quality', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const manipulator = require('expo-image-manipulator');
    manipulator.manipulateAsync.mockClear();

    const result = await compressForOcr('file:///raw.jpg');

    expect(manipulator.manipulateAsync).toHaveBeenCalledTimes(1);
    const [uri, actions, options] = manipulator.manipulateAsync.mock.calls[0];
    expect(uri).toBe('file:///raw.jpg');
    expect(actions).toEqual([{ resize: { width: 1024 } }]);
    expect(options.compress).toBe(0.7);
    expect(options.format).toBe(manipulator.SaveFormat.JPEG);
    expect(options.base64).toBe(true);

    expect(result.uri).toBe('file:///tmp/fake-compressed.jpg');
    expect(result.base64).toBe('SGVsbG8=');
    // ceil/floor approximation: (8 chars - 1 padding) * 3/4 ≈ 5, but our
    // simple formula returns Math.floor(8 * 3 / 4) = 6.
    expect(result.approxBytes).toBe(6);
  });

  it('throws if the manipulator returns no base64', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const manipulator = require('expo-image-manipulator');
    manipulator.manipulateAsync.mockResolvedValueOnce({
      uri: 'file:///x.jpg',
      width: 0,
      height: 0,
    });
    await expect(compressForOcr('file:///r.jpg')).rejects.toThrow(/no base64/);
  });
});
