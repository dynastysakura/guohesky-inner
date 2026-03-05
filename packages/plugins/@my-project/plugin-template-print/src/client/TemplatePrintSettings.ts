/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ButtonEditor, SchemaSettings, useSchemaToolbar } from '@nocobase/client';
import { TemplateConfigSettingsItem } from './TemplateConfigSettingsItem';

export const templatePrintActionSchemaSettings = new SchemaSettings({
  name: 'actionSettings:templatePrint',
  items: [
    {
      name: 'editButton',
      Component: ButtonEditor,
      useComponentProps() {
        const { buttonEditorProps } = useSchemaToolbar();
        return buttonEditorProps;
      },
    },
    {
      name: 'templateConfig',
      Component: TemplateConfigSettingsItem,
    },
    {
      name: 'divider',
      type: 'divider',
    },
    {
      name: 'delete',
      type: 'remove',
      useComponentProps() {
        return {
          removeParentsIfNoChildren: true,
          breakRemoveOn: (s: any) => s['x-component'] === 'Space' || s['x-component']?.endsWith('ActionBar'),
        };
      },
    },
  ],
});
