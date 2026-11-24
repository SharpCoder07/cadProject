/** "6.3 MB", "355.1 KB", "1.2 GB". Pure: usable from server and client components. */
export const sizeLabel = (b: number) =>
  b >= 1_073_741_824 ? `${(b / 1_073_741_824).toFixed(1)} GB` : b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${(Math.max(b, 102) / 1024).toFixed(1)} KB`;
