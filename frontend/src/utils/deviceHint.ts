import type { DeviceKind } from '@nearby/shared/chat';

export function deviceHint(agent: string = navigator.userAgent): {
  name: string;
  kind: DeviceKind;
} {
  const system = /iPad/i.test(agent)
    ? 'iPad'
    : /iPhone/i.test(agent)
      ? 'iPhone'
      : /Android/i.test(agent)
        ? 'Android'
        : /Windows/i.test(agent)
          ? 'Windows'
          : /Macintosh|Mac OS/i.test(agent)
            ? 'Mac'
            : /Linux/i.test(agent)
              ? 'Linux'
              : 'Устройство';
  const browser = /Edg\//.test(agent)
    ? 'Edge'
    : /Firefox|FxiOS/.test(agent)
      ? 'Firefox'
      : /Chrome|CriOS/.test(agent)
        ? 'Chrome'
        : /Safari/.test(agent)
          ? 'Safari'
          : 'Браузер';
  const kind = /iPad|Tablet/i.test(agent)
    ? 'tablet'
    : /Mobile|iPhone/i.test(agent)
      ? 'phone'
      : system === 'Устройство'
        ? 'unknown'
        : 'computer';
  return { name: `${system} · ${browser}`, kind };
}
