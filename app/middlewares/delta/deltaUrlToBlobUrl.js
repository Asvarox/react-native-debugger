/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import DeltaPatcher from './DeltaPatcher';

const cachedBundleUrls = new Map();

/**
 * Converts the passed delta URL into an URL object containing already the
 * whole JS bundle Blob.
 */
export default async function deltaUrlToBlobUrl(deltaUrl) {
  const client = DeltaPatcher.get(deltaUrl);

  const isLegacy = client.isLegacy();
  let query = '';
  if (isLegacy !== undefined && isLegacy) {
    const lastBundleId = client.getLastRevisionId();
    query = lastBundleId
      ? `${deltaUrl.indexOf('?') === -1 ? '?' : '&'}deltaBundleId=${lastBundleId}`
      : '';
  } else if (isLegacy !== undefined) {
    const lastRevisionId = client.getLastRevisionId();
    query = lastRevisionId
      ? `${deltaUrl.indexOf('?') === -1 ? '?' : '&'}revisionId=${lastRevisionId}`
      : '';
  }

  const data = await fetch(deltaUrl + query);
  const bundle = await data.json();

  const deltaPatcher = client.applyDelta(bundle);

  const cachedBundle = cachedBundleUrls.get(deltaUrl);

  // If nothing changed, avoid recreating a bundle blob by reusing the
  // previous one.
  if (deltaPatcher.getLastNumModifiedFiles() === 0 && cachedBundle) {
    return { url: cachedBundle, moduleSize: deltaPatcher.getSizeOfAllModules() };
  }

  // Clean up the previous bundle URL to not leak memory.
  if (cachedBundle) {
    URL.revokeObjectURL(cachedBundle);
  }

  // To make Source Maps work correctly, we need to add a newline between
  // modules.
  const blobContent = deltaPatcher.getAllModules().map(module => `${module}\n`);

  // Build the blob with the whole JS bundle.
  const blob = new Blob(blobContent, {
    type: 'application/javascript',
  });

  const bundleContents = URL.createObjectURL(blob);
  cachedBundleUrls.set(deltaUrl, bundleContents);

  return { url: bundleContents, moduleSize: deltaPatcher.getSizeOfAllModules() };
}
