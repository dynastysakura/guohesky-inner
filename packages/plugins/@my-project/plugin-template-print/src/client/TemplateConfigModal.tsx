/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Tabs, Table, Button, Space, Popconfirm, message, Form, Input, Upload } from 'antd';
import { PlusOutlined, ReloadOutlined, InboxOutlined } from '@ant-design/icons';
import { useAPIClient } from '@nocobase/client';
import { saveAs } from 'file-saver';
import { TemplateFieldsView } from './TemplateManagement/TemplateFieldsPanel';
import { useT } from './locale';

interface TemplateConfigModalProps {
  visible: boolean;
  onClose: () => void;
  collectionName: string;
  currentTemplateId: number | null;
  multiRecord: boolean;
  onSelectTemplate: (templateId: number | null) => void;
}

export const TemplateConfigModal: React.FC<TemplateConfigModalProps> = ({
  visible,
  onClose,
  collectionName,
  currentTemplateId,
  multiRecord,
  onSelectTemplate,
}) => {
  const { t } = useT();
  const api = useAPIClient();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<number | null>(currentTemplateId);

  // Sync from prop when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedId(currentTemplateId);
    }
  }, [visible, currentTemplateId]);

  const fetchTemplates = useCallback(async () => {
    if (!collectionName) return;
    setLoading(true);
    try {
      const { data } = await api.request({
        url: 'templatePrintTemplates:list',
        method: 'get',
        params: {
          filter: { collectionName },
          appends: ['file'],
          pageSize: 200,
          sort: ['-createdAt'],
        },
      });
      setTemplates(data?.data || []);
    } catch (error) {
      message.error(t('Failed to load templates'));
    } finally {
      setLoading(false);
    }
  }, [api, collectionName]);

  useEffect(() => {
    if (visible && collectionName) {
      fetchTemplates();
    }
  }, [visible, collectionName, fetchTemplates]);

  const handleDelete = async (id: number) => {
    try {
      await api.request({
        url: `templatePrintTemplates:destroy/${id}`,
        method: 'post',
      });
      message.success(t('Template deleted'));
      if (currentTemplateId === id) {
        onSelectTemplate(null);
      }
      fetchTemplates();
    } catch (error) {
      message.error(t('Failed to delete template'));
    }
  };

  const handleDownload = async (record: any) => {
    try {
      const { data } = await api.request({
        url: 'templatePrintTemplates:download',
        method: 'get',
        params: { filterByTk: record.id },
        responseType: 'blob',
      });
      const blob = new Blob([data]);
      const ext = record.templateType || 'docx';
      saveAs(blob, `${record.name}.${ext}`);
    } catch (error) {
      message.error(t('Download failed'));
    }
  };

  const handleUse = (record: any) => {
    setSelectedId(record.id);
    onSelectTemplate(record.id);
  };

  const columns = [
    {
      title: t('Template name'),
      key: 'templateName',
      render: (_: any, record: any) => record.file?.filename || record.file?.title || '-',
    },
    {
      title: t('Template display name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('Actions'),
      key: 'actions',
      width: 240,
      render: (_: any, record: any) => {
        const isActive = record.id === selectedId;
        return (
          <Space size="middle">
            <Button type="link" size="small" disabled={isActive} onClick={() => handleUse(record)}>
              {t('Use')}
            </Button>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setEditingTemplate(record);
                setFormVisible(true);
              }}
            >
              {t('Edit')}
            </Button>
            <Button type="link" size="small" onClick={() => handleDownload(record)}>
              {t('Download')}
            </Button>
            <Popconfirm title={t('Are you sure to delete this template?')} onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" disabled={isActive}>
                {t('Delete')}
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <Modal title={t('Config template')} open={visible} onCancel={onClose} footer={null} width={800} destroyOnClose>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchTemplates} size="small">
            {t('Refresh')}
          </Button>
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingTemplate(null);
            setFormVisible(true);
          }}
        >
          {t('Add template')}
        </Button>
      </div>
      <Table dataSource={templates} columns={columns} rowKey="id" loading={loading} size="small" />
      {formVisible && (
        <TemplateFormModal
          visible={formVisible}
          editingTemplate={editingTemplate}
          collectionName={collectionName}
          multiRecord={multiRecord}
          onCancel={() => {
            setFormVisible(false);
            setEditingTemplate(null);
          }}
          onSuccess={() => {
            setFormVisible(false);
            setEditingTemplate(null);
            fetchTemplates();
          }}
        />
      )}
    </Modal>
  );
};

// Inline add/edit form modal with two tabs: "Template form" and "Fields list"
interface TemplateFormModalProps {
  visible: boolean;
  editingTemplate?: any;
  collectionName: string;
  multiRecord: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const EXT_TO_TYPE: Record<string, string> = {
  docx: 'docx',
  xlsx: 'xlsx',
  pptx: 'pptx',
};

const TemplateFormModal: React.FC<TemplateFormModalProps> = ({
  visible,
  editingTemplate,
  collectionName,
  multiRecord,
  onCancel,
  onSuccess,
}) => {
  const { t } = useT();
  const api = useAPIClient();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fileId, setFileId] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      if (editingTemplate) {
        form.setFieldsValue({
          name: editingTemplate.name,
        });
        setFileId(editingTemplate.fileId);
      } else {
        form.resetFields();
        setFileId(null);
      }
    }
  }, [visible, editingTemplate, form]);

  const handleUpload = async (options: any) => {
    const { file, onSuccess: uploadSuccess, onError } = options;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.request({
        url: 'attachments:create',
        method: 'post',
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (data?.data?.id) {
        setFileId(data.data.id);
        // Auto-detect template type from file extension
        const ext = file.name?.split('.').pop()?.toLowerCase();
        if (ext && EXT_TO_TYPE[ext]) {
          form.setFieldsValue({ templateType: EXT_TO_TYPE[ext] });
        }
        uploadSuccess(data.data);
        message.success(t('File uploaded'));
      }
    } catch (error) {
      onError(error);
      message.error(t('File upload failed'));
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Auto-detect templateType from file if not set
      const templateType = values.templateType || 'docx';

      const payload = {
        name: values.name,
        templateType,
        fileId,
        collectionName,
        enabled: true,
      };

      if (editingTemplate) {
        await api.request({
          url: `templatePrintTemplates:update/${editingTemplate.id}`,
          method: 'post',
          data: payload,
        });
        message.success(t('Template updated'));
      } else {
        if (!fileId) {
          message.error(t('Please upload a template file'));
          setLoading(false);
          return;
        }
        await api.request({
          url: 'templatePrintTemplates:create',
          method: 'post',
          data: payload,
        });
        message.success(t('Template created'));
      }

      onSuccess();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(t('Failed to save template'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={editingTemplate ? t('Edit template') : t('Add template')}
      open={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      destroyOnClose
      width={600}
    >
      <Tabs
        items={[
          {
            key: 'form',
            label: t('Template form'),
            children: (
              <Form form={form} layout="vertical" initialValues={{ templateType: 'docx' }}>
                <Form.Item
                  name="name"
                  label={t('Template display name')}
                  rules={[{ required: true, message: t('Please enter template display name') }]}
                >
                  <Input placeholder={t('Template display name')} />
                </Form.Item>

                <Form.Item name="templateType" hidden>
                  <Input />
                </Form.Item>

                <Form.Item label={t('Template file')}>
                  <Upload.Dragger customRequest={handleUpload} maxCount={1} accept=".docx,.xlsx,.pptx">
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined />
                    </p>
                    <p className="ant-upload-text">{t('Upload file')}</p>
                  </Upload.Dragger>
                  {editingTemplate?.file && (
                    <div style={{ marginTop: 8, color: '#999' }}>
                      {t('Current file')}: {editingTemplate.file.filename || editingTemplate.file.title}
                    </div>
                  )}
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'fields',
            label: t('Fields list'),
            children: <TemplateFieldsView collectionName={collectionName} multiRecord={multiRecord} />,
          },
        ]}
      />
    </Modal>
  );
};
