/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/server';
import path from 'path';
import { templateRender } from './actions/template-render';
import { getCollectionFields } from './actions/collection-fields';
import { templateDownload } from './actions/template-download';

export class PluginTemplatePrintServer extends Plugin {
  async load() {
    // 1. Import collection definitions (auto-loaded before load())
    await this.db.import({ directory: path.resolve(__dirname, 'collections') });

    // 2. Register custom actions on templatePrintTemplates resource
    this.app.resourceManager.registerActionHandlers({
      'templatePrintTemplates:render': templateRender.bind(this),
      'templatePrintTemplates:collectionFields': getCollectionFields.bind(this),
      'templatePrintTemplates:download': templateDownload.bind(this),
    });

    // 3. Register templatePrint action on all data sources
    this.app.dataSourceManager.afterAddDataSource((dataSource) => {
      dataSource.resourceManager.registerActionHandler('templatePrint', templateRender.bind(this));
      dataSource.acl.setAvailableAction('templatePrint', {
        displayName: '{{t("Template Print")}}',
        allowConfigureFields: false,
      });
    });

    // 4. ACL: allow logged-in users to access template management
    this.app.acl.allow('templatePrintTemplates', ['list', 'get', 'collectionFields', 'download'], 'loggedIn');
    this.app.acl.allow('templatePrintTemplates', ['create', 'update', 'destroy', 'render'], 'loggedIn');
  }

  async install() {
    // First enable: add templatePrint to admin role strategy
    const rolesRepo = this.app.db.getRepository('roles');
    if (!rolesRepo) return;

    const adminRole = await rolesRepo.findOne({ filter: { name: 'admin' } });
    if (adminRole) {
      const existingActions = adminRole.strategy?.actions || [];
      if (!existingActions.includes('templatePrint')) {
        await rolesRepo.update({
          filter: { name: 'admin' },
          values: {
            strategy: {
              ...adminRole.strategy,
              actions: [...existingActions, 'templatePrint'],
            },
          },
        });
      }
    }
  }
}

export default PluginTemplatePrintServer;
