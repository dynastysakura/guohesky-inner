/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Context, Next } from '@nocobase/actions';

/**
 * Returns the field tree for a given collection, used to generate
 * Carbone placeholders in the client UI.
 *
 * Only returns user-configured fields (those with an `interface` property).
 * Relation fields are included but only expanded one level deep.
 *
 * Called as: GET /api/templatePrintTemplates:collectionFields?collectionName=xxx
 */
export async function getCollectionFields(ctx: Context, next: Next) {
  const { collectionName, dataSourceKey = 'main' } = ctx.action.params;

  if (!collectionName) {
    ctx.throw(400, 'collectionName is required');
  }

  const dataSource = ctx.app.dataSourceManager.get(dataSourceKey);
  if (!dataSource) {
    ctx.throw(404, `Data source "${dataSourceKey}" not found`);
  }

  const collection = dataSource.collectionManager.getCollection(collectionName);
  if (!collection) {
    ctx.throw(404, `Collection "${collectionName}" not found`);
  }

  const fieldTree = buildFieldTree(collection, dataSource.collectionManager, 'd');
  ctx.body = fieldTree;
  await next();
}

interface FieldNode {
  name: string;
  type: string;
  title: string;
  interface?: string;
  placeholder: string;
  children?: FieldNode[];
}

/**
 * Resolve title from NocoBase uiSchema format.
 * Strips {{t("...")}} wrapper to get the human-readable text.
 */
function resolveTitle(raw: string): string {
  const match = raw.match(/\{\{t\(["'](.+?)["']\)\}\}/);
  return match ? match[1] : raw;
}

function buildFieldTree(collection: any, collectionManager: any, prefix: string, depth = 0, maxDepth = 2): FieldNode[] {
  if (depth >= maxDepth) return [];

  const fields: FieldNode[] = [];

  try {
    for (const [, field] of collection.fields) {
      const fieldInterface = field.options?.interface;

      // Only include fields that have a configured interface (user-facing fields)
      if (!fieldInterface) continue;

      const fieldName = field.name;
      const fieldType = field.type;
      const uiSchema = field.options?.uiSchema;
      const rawTitle = uiSchema?.title || fieldName;
      const title = resolveTitle(rawTitle);

      const node: FieldNode = {
        name: fieldName,
        type: fieldType,
        title,
        interface: fieldInterface,
        placeholder: '',
      };

      if (['belongsTo', 'hasOne'].includes(fieldType)) {
        node.placeholder = `{${prefix}.${fieldName}.fieldName}`;
        if (field.target) {
          try {
            const targetCollection = collectionManager.getCollection(field.target);
            if (targetCollection) {
              node.children = buildFieldTree(
                targetCollection,
                collectionManager,
                `${prefix}.${fieldName}`,
                depth + 1,
                maxDepth,
              );
            }
          } catch (e) {
            // Target collection not found
          }
        }
      } else if (['hasMany', 'belongsToMany'].includes(fieldType)) {
        node.placeholder = `{${prefix}.${fieldName}[i].fieldName}`;
        if (field.target) {
          try {
            const targetCollection = collectionManager.getCollection(field.target);
            if (targetCollection) {
              node.children = buildFieldTree(
                targetCollection,
                collectionManager,
                `${prefix}.${fieldName}[i]`,
                depth + 1,
                maxDepth,
              );
            }
          } catch (e) {
            // Target collection not found
          }
        }
      } else {
        node.placeholder = `{${prefix}.${fieldName}}`;
      }

      fields.push(node);
    }
  } catch (e) {
    // Collection fields iteration error
  }

  return fields;
}
