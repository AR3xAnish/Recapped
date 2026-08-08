/**
 * @file blobStore.js
 * @description Service wrapper around @vercel/blob. Handles deletion of temporary audio assets
 * from Vercel Blob store post-transcription to optimize storage usage.
 */

const { del } = require("@vercel/blob");

/**
 * Deletes a file object from Vercel Blob storage.
 *
 * @async
 * @function deleteBlob
 * @param {string} blobUrl - The public url of the target blob file to delete.
 * @returns {Promise<void>}
 */
async function deleteBlob(blobUrl) {
  if (!blobUrl) return;
  try {
    console.log(`[Blob Store] Deleting temporary blob: ${blobUrl}`);
    const cleanToken = process.env.BLOB_READ_WRITE_TOKEN?.replace(/^["']|["']$/g, "");
    await del(blobUrl, {
      token: cleanToken,
    });
  } catch (err) {
    console.error(`[Blob Store] Failed to delete blob ${blobUrl}:`, err);
  }
}

module.exports = {
  deleteBlob,
};
