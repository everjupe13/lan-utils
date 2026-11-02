import { networkInterfaces } from 'node:os';

export function localAddresses(): string[] {
  return [
    ...new Set(
      Object.values(networkInterfaces()).flatMap((addresses) =>
        (addresses ?? [])
          .filter((address) => address.family === 'IPv4' && !address.internal)
          .map((address) => address.address),
      ),
    ),
  ];
}
