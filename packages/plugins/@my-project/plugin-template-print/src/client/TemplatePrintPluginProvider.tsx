/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { SchemaComponentOptions } from '@nocobase/client';
import React, { useState, useEffect, useCallback } from 'react';
import { TemplatePrintActionInitializer } from './TemplatePrintActionInitializer';
import { TemplateConfigModal } from './TemplateConfigModal';
import { templateConfigEvent } from './models/templateConfigEvent';

// Noop hook — click is handled by TemplatePrintActionModel flow engine.
// Kept as scope for backward compatibility with existing schema buttons.
const useTemplatePrintAction = () => ({});

const TemplateConfigModalHost: React.FC = () => {
  const [config, setConfig] = useState<{
    visible: boolean;
    collectionName: string;
    currentTemplateId: number | null;
    multiRecord: boolean;
    onSelectTemplate: (id: number | null) => void;
  } | null>(null);

  useEffect(() => {
    return templateConfigEvent.on((payload) => {
      setConfig({
        visible: true,
        collectionName: payload.collectionName,
        currentTemplateId: payload.currentTemplateId,
        multiRecord: payload.multiRecord,
        onSelectTemplate: payload.onSelectTemplate,
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    setConfig(null);
  }, []);

  if (!config?.visible) return null;

  return (
    <TemplateConfigModal
      visible={config.visible}
      onClose={handleClose}
      collectionName={config.collectionName}
      currentTemplateId={config.currentTemplateId}
      multiRecord={config.multiRecord}
      onSelectTemplate={config.onSelectTemplate}
    />
  );
};

export const TemplatePrintPluginProvider = (props: any) => {
  return (
    <SchemaComponentOptions components={{ TemplatePrintActionInitializer }} scope={{ useTemplatePrintAction }}>
      {props.children}
      <TemplateConfigModalHost />
    </SchemaComponentOptions>
  );
};
