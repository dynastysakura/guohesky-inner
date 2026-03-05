/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Context, Next } from '@nocobase/actions';
import { CarboneRenderer } from '../services/carbone-renderer';
import { DataBuilder } from '../services/data-builder';
import { getFileBuffer } from '../services/file-utils';
import { CONTENT_TYPES } from '../constants';

/**
 * Action handler for templatePrint on any data source resource.
 * Called as: POST /api/<collectionName>:templatePrint
 */
export async function templateRender(ctx: Context, next: Next) {
  const logger = ctx.app?.logger || ctx.logger;

  const { values = {}, filterByTk, filter } = ctx.action.params;

  const { templateId, multiRecord, selectedIds } = values;

  if (!templateId) {
    ctx.throw(400, 'templateId is required');
  }

  // 1. Fetch template metadata + file
  const templateRepo = ctx.db.getRepository('templatePrintTemplates');
  const template = await templateRepo.findOne({
    filter: { id: templateId },
    appends: ['file'],
  });

  if (!template) {
    ctx.throw(404, 'Template not found');
  }

  // 2. Get template file buffer
  const fileRecord = template.file;
  if (!fileRecord) {
    ctx.throw(404, 'Template file not found');
  }

  const templateBuffer = await getFileBuffer(fileRecord);
  if (!templateBuffer) {
    ctx.throw(500, 'Failed to read template file');
  }

  // 3. Build data object
  const repository = ctx.getCurrentRepository();
  const dataSource = ctx.dataSource;
  const dataBuilder = new DataBuilder({
    collectionManager: dataSource.collectionManager,
    repository,
    logger,
  });

  let data: any;
  if (multiRecord && selectedIds) {
    // Table mode: selected rows → {items: [...], count: N}
    data = await dataBuilder.buildSelectedRecords(selectedIds, template.collectionName);
  } else if (filterByTk) {
    // Detail mode: single record → {field: value, ...}
    data = await dataBuilder.buildSingleRecord(filterByTk, template.collectionName);
  } else if (filter) {
    // Filter mode: multiple records → {items: [...], count: N}
    data = await dataBuilder.buildMultipleRecords(filter, template.collectionName);
  } else {
    ctx.throw(400, 'filterByTk or filter is required');
  }

  // 4. Render with Carbone
  const renderer = new CarboneRenderer(logger);
  const renderedBuffer = await renderer.render(templateBuffer, data, { templateType: template.templateType });

  // 5. Return file
  const outputExt = template.templateType;
  const contentType = CONTENT_TYPES[outputExt] || 'application/octet-stream';
  const fileName = `${template.name}.${outputExt}`;

  ctx.withoutDataWrapping = true;
  ctx.body = renderedBuffer;
  ctx.set({
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  });

  await next();
}
