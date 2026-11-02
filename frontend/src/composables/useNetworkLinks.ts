import { useEffect, useState } from 'react';

export function useNetworkLinks(path = '/chat') {
  const [addresses, setAddresses] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/network', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ addresses: string[] }>;
      })
      .then((result) => setAddresses(result.addresses))
      .catch(() => {
        if (!controller.signal.aborted) {
          setAddresses([]);
          setError('Не удалось получить адреса. Используйте IP компьютера в локальной сети.');
        }
      });
    return () => controller.abort();
  }, []);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const hosts = local ? (addresses ?? []) : [location.hostname];
  const links = hosts.map((host) => {
    const url = new URL(path, location.origin);
    url.hostname = host;
    return url.toString();
  });
  return { links, loading: addresses === null, error };
}
