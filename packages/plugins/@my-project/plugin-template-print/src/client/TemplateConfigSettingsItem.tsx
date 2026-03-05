/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useState } from 'react';
import { useFieldSchema } from '@formily/react';
import { SchemaSettingsItem, useDesignable, useCollection_deprecated } from '@nocobase/client';
import { TemplateConfigModal } from './TemplateConfigModal';
import { useT } from './locale';

export const TemplateConfigSettingsItem: React.FC = () => {
  const { t } = useT();
  const fieldSchema = useFieldSchema();
  const { dn } = useDesignable();
  const collection = useCollection_deprecated();
  const [modalVisible, setModalVisible] = useState(false);

  const currentTemplateId = fieldSchema?.['x-action-settings']?.templateId;

  const handleSelectTemplate = (templateId: number | null) => {
    const actionSettings = { ...(fieldSchema['x-action-settings'] || {}), templateId };
    fieldSchema['x-action-settings'] = actionSettings;
    dn.emit('patch', {
      schema: {
        ['x-uid']: fieldSchema['x-uid'],
        'x-action-settings': actionSettings,
      },
    });
    dn.refresh();
  };

  return (
    <>
      <SchemaSettingsItem title={t('Template Config')} onClick={() => setModalVisible(true)}>
        {t('Template Config')}
      </SchemaSettingsItem>
      {modalVisible && (
        <TemplateConfigModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          collectionName={collection.name}
          currentTemplateId={currentTemplateId}
          multiRecord={false}
          onSelectTemplate={handleSelectTemplate}
        />
      )}
    </>
  );
};
