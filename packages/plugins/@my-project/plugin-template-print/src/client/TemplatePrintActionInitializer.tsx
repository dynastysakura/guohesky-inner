/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { merge } from '@formily/shared';
import { SchemaInitializerItem, useSchemaInitializer, useSchemaInitializerItem } from '@nocobase/client';
import React from 'react';

export const TemplatePrintActionInitializer = () => {
  const itemConfig = useSchemaInitializerItem();
  const { insert } = useSchemaInitializer();

  const schema = {
    type: 'void',
    title: '{{ t("Template Print") }}',
    'x-action': 'templatePrint',
    'x-action-settings': {
      templateId: null,
    },
    'x-toolbar': 'ActionSchemaToolbar',
    'x-settings': 'actionSettings:templatePrint',
    'x-decorator': 'ACLActionProvider',
    'x-component': 'Action',
    'x-component-props': {
      icon: 'FileTextOutlined',
    },
  };

  return (
    <SchemaInitializerItem
      title={itemConfig.title}
      onClick={() => {
        const s = merge(schema || {}, itemConfig.schema || {});
        itemConfig?.schemaInitialize?.(s);
        insert(s);
      }}
    />
  );
};
