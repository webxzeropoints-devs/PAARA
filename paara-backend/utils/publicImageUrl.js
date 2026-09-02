const hasPublicImageStore = Boolean(
  String(process.env.BLOB_PUBLIC_READ_WRITE_TOKEN || '').trim()
  || String(process.env.BLOB_PUBLIC_STORE_ID || '').trim()
);

module.exports = (value) => {
  const image = String(value || '').trim();
  if (!image || image.startsWith('data:')) return image || null;
  if (!hasPublicImageStore) {
    try {
      const parsed = new URL(image);
      if (parsed.hostname.endsWith('.blob.vercel-storage.com')) {
        return `/images/blob${parsed.pathname}`;
      }
    } catch {
      // Keep legacy and relative references unchanged.
    }
  }
  return image;
};
