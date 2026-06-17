import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Github,
  Webhook,
  Key,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Save,
  Bell,
  Monitor,
  Database,
} from 'lucide-react';
import { useDashboardStore } from '@/store/useDashboardStore';
import { apiService } from '@/services/api';
import { cn } from '@/lib/utils';

interface ConfigItem {
  key: string;
  value: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  sensitive?: boolean;
}

const Settings: React.FC = () => {
  const { setLoading, isLoading, setError, getError } = useDashboardStore();
  const [config, setConfig] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading('settings', true);
    try {
      const data = await apiService.getConfig();
      setConfig(data);
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading('settings', false);
    }
  };

  const handleSave = async (key: string) => {
    setLoading(`save-${key}`, true);
    setError(`save-${key}`, null);
    setSaveSuccess(null);

    try {
      await apiService.updateConfig(key, editValue);
      const freshConfig = await apiService.getConfig();
      setConfig(freshConfig);
      setEditingKey(null);
      setSaveSuccess(key);
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (error: any) {
      console.error('Failed to save config:', error);
      setError(`save-${key}`, error.message || '保存失败');
    } finally {
      setLoading(`save-${key}`, false);
    }
  };

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleEdit = (key: string, value: string) => {
    setEditingKey(key);
    setEditValue(value);
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const configItems: ConfigItem[] = [
    {
      key: 'github_token',
      value: config.github_token ?? '',
      label: 'GitHub Token',
      description: '用于访问GitHub API的个人访问令牌',
      icon: <Key className="w-5 h-5" />,
      sensitive: true,
    },
    {
      key: 'webhook_secret',
      value: config.webhook_secret ?? '',
      label: 'Webhook Secret',
      description: '用于验证GitHub Webhook请求的密钥，保存后立即生效',
      icon: <Webhook className="w-5 h-5" />,
      sensitive: true,
    },
    {
      key: 'webhook_url',
      value: config.webhook_url ?? '',
      label: 'Webhook URL',
      description: 'GitHub Webhook的接收地址',
      icon: <ExternalLink className="w-5 h-5" />,
    },
    {
      key: 'api_base_url',
      value: config.api_base_url ?? '',
      label: 'API Base URL',
      description: '后端API服务的基础地址',
      icon: <Database className="w-5 h-5" />,
    },
    {
      key: 'ws_url',
      value: config.ws_url ?? '',
      label: 'WebSocket URL',
      description: 'WebSocket实时通信服务地址',
      icon: <Bell className="w-5 h-5" />,
    },
    {
      key: 'target_coverage',
      value: config.target_coverage ?? '80',
      label: '目标覆盖率',
      description: '测试覆盖率目标值（百分比）',
      icon: <Monitor className="w-5 h-5" />,
    },
  ];

  const webhookEvents = [
    'push - 代码推送事件',
    'pull_request - PR状态变更',
    'pull_request_review - 代码审查',
    'check_run - CI检查运行',
    'workflow_run - GitHub Actions工作流',
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white font-display mb-1">系统设置</h1>
          <p className="text-gray-400">配置GitHub集成和系统参数</p>
        </div>
        <button
          onClick={loadConfig}
          disabled={isLoading('settings')}
          className="flex items-center gap-2 px-4 py-2 bg-bg-secondary border border-bg-tertiary/50 rounded-lg text-white hover:border-brand-primary transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading('settings') && 'animate-spin')} />
          刷新
        </button>
      </div>

      {isLoading('settings') ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
        </div>
      ) : (
        <>
          <div className="bg-bg-secondary rounded-2xl border border-bg-tertiary/50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                <Github className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">GitHub 集成配置</h2>
                <p className="text-sm text-gray-400">配置与GitHub的连接参数</p>
              </div>
            </div>

            <div className="space-y-4">
              {configItems.map((item) => (
                <div
                  key={item.key}
                  className="bg-bg-tertiary/20 rounded-xl p-4 border border-bg-tertiary/30 hover:border-brand-primary/20 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-bg-tertiary/50 flex items-center justify-center text-gray-400">
                        {item.icon}
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-white">{item.label}</h3>
                        <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    {editingKey === item.key ? (
                      <div className="flex gap-3">
                        <input
                          type={item.sensitive ? 'password' : 'text'}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 bg-bg-tertiary/50 border border-bg-tertiary rounded-lg px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-brand-primary"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSave(item.key)}
                          disabled={isLoading(`save-${item.key}`)}
                          className="flex items-center gap-2 px-4 py-2 bg-brand-primary rounded-lg text-white text-sm font-medium hover:bg-brand-primary/80 transition-colors disabled:opacity-50"
                        >
                          {isLoading(`save-${item.key}`) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          保存
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-4 py-2 bg-bg-tertiary rounded-lg text-white text-sm hover:bg-bg-tertiary/70 transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <code className="flex-1 bg-bg-tertiary/50 rounded-lg px-4 py-2 text-gray-300 font-mono text-sm">
                          {item.sensitive
                            ? (item.value ? '••••••••••••••••' : <span className="text-gray-500 italic">未配置</span>)
                            : (item.value || <span className="text-gray-500 italic">未配置</span>)}
                        </code>
                        <button
                          onClick={() => handleCopy(item.key, config[item.key] || '')}
                          className="p-2 rounded-lg hover:bg-bg-tertiary/50 transition-colors text-gray-400 hover:text-white"
                          title="复制"
                          disabled={!config[item.key]}
                        >
                          {copiedKey === item.key ? (
                            <CheckCircle2 className="w-4 h-4 text-status-success" />
                          ) : (
                            <Copy className={cn('w-4 h-4', !config[item.key] && 'opacity-30')} />
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(item.key, config[item.key] || '')}
                          className="p-2 rounded-lg hover:bg-bg-tertiary/50 transition-colors text-gray-400 hover:text-white"
                          title="编辑"
                        >
                          <SettingsIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {getError(`save-${item.key}`) && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-status-failure">
                        <AlertCircle className="w-4 h-4" />
                        {getError(`save-${item.key}`)}
                      </div>
                    )}

                    {saveSuccess === item.key && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-status-success">
                        <CheckCircle2 className="w-4 h-4" />
                        保存成功
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-bg-secondary rounded-2xl border border-bg-tertiary/50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Webhook className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Webhook 配置指南</h2>
                <p className="text-sm text-gray-400">在GitHub仓库中配置Webhook接收事件</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-bg-tertiary/20 rounded-xl p-4 border border-bg-tertiary/30">
                <h3 className="text-sm font-medium text-white mb-3">配置步骤</h3>
                <ol className="space-y-2 text-sm text-gray-400">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                    <span>进入GitHub仓库的 <code className="bg-bg-tertiary/50 px-1.5 py-0.5 rounded text-white">Settings → Webhooks → Add webhook</code></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                    <span>将上面的 <code className="bg-bg-tertiary/50 px-1.5 py-0.5 rounded text-white">Webhook URL</code> 填入 <code className="bg-bg-tertiary/50 px-1.5 py-0.5 rounded text-white">Payload URL</code> 字段</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                    <span>Content type 选择 <code className="bg-bg-tertiary/50 px-1.5 py-0.5 rounded text-white">application/json</code></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
                    <span>将上面的 <code className="bg-bg-tertiary/50 px-1.5 py-0.5 rounded text-white">Webhook Secret</code> 填入 Secret 字段</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center flex-shrink-0 text-xs font-bold">5</span>
                    <span>选择 <code className="bg-bg-tertiary/50 px-1.5 py-0.5 rounded text-white">Let me select individual events</code> 并勾选以下事件：</span>
                  </li>
                </ol>

                <div className="mt-4 ml-9 pl-4 border-l-2 border-bg-tertiary/50">
                  <ul className="space-y-1.5">
                    {webhookEvents.map((event, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-gray-300">
                        <CheckCircle2 className="w-4 h-4 text-status-success flex-shrink-0" />
                        <code className="bg-bg-tertiary/50 px-1.5 py-0.5 rounded text-xs">{event}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="bg-status-success/10 border border-status-success/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-status-success flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-status-success mb-1">配置完成后</h4>
                    <p className="text-sm text-gray-400">
                      系统将自动接收GitHub发送的事件，并通过WebSocket实时推送到前端看板。
                      您可以点击各页面的"触发测试流水线"按钮来测试Webhook配置是否正常工作。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-bg-secondary rounded-xl border border-bg-tertiary/50 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-status-success/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-status-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">已连接</p>
                  <p className="text-xs text-gray-400">GitHub API</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">API服务正常运行中</p>
            </div>

            <div className="bg-bg-secondary rounded-xl border border-bg-tertiary/50 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-status-success/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-status-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">已就绪</p>
                  <p className="text-xs text-gray-400">WebSocket</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">实时推送服务已启用</p>
            </div>

            <div className="bg-bg-secondary rounded-xl border border-bg-tertiary/50 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-status-success/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-status-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">已启用</p>
                  <p className="text-xs text-gray-400">Webhook 监听</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">等待GitHub事件推送</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Settings;
