/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { tExpr, MultiRecordResource, FlowModel } from '@nocobase/flow-engine';
import type { ButtonProps } from 'antd/es/button';
import { saveAs } from 'file-saver';
import { ActionModel, ActionSceneEnum } from '@nocobase/client';
import { templateConfigEvent } from './templateConfigEvent';
import { NAMESPACE } from '../locale';

export class TemplatePrintActionModel extends ActionModel {
  static scene = ActionSceneEnum.both;

  defaultProps: ButtonProps = {
    title: tExpr('Template Print', { ns: NAMESPACE }),
    type: 'default',
    icon: 'FileTextOutlined',
  };

  getAclActionName() {
    return 'templatePrint';
  }
}

TemplatePrintActionModel.define({
  label: tExpr('Template Print', { ns: NAMESPACE }),
});

// "Template Config" — opens the full template management modal via extra menu item
TemplatePrintActionModel.registerExtraMenuItems({
  group: 'common-actions',
  sort: -100,
  matcher: (model) => model instanceof TemplatePrintActionModel,
  items: (model: FlowModel, t) => {
    // Walk up to find blockModel for collection name and resource type
    let collectionName = '';
    let multiRecord = false;
    try {
      let current = model.parent;
      while (current) {
        if ((current as any).collection?.name) {
          collectionName = (current as any).collection.name;
          multiRecord = (current as any).resource instanceof MultiRecordResource;
          break;
        }
        current = current.parent;
      }
    } catch (e) {
      // ignore
    }

    const currentTemplateId = model.getStepParams('templatePrintSettings', 'templateConfig')?.templateId ?? null;

    return [
      {
        key: 'template-print-config',
        label: t('Config template', { ns: NAMESPACE }),
        sort: -100,
        onClick: () => {
          templateConfigEvent.emit({
            collectionName,
            currentTemplateId,
            multiRecord,
            onSelectTemplate: async (templateId: number | null) => {
              model.setStepParams('templatePrintSettings', 'templateConfig', { templateId });
              await model.saveStepParams();
            },
          });
        },
      },
    ];
  },
});

TemplatePrintActionModel.registerFlow({
  key: 'templatePrintSettings',
  title: tExpr('Template print settings', { ns: NAMESPACE }),
  steps: {
    templateConfig: {
      // Hidden step — just holds the templateId param (configured via extra menu item above)
      hideInSettings: true,
      defaultParams() {
        return { templateId: null };
      },
      handler(ctx, params) {
        ctx.model.setProps({ templateId: params.templateId });
      },
    },
  },
});

// Click flow — handles the actual print action
TemplatePrintActionModel.registerFlow({
  key: 'templatePrintAction',
  on: 'click',
  steps: {
    print: {
      handler: async (ctx, params) => {
        const resource = ctx.blockModel?.resource;
        if (!resource) {
          ctx.message.error(ctx.t('No resource available', { ns: NAMESPACE }));
          return;
        }

        const { title } = ctx.blockModel.collection;
        const templateId = ctx.model.getProps().templateId;

        if (!templateId) {
          ctx.message.warning(ctx.t('Please configure a template in the button settings.', { ns: NAMESPACE }));
          return;
        }

        // Determine filterByTk and mode based on block type
        let filterByTk;
        let multiRecord = false;
        if (resource instanceof MultiRecordResource) {
          multiRecord = true;
          const selectedRows = resource.getSelectedRows();
          if (!selectedRows || selectedRows.length === 0) {
            ctx.message.warning(ctx.t('Please select at least one record', { ns: NAMESPACE }));
            return;
          }
          filterByTk = ctx.blockModel.collection.getFilterByTK(selectedRows);
        } else {
          filterByTk =
            ctx.filterByTk ??
            resource.getFilterByTk?.() ??
            (ctx.record && ctx.blockModel.collection.getFilterByTK?.(ctx.record));
          if (!filterByTk) {
            ctx.message.error(ctx.t('No record selected', { ns: NAMESPACE }));
            return;
          }
        }

        const response = await resource.runAction('templatePrint', {
          rawResponse: true,
          data: {
            templateId,
            multiRecord,
            ...(multiRecord ? { selectedIds: Array.isArray(filterByTk) ? filterByTk : [filterByTk] } : {}),
          },
          responseType: 'blob',
          params: multiRecord ? {} : { filterByTk },
        });

        // Parse filename from Content-Disposition header
        const contentDisposition = response?.headers?.['content-disposition'] || '';
        let fileName;
        const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?([^;\n]+)/i);
        if (match) {
          fileName = decodeURIComponent(match[1].replace(/"/g, ''));
        } else {
          const ext = 'docx';
          fileName = `${ctx.t(title)}_${Date.now()}.${ext}`;
        }

        const blob = new Blob([response.data]);
        saveAs(blob, fileName);
      },
    },
  },
});
