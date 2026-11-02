// All common endian variants of Mach-O (32/64 bit) and universal/FAT binaries.
const executableMagic = new Set([
  'feedface',
  'cefaedfe',
  'feedfacf',
  'cffaedfe',
  'cafebabe',
  'bebafeca',
  'cafebabf',
  'bfbafeca',
  '7f454c46', // ELF
]);

/** Additional signature screening, not a general-purpose malware scanner. */
export function hasExecutableHeader(head: Uint8Array): boolean {
  const firstFour = [...head.subarray(0, 4)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  if (executableMagic.has(firstFour)) return true;
  if (head[0] === 0x4d && head[1] === 0x5a) return true; // DOS / Windows MZ, including PE executables and DLLs.
  const offset = head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf ? 3 : 0;
  return head[offset] === 0x23 && head[offset + 1] === 0x21; // Shebang, including UTF-8 BOM.
}
