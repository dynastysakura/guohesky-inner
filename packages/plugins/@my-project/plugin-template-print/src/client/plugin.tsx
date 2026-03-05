/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin, useActionAvailable } from '@nocobase/client';
import models from './models';
import { TemplatePrintPluginProvider } from './TemplatePrintPluginProvider';
import { templatePrintActionSchemaSettings } from './TemplatePrintSettings';

export class PluginTemplatePrintClient extends Plugin {
  async load() {
    // 1. Register components and scope
    this.app.use(TemplatePrintPluginProvider);

    // 2. Register flow engine models (NocoBase 2.0)
    this.flowEngine.registerModels(models);

    // 3. Register schema settings
    this.app.schemaSettingsManager.add(templatePrintActionSchemaSettings);

    // 4. Action initializer data
    const initializerData = {
      title: "{{t('Template Print')}}",
      Component: 'TemplatePrintActionInitializer',
      schema: {
        'x-component': 'Action',
        'x-toolbar': 'ActionSchemaToolbar',
        'x-settings': 'actionSettings:templatePrint',
        'x-action': 'templatePrint',
        'x-decorator': 'ACLActionProvider',
        'x-acl-action-props': {
          skipScopeCheck: true,
        },
      },
      useVisible: () => useActionAvailable('templatePrint'),
    };

    // 5. Add to detail block actions
    this.app.schemaInitializerManager.addItem(
      'details:configureActions',
      'enableActions.templatePrint',
      initializerData,
    );

    // 6. Add to table block actions
    this.app.schemaInitializerManager.addItem('table:configureActions', 'enableActions.templatePrint', initializerData);
  }
}

export default PluginTemplatePrintClient;
