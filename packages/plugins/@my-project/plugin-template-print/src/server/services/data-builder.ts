/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

/**
 * Resolve {{t("...")}} translation wrappers in data values.
 * NocoBase stores some field values (e.g. role titles) with this format.
 * Strip the wrapper so Carbone outputs clean text.
 */
export function resolveTranslationExprs(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') {
    const match = data.match(/^\{\{t\(["'](.+?)["']\)\}\}$/);
    return match ? match[1] : data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => resolveTranslationExprs(item));
  }
  if (typeof data === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = resolveTranslationExprs(value);
    }
    return result;
  }
  return data;
}

export class DataBuilder {
  private collectionManager: any;
  private repository: any;
  private logger: any;

  constructor(opts: { collectionManager: any; repository: any; logger?: any }) {
    this.collectionManager = opts.collectionManager;
    this.repository = opts.repository;
    this.logger = opts.logger;
  }

  async buildSingleRecord(filterByTk: string | number, collectionName: string) {
    const collection = this.collectionManager.getCollection(collectionName);
    const appends = collection ? this.getAppends(collection) : [];

    this.logger?.info('DataBuilder: building single record', { filterByTk, collectionName, appends });

    const record = await this.repository.findOne({
      filterByTk,
      appends,
    });

    if (!record) {
      throw new Error(`Record not found: ${filterByTk}`);
    }

    return resolveTranslationExprs(record.toJSON());
  }

  async buildMultipleRecords(filter: any, collectionName: string) {
    const collection = this.collectionManager.getCollection(collectionName);
    const appends = collection ? this.getAppends(collection) : [];

    this.logger?.info('DataBuilder: building multiple records', { collectionName, appends });

    const records = await this.repository.find({
      filter,
      appends,
    });

    return {
      items: records.map((r: any) => resolveTranslationExprs(r.toJSON())),
      count: records.length,
    };
  }

  async buildSelectedRecords(filterByTk: any, collectionName: string) {
    const collection = this.collectionManager.getCollection(collectionName);
    const appends = collection ? this.getAppends(collection) : [];
    const ids = Array.isArray(filterByTk) ? filterByTk : [filterByTk];
    const primaryKey = collection?.options?.filterTargetKey || 'id';

    const records = await this.repository.find({
      filter: {
        [primaryKey]: { $in: ids },
      },
      appends,
    });

    return {
      items: records.map((r: any) => resolveTranslationExprs(r.toJSON())),
      count: records.length,
    };
  }

  private getAppends(collection: any, depth = 0, maxDepth = 2, prefix = ''): string[] {
    if (depth >= maxDepth) return [];

    const appends: string[] = [];

    try {
      const fields = collection.fields;
      if (!fields) return [];

      for (const [, field] of fields) {
        const fieldType = field.type;
        if (['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(fieldType)) {
          const fieldPath = prefix ? `${prefix}.${field.name}` : field.name;
          appends.push(fieldPath);

          if (field.target) {
            try {
              const targetCollection = this.collectionManager.getCollection(field.target);
              if (targetCollection) {
                const childAppends = this.getAppends(targetCollection, depth + 1, maxDepth, fieldPath);
                appends.push(...childAppends);
              }
            } catch (e) {
              // Target collection not found, skip
            }
          }
        }
      }
    } catch (e) {
      this.logger?.warn('DataBuilder: error collecting appends', { error: e.message });
    }

    return appends;
  }
}
