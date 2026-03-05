/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

type TemplateConfigPayload = {
  collectionName: string;
  currentTemplateId: number | null;
  multiRecord: boolean;
  onSelectTemplate: (templateId: number | null) => void | Promise<void>;
};

type Listener = (payload: TemplateConfigPayload) => void;

const listeners = new Set<Listener>();

export const templateConfigEvent = {
  emit(payload: TemplateConfigPayload) {
    listeners.forEach((fn) => fn(payload));
  },
  on(fn: Listener) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
