// this fixes the memory leaks cause by using URL.createObjectURL
const activeBlobUrls = new Set<string>();

export const BlobManager = {
  create: (blob: Blob | MediaSource): string => {
    const url = URL.createObjectURL(blob);
    activeBlobUrls.add(url);
    return url;
  },
  revoke: (url: string | null | undefined) => {
    if (url && activeBlobUrls.has(url)) {
      URL.revokeObjectURL(url);
      activeBlobUrls.delete(url);
    }
  },
  revokeAll: () => {
    activeBlobUrls.forEach((url) => URL.revokeObjectURL(url));
    activeBlobUrls.clear();
  },
};
