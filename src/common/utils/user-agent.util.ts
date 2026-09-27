export interface UserAgentInfo {
  browser: string | null;
  os: string | null;
  device: string | null;
}

const WINDOWS_RELEASES: Record<string, string> = {
  '10.0': 'Windows 10',
  '6.3': 'Windows 8.1',
  '6.2': 'Windows 8',
  '6.1': 'Windows 7',
  '6.0': 'Windows Vista',
  '5.2': 'Windows XP',
  '5.1': 'Windows XP',
};

/**
 * Ordered from most specific to least specific: Edge, Opera and Samsung
 * Internet all advertise "Chrome/" in their user agent, and Safari matches
 * "Safari/" on almost every engine, so the generic patterns must come last.
 */
const BROWSER_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['Edge', /Edg(?:e|A|iOS)?\/[\d.]+/],
  ['Opera', /(?:OPR|OPiOS|Opera)\/[\d.]+/],
  ['Samsung Internet', /SamsungBrowser\/[\d.]+/],
  ['Firefox', /(?:Firefox|FxiOS)\/[\d.]+/],
  ['Chrome', /(?:Chrome|CriOS|Chromium)\/[\d.]+/],
  ['Safari', /Version\/[\d.]+.*\bSafari\//],
  ['Internet Explorer', /MSIE [\d.]+|Trident\/[\d.]+/],
];

/**
 * API clients and crawlers. They are not browsers, so they fall through the
 * browser patterns and need a name of their own.
 */
const TOOL_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['Postman', /PostmanRuntime|postman-token/],
  ['Insomnia', /Insomnia/],
  ['HTTPie', /HTTPie/],
  ['curl', /\bcurl\//],
  ['axios', /\baxios\//],
  ['node-fetch', /node-fetch/],
  ['Python requests', /python-requests|python-urllib/],
  ['Googlebot', /Googlebot/],
];

const OS_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['Chrome OS', /CrOS/],
  ['iOS', /(?:iPhone )?OS (\d+)[._](\d+)/],
  ['Android', /Android[ /]([\d.]+)/],
  ['Windows', /Windows NT ([\d.]+)/],
  ['macOS', /Mac OS X|Macintosh/],
  ['Linux', /Linux|X11/],
  ['Windows', /Windows/],
];

/**
 * Android reports a build model between the OS version and "Build". Codes such
 * as "K" or "A1" identify no real device, so they are ignored and the generic
 * "Android" label is used instead.
 */
const GENERIC_DEVICE_CODES = new Set([
  'K',
  'A1',
  'A2',
  'A3',
  'A1s',
  'Android',
  'Android SDK',
  'sdk',
  'webOS',
  'Series S',
]);

function toVersion(parts: string[]): string {
  const [major, minor] = parts;

  return minor ? `${major}.${minor}` : major;
}

function detectBrowser(userAgent: string): string | null {
  for (const [name, pattern] of BROWSER_PATTERNS) {
    if (pattern.test(userAgent)) {
      return name;
    }
  }

  for (const [name, pattern] of TOOL_PATTERNS) {
    if (pattern.test(userAgent)) {
      return name;
    }
  }

  return null;
}

function detectOs(userAgent: string): string | null {
  for (const [name, pattern] of OS_PATTERNS) {
    const match = userAgent.match(pattern);

    if (!match) {
      continue;
    }

    if (name === 'Windows') {
      return WINDOWS_RELEASES[match[1]] ?? 'Windows';
    }

    if (name === 'iOS') {
      return `iOS ${toVersion([match[1], match[2]])}`;
    }

    if (name === 'Android') {
      return `Android ${match[1].split('.').slice(0, 2).join('.')}`;
    }

    return name;
  }

  return null;
}

function detectDevice(userAgent: string): string | null {
  if (/\b(iPhone|iPad|iPod)\b/.test(userAgent)) {
    return userAgent.match(/\b(iPhone|iPad|iPod)\b/)?.[1] ?? null;
  }

  if (/\bQuest\b/.test(userAgent)) {
    return 'Quest';
  }

  const androidModel = userAgent.match(
    /Android[ /][\d.]+;\s*([^;)]+?)(?:\s+Build[^)]*)?\)/,
  );

  if (androidModel) {
    const model = androidModel[1].trim();

    if (!GENERIC_DEVICE_CODES.has(model) && !/^[A-Z]?\d?$/i.test(model)) {
      return model.replace(/^SAMSUNG\s+/i, '');
    }
  }

  if (/\bAndroid\b/.test(userAgent)) {
    return 'Android';
  }

  return null;
}

export function parseUserAgent(userAgent: string): UserAgentInfo {
  if (!userAgent?.trim()) {
    return { browser: null, os: null, device: null };
  }

  return {
    browser: detectBrowser(userAgent),
    os: detectOs(userAgent),
    device: detectDevice(userAgent),
  };
}

/**
 * Last resort for unrecognised clients: the leading product token, as in
 * "MyApp/2.1 (iOS; build 17)".
 */
function detectProductToken(userAgent: string): string | null {
  const token = userAgent.trim().match(/^([^\s/(;]+)/)?.[1];

  if (!token || !/^[A-Za-z][\w.+-]*$/.test(token)) {
    return null;
  }

  return token.length > 32 ? token.slice(0, 32) : token;
}

/**
 * Builds a short human readable device label such as "Safari on iPhone" or
 * "Chrome on Windows 10". Returns null when nothing recognisable is found, so
 * callers can fall back to a client supplied name.
 */
export function parseDeviceName(userAgent: string): string | null {
  const { browser, os, device } = parseUserAgent(userAgent);
  const target = device ?? os;

  if (browser && target) {
    return `${browser} on ${target}`;
  }

  return target ?? browser ?? detectProductToken(userAgent);
}
