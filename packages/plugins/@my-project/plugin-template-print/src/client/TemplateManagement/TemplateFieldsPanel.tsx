/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useState, useEffect } from 'react';
import { Table, Button, message, Empty, Spin } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useAPIClient } from '@nocobase/client';
import { useT } from '../locale';

interface FieldNode {
  name: string;
  type: string;
  title: string;
  interface?: string;
  placeholder: string;
  children?: FieldNode[];
}

interface FlatField {
  key: string;
  displayName: string;
  placeholder: string;
}

const copyToClipboard = (text: string, successMsg: string) => {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      message.success(successMsg);
    })
    .catch(() => {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      message.success(successMsg);
    });
};

/**
 * Flatten the hierarchical field tree into a flat list for table display.
 * Relation fields are expanded with dotted names (e.g. "Order / Product name").
 *
 * When multiRecord is true, placeholders use table format:
 *   {d.fieldName} → {d.items[i].fieldName}
 */
const flattenFields = (nodes: FieldNode[], multiRecord = false, parentLabel = ''): FlatField[] => {
  const result: FlatField[] = [];
  for (const node of nodes) {
    const isRelation = ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(node.type);
    const displayName = parentLabel ? `${parentLabel} / ${node.title || node.name}` : node.title || node.name;

    if (isRelation && node.children?.length) {
      result.push(...flattenFields(node.children, multiRecord, displayName));
    } else {
      let placeholder = node.placeholder;
      if (multiRecord && placeholder) {
        // {d.fieldName} → {d.items[i].fieldName}
        placeholder = placeholder.replace('{d.', '{d.items[i].');
      }
      result.push({
        key: placeholder || node.name,
        displayName,
        placeholder,
      });
    }
  }
  return result;
};

/**
 * Inline fields view for embedding in tabs or other containers (no Drawer wrapper).
 */
interface TemplateFieldsViewProps {
  collectionName: string;
  multiRecord?: boolean;
}

export const TemplateFieldsView: React.FC<TemplateFieldsViewProps> = ({ collectionName, multiRecord = false }) => {
  const { t } = useT();
  const api = useAPIClient();
  const [fields, setFields] = useState<FieldNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (collectionName) {
      fetchFields();
    }
  }, [collectionName]);

  const fetchFields = async () => {
    setLoading(true);
    try {
      const { data } = await api.request({
        url: 'templatePrintTemplates:collectionFields',
        method: 'get',
        params: { collectionName },
      });
      setFields(data?.data || []);
    } catch (error) {
      message.error(t('Failed to load fields'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin />
      </div>
    );
  }

  const flatFields = flattenFields(fields, multiRecord);

  if (flatFields.length === 0) {
    return <Empty description={t('No fields found')} />;
  }

  const columns = [
    {
      title: t('Field display name'),
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: t('Action'),
      key: 'action',
      width: 100,
      render: (_: any, record: FlatField) => (
        <Button
          type="link"
          size="small"
          icon={<CopyOutlined />}
          onClick={() => copyToClipboard(record.placeholder, t('Placeholder copied'))}
        >
          {t('Copy')}
        </Button>
      ),
    },
  ];

  return <Table dataSource={flatFields} columns={columns} rowKey="key" pagination={false} size="small" />;
};
