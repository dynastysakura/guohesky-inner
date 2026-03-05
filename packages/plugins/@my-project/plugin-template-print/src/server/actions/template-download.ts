/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Context, Next } from '@nocobase/actions';
import { getFileBuffer } from '../services/file-utils';
import { CONTENT_TYPES } from '../constants';

/**
 * Download the raw template file.
 * Called as: GET /api/templatePrintTemplates:download?filterByTk=<id>
 */
export async function templateDownload(ctx: Context, next: Next) {
  const { filterByTk } = ctx.action.params;

  if (!filterByTk) {
    ctx.throw(400, 'Template ID is required');
  }

  const templateRepo = ctx.db.getRepository('templatePrintTemplates');
  const template = await templateRepo.findOne({
    filter: { id: filterByTk },
    appends: ['file'],
  });

  if (!template) {
    ctx.throw(404, 'Template not found');
  }

  const fileRecord = template.file;
  if (!fileRecord) {
    ctx.throw(404, 'Template file not found');
  }

  const buffer = await getFileBuffer(fileRecord);

  const ext = template.templateType || 'docx';
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
  const fileName = `${template.name}.${ext}`;

  ctx.withoutDataWrapping = true;
  ctx.body = buffer;
  ctx.set({
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  });

  await next();
}
