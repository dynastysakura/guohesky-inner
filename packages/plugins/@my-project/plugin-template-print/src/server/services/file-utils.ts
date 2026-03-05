/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import fs from 'fs';
import path from 'path';

/**
 * Read the file buffer from a NocoBase attachment record.
 * Tries local filesystem first, then falls back to HTTP URL.
 */
export async function getFileBuffer(fileRecord: any): Promise<Buffer> {
  // Try to read from local storage path first
  if (fileRecord.path && fileRecord.filename) {
    const possiblePaths = [
      path.resolve(process.cwd(), 'storage/uploads', fileRecord.path, fileRecord.filename),
      path.resolve(process.cwd(), fileRecord.url?.replace(/^\//, '') || ''),
    ];

    for (const filePath of possiblePaths) {
      try {
        if (fs.existsSync(filePath)) {
          return fs.readFileSync(filePath);
        }
      } catch (e) {
        // Continue to next path
      }
    }
  }

  // Fallback: try to download via URL
  if (fileRecord.url) {
    try {
      const url = fileRecord.url.startsWith('http')
        ? fileRecord.url
        : `${process.env.APP_URL || 'http://localhost:13000'}${fileRecord.url}`;

      const response = await fetch(url);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
    } catch (e) {
      // Fallback failed
    }
  }

  throw new Error('Unable to read template file from storage');
}
