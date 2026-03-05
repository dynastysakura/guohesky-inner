/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import carbone from 'carbone';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const carboneRender = promisify(carbone.render);

/**
 * Parse shared strings from xlsx sharedStrings.xml content.
 */
export function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siRegex = /<si>([\s\S]*?)<\/si>/g;
  let match;
  while ((match = siRegex.exec(xml)) !== null) {
    const siContent = match[1];
    const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let text = '';
    let tMatch;
    while ((tMatch = tRegex.exec(siContent)) !== null) {
      text += tMatch[1];
    }
    strings.push(text);
  }
  return strings;
}

/**
 * Convert shared string references in sheet XML to inline strings,
 * then expand rows containing [i] markers.
 *
 * Carbone Community Edition does not support automatic [i] row repetition,
 * so we handle it by duplicating rows with explicit indices [0], [1], ...
 */
export function expandSheetWithSharedStrings(sheetXml: string, sharedStrings: string[], arrayLength: number): string {
  // Step 1: Convert shared string references to inline strings
  let xml = sheetXml.replace(/<c([^>]*)\st="s"([^>]*)><v>(\d+)<\/v><\/c>/g, (_match, attrs1, attrs2, idx) => {
    const index = parseInt(idx, 10);
    const content = sharedStrings[index] ?? '';
    return `<c${attrs1} t="inlineStr"${attrs2}><is><t>${content}</t></is></c>`;
  });

  // Step 2: Find and expand rows containing [i] markers
  xml = xml.replace(/<row\b[^>]*>[\s\S]*?<\/row>/g, (rowXml) => {
    if (!/\[i\]/.test(rowXml)) return rowXml;
    const expandedRows: string[] = [];
    for (let idx = 0; idx < arrayLength; idx++) {
      expandedRows.push(rowXml.replace(/\[i\]/g, `[${idx}]`));
    }
    return expandedRows.join('');
  });

  return xml;
}

/**
 * Expand [i] markers in docx XML content.
 * In docx, table rows are <w:tr>...</w:tr> elements.
 */
export function expandDocxXml(xml: string, arrayLength: number): string {
  if (!/\[i\]/.test(xml)) return xml;

  // Expand table rows containing [i]
  xml = xml.replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g, (trXml) => {
    if (!/\[i\]/.test(trXml)) return trXml;
    const expandedRows: string[] = [];
    for (let idx = 0; idx < arrayLength; idx++) {
      expandedRows.push(trXml.replace(/\[i\]/g, `[${idx}]`));
    }
    return expandedRows.join('');
  });

  // Expand paragraphs containing [i] (non-table context)
  xml = xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (pXml) => {
    if (!/\[i\]/.test(pXml)) return pXml;
    const expandedParagraphs: string[] = [];
    for (let idx = 0; idx < arrayLength; idx++) {
      expandedParagraphs.push(pXml.replace(/\[i\]/g, `[${idx}]`));
    }
    return expandedParagraphs.join('');
  });

  return xml;
}

/**
 * Pre-process an Office document (xlsx/docx) to expand [i] array markers.
 */
export async function expandArrayMarkers(
  templateBuffer: Buffer,
  arrayLength: number,
  templateType: string,
): Promise<Buffer> {
  if (arrayLength <= 0) return templateBuffer;

  const yauzl = require('yauzl');
  const yazl = require('yazl');

  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(templateBuffer, { lazyEntries: true }, (err: any, zipfile: any) => {
      if (err) return reject(err);

      const entries: Array<{ name: string; data: Buffer }> = [];

      zipfile.readEntry();
      zipfile.on('entry', (entry: any) => {
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry();
          return;
        }
        zipfile.openReadStream(entry, (streamErr: any, readStream: any) => {
          if (streamErr) return reject(streamErr);
          const chunks: Buffer[] = [];
          readStream.on('data', (chunk: Buffer) => chunks.push(chunk));
          readStream.on('end', () => {
            entries.push({ name: entry.fileName, data: Buffer.concat(chunks) });
            zipfile.readEntry();
          });
        });
      });

      zipfile.on('end', () => {
        if (templateType === 'xlsx') {
          // Parse shared strings for xlsx
          let sharedStrings: string[] = [];
          const ssEntry = entries.find((e) => /xl\/sharedStrings\.xml$/i.test(e.name));
          if (ssEntry) {
            sharedStrings = parseSharedStrings(ssEntry.data.toString('utf-8'));
          }

          // Check if expansion is needed
          const hasMarkers =
            sharedStrings.some((s) => /\[i\]/.test(s)) ||
            entries.some((e) => /xl\/worksheets\/sheet/.test(e.name) && /\[i\]/.test(e.data.toString('utf-8')));

          if (!hasMarkers) return resolve(templateBuffer);

          const outputZip = new yazl.ZipFile();
          for (const entry of entries) {
            let data = entry.data;
            if (/xl\/worksheets\/sheet\d*\.xml$/i.test(entry.name)) {
              let xml = data.toString('utf-8');
              xml = expandSheetWithSharedStrings(xml, sharedStrings, arrayLength);
              data = Buffer.from(xml, 'utf-8');
            }
            outputZip.addBuffer(data, entry.name);
          }
          outputZip.end();
          collectZipOutput(outputZip, resolve, reject);
        } else if (templateType === 'docx') {
          // Check if any XML file contains [i] markers
          const hasMarkers = entries.some((e) => /\.xml$/i.test(e.name) && /\[i\]/.test(e.data.toString('utf-8')));
          if (!hasMarkers) return resolve(templateBuffer);

          const outputZip = new yazl.ZipFile();
          for (const entry of entries) {
            let data = entry.data;
            if (
              /word\/document.*\.xml$/i.test(entry.name) ||
              /word\/header.*\.xml$/i.test(entry.name) ||
              /word\/footer.*\.xml$/i.test(entry.name)
            ) {
              let xml = data.toString('utf-8');
              xml = expandDocxXml(xml, arrayLength);
              data = Buffer.from(xml, 'utf-8');
            }
            outputZip.addBuffer(data, entry.name);
          }
          outputZip.end();
          collectZipOutput(outputZip, resolve, reject);
        } else {
          // Unsupported template type for expansion
          resolve(templateBuffer);
        }
      });
    });
  });
}

function collectZipOutput(outputZip: any, resolve: (buf: Buffer) => void, reject: (err: Error) => void) {
  const chunks: Buffer[] = [];
  outputZip.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
  outputZip.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
  outputZip.outputStream.on('error', reject);
}

export class CarboneRenderer {
  private logger: any;

  constructor(logger?: any) {
    this.logger = logger;
  }

  async render(
    templateBuffer: Buffer,
    data: Record<string, any>,
    options?: any & { templateType?: string },
  ): Promise<Buffer> {
    const tempDir = os.tmpdir();
    const ext = options?.templateType || 'docx';

    // For templates with array data, expand [i] markers before Carbone rendering
    let processedBuffer = templateBuffer;
    if (['xlsx', 'docx'].includes(ext) && data?.items && Array.isArray(data.items) && data.items.length > 0) {
      try {
        processedBuffer = await expandArrayMarkers(templateBuffer, data.items.length, ext);
      } catch (e) {
        this.logger?.warn('CarboneRenderer: failed to expand array markers, using original template', {
          error: e.message,
        });
      }
    }

    const tempPath = path.join(tempDir, `carbone_tpl_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
    fs.writeFileSync(tempPath, processedBuffer);

    try {
      this.logger?.info('CarboneRenderer: rendering template', { tempPath });

      const carboneOptions = {
        convertTo: null,
        ...options,
      };

      const result = (await carboneRender(tempPath, data, carboneOptions)) as Buffer;
      return result;
    } catch (error) {
      this.logger?.error('CarboneRenderer: render failed', { error: error.message });
      throw new Error(`Template rendering failed: ${error.message}`);
    } finally {
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (e) {
        this.logger?.warn('CarboneRenderer: failed to clean temp file', { tempPath });
      }
    }
  }
}
