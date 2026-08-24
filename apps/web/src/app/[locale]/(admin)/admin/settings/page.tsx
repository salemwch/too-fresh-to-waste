'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Settings,
  RotateCcw,
  Loader2,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Label,
  Separator,
  Badge,
} from '@foodwaste/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmActionDialog } from '@/components/dashboard/admin/confirm-action-dialog';
import {
  useSystemConfig,
  useConfigHistory,
  useUpdateSystemConfig,
  useRollbackConfig,
  useImportConfig,
  useValidateConfigImport,
} from '@/hooks/use-admin';
import { adminService } from '@/services/admin.service';
import type {
  UpdateSystemConfigPayload,
  PlatformSettings,
  SecuritySettings,
  NotificationSettings,
  PaymentSettings,
} from '@/types/admin';

// ─── Toggle component (since we might not have a Switch in @foodwaste/ui) ─────

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className='flex items-center justify-between gap-lg py-sm'>
      <div>
        <p className='text-sm font-medium'>{label}</p>
        {description && <p className='text-xs text-muted-foreground'>{description}</p>}
      </div>
      <button
        role='switch'
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          checked ? 'bg-primary' : 'bg-input'
        }`}
      >
        <span
          className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-lg' : 'translate-x-xxs'
          }`}
        />
      </button>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  label,
  min,
  max,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className='space-y-xs'>
      <Label className='text-xs'>{label}</Label>
      <div className='flex items-center gap-sm'>
        <Input
          type='number'
          value={value}
          min={min}
          max={max}
          onChange={e => onChange(Number(e.target.value))}
          className='h-8 text-sm'
        />
        {suffix && <span className='shrink-0 text-xs text-muted-foreground'>{suffix}</span>}
      </div>
    </div>
  );
}

function relativeDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const t = useTranslations('dashboard.admin.settings');

  const { data: config, isLoading } = useSystemConfig();
  const { data: history } = useConfigHistory();
  const updateConfig = useUpdateSystemConfig();
  const rollbackConfig = useRollbackConfig();
  const importConfig = useImportConfig();
  const validateImport = useValidateConfigImport();

  const [platform, setPlatform] = useState<PlatformSettings | null>(null);
  const [security, setSecurity] = useState<SecuritySettings | null>(null);
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null);
  const [payment, setPayment] = useState<PaymentSettings | null>(null);
  const [saveDialog, setSaveDialog] = useState(false);
  const [rollbackDialog, setRollbackDialog] = useState<string | null>(null);
  const [importDialog, setImportDialog] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importValidation, setImportValidation] = useState<{
    valid: boolean;
    errors?: string[];
  } | null>(null);

  // Initialise form when config loads
  useEffect(() => {
    if (config && !platform) {
      setPlatform({ ...config.platformSettings });
      setSecurity({ ...config.securitySettings });
      setNotifications({ ...config.notificationSettings });
      setPayment({ ...config.paymentSettings });
    }
  }, [config, platform]);

  function handleSave() {
    if (!platform || !security || !notifications || !payment) return;
    const payload: UpdateSystemConfigPayload = {
      platformSettings: platform,
      securitySettings: security,
      notificationSettings: notifications,
      paymentSettings: payment,
    };
    updateConfig.mutate(payload, { onSuccess: () => setSaveDialog(false) });
  }

  function handleRollback() {
    if (!rollbackDialog) return;
    rollbackConfig.mutate(rollbackDialog, { onSuccess: () => setRollbackDialog(null) });
  }

  function handleExport() {
    void adminService.exportConfig().then(response => {
      const blob = new Blob([response.data as unknown as BlobPart], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system-config-v${config?.version ?? 'current'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function handleValidateImport() {
    try {
      const parsed = JSON.parse(importJson) as Record<string, unknown>;
      validateImport.mutate(parsed, {
        onSuccess: result => setImportValidation(result),
      });
    } catch {
      setImportValidation({ valid: false, errors: ['Invalid JSON format'] });
    }
  }

  function handleConfirmImport() {
    try {
      const parsed = JSON.parse(importJson) as Record<string, unknown>;
      importConfig.mutate(parsed, {
        onSuccess: () => {
          setImportDialog(false);
          setImportJson('');
          setImportValidation(null);
        },
      });
    } catch {
      setImportValidation({ valid: false, errors: ['Invalid JSON format'] });
    }
  }

  if (isLoading || !platform || !security || !notifications || !payment) {
    return (
      <div className='flex items-center justify-center py-6xl'>
        <Loader2 className='size-6 animate-spin text-muted-foreground' />
      </div>
    );
  }

  return (
    <div className='space-y-2xl'>
      {/* Header */}
      <div className='flex items-start justify-between gap-lg'>
        <div>
          <h1 className='text-xl font-bold tracking-tight'>{t('title')}</h1>
          <p className='mt-xxs text-sm text-muted-foreground'>{t('description')}</p>
        </div>
        <div className='flex items-center gap-sm'>
          {config && (
            <Badge variant='outline' className='text-xs'>
              v{config.version}
            </Badge>
          )}
          <Button size='sm' variant='outline' onClick={handleExport}>
            <Download className='me-1.5 size-3.5' />
            Export
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              setImportJson('');
              setImportValidation(null);
              setImportDialog(true);
            }}
          >
            <Upload className='me-1.5 size-3.5' />
            Import
          </Button>
          <Button size='sm' onClick={() => setSaveDialog(true)} disabled={updateConfig.isPending}>
            {updateConfig.isPending ? (
              <>
                <Loader2 className='me-sm size-3.5 animate-spin' />
                {t('saving')}
              </>
            ) : (
              <>
                <Settings className='me-sm size-3.5' />
                {t('saveChanges')}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Config Tabs */}
      <Tabs defaultValue='platform'>
        <TabsList className='h-9 w-full sm:w-auto'>
          <TabsTrigger value='platform' className='text-xs'>
            {t('tabs.platform')}
          </TabsTrigger>
          <TabsTrigger value='security' className='text-xs'>
            {t('tabs.security')}
          </TabsTrigger>
          <TabsTrigger value='notifications' className='text-xs'>
            {t('tabs.notifications')}
          </TabsTrigger>
          <TabsTrigger value='payment' className='text-xs'>
            {t('tabs.payment')}
          </TabsTrigger>
        </TabsList>

        {/* Platform */}
        <TabsContent value='platform' className='mt-lg'>
          <Card className='border-border/60'>
            <CardHeader>
              <CardTitle className='text-sm'>{t('platform.title')}</CardTitle>
            </CardHeader>
            <CardContent className='space-y-lg'>
              <div className='divide-y divide-border/40'>
                <Toggle
                  checked={platform.maintenanceMode}
                  onChange={v => setPlatform(p => p && { ...p, maintenanceMode: v })}
                  label={t('platform.maintenanceMode')}
                  description={t('platform.maintenanceModeDescription')}
                />
                <Toggle
                  checked={platform.allowNewRegistrations}
                  onChange={v => setPlatform(p => p && { ...p, allowNewRegistrations: v })}
                  label={t('platform.allowRegistrations')}
                  description={t('platform.allowRegistrationsDescription')}
                />
                <Toggle
                  checked={platform.requireEstablishmentApproval}
                  onChange={v => setPlatform(p => p && { ...p, requireEstablishmentApproval: v })}
                  label={t('platform.requireApproval')}
                  description={t('platform.requireApprovalDescription')}
                />
              </div>
              <Separator />
              <div className='grid gap-lg sm:grid-cols-2'>
                <NumberInput
                  value={platform.maxOffersPerEstablishment}
                  onChange={v => setPlatform(p => p && { ...p, maxOffersPerEstablishment: v })}
                  label={t('platform.maxOffersPerEstablishment')}
                  min={1}
                  max={1000}
                />
                <NumberInput
                  value={platform.defaultOfferExpirationHours}
                  onChange={v => setPlatform(p => p && { ...p, defaultOfferExpirationHours: v })}
                  label={t('platform.defaultOfferExpiration')}
                  min={1}
                  max={168}
                  suffix='h'
                />
                <NumberInput
                  value={platform.minOrderValue}
                  onChange={v => setPlatform(p => p && { ...p, minOrderValue: v })}
                  label={t('platform.minOrderValue')}
                  min={0}
                  suffix='TND'
                />
                <NumberInput
                  value={platform.maxOrderValue}
                  onChange={v => setPlatform(p => p && { ...p, maxOrderValue: v })}
                  label={t('platform.maxOrderValue')}
                  min={1}
                  suffix='TND'
                />
                <NumberInput
                  value={platform.platformCommissionRate}
                  onChange={v => setPlatform(p => p && { ...p, platformCommissionRate: v })}
                  label={t('platform.commissionRate')}
                  min={0}
                  max={50}
                  suffix='%'
                />
                <NumberInput
                  value={platform.autoRefundTimeoutHours}
                  onChange={v => setPlatform(p => p && { ...p, autoRefundTimeoutHours: v })}
                  label={t('platform.refundTimeout')}
                  min={1}
                  max={168}
                  suffix='h'
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value='security' className='mt-lg'>
          <Card className='border-border/60'>
            <CardHeader>
              <CardTitle className='text-sm'>{t('security.title')}</CardTitle>
            </CardHeader>
            <CardContent className='space-y-lg'>
              <div className='grid gap-lg sm:grid-cols-2'>
                <NumberInput
                  value={security.maxLoginAttempts}
                  onChange={v => setSecurity(s => s && { ...s, maxLoginAttempts: v })}
                  label={t('security.maxLoginAttempts')}
                  min={3}
                  max={10}
                />
                <NumberInput
                  value={security.loginAttemptWindow}
                  onChange={v => setSecurity(s => s && { ...s, loginAttemptWindow: v })}
                  label={t('security.loginAttemptWindow')}
                  min={5}
                  max={60}
                  suffix='min'
                />
                <NumberInput
                  value={security.accountLockoutDuration}
                  onChange={v => setSecurity(s => s && { ...s, accountLockoutDuration: v })}
                  label={t('security.lockoutDuration')}
                  min={5}
                  max={1440}
                  suffix='min'
                />
                <NumberInput
                  value={security.passwordMinLength}
                  onChange={v => setSecurity(s => s && { ...s, passwordMinLength: v })}
                  label={t('security.passwordMinLength')}
                  min={6}
                  max={128}
                />
                <NumberInput
                  value={security.sessionTimeout}
                  onChange={v => setSecurity(s => s && { ...s, sessionTimeout: v })}
                  label={t('security.sessionTimeout')}
                  min={30}
                  max={1440}
                  suffix='min'
                />
              </div>
              <Separator />
              <div className='divide-y divide-border/40'>
                <Toggle
                  checked={security.passwordRequireSpecialChar}
                  onChange={v => setSecurity(s => s && { ...s, passwordRequireSpecialChar: v })}
                  label={t('security.requireSpecialChar')}
                />
                <Toggle
                  checked={security.passwordRequireNumbers}
                  onChange={v => setSecurity(s => s && { ...s, passwordRequireNumbers: v })}
                  label={t('security.requireNumbers')}
                />
                <Toggle
                  checked={security.passwordRequireUppercase}
                  onChange={v => setSecurity(s => s && { ...s, passwordRequireUppercase: v })}
                  label={t('security.requireUppercase')}
                />
                <Toggle
                  checked={security.twoFactorAuthRequired}
                  onChange={v => setSecurity(s => s && { ...s, twoFactorAuthRequired: v })}
                  label={t('security.require2FA')}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value='notifications' className='mt-lg'>
          <Card className='border-border/60'>
            <CardHeader>
              <CardTitle className='text-sm'>{t('notifications.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='divide-y divide-border/40'>
                {(
                  [
                    ['emailEnabled', t('notifications.emailEnabled')],
                    ['smsEnabled', t('notifications.smsEnabled')],
                    ['pushNotificationsEnabled', t('notifications.pushEnabled')],
                    ['adminEmailAlerts', t('notifications.adminAlerts')],
                    ['orderConfirmationEnabled', t('notifications.orderConfirmation')],
                    ['orderReminderEnabled', t('notifications.orderReminder')],
                    ['promotionalEmailsEnabled', t('notifications.promotionalEmails')],
                  ] as [keyof NotificationSettings, string][]
                ).map(([key, label]) => (
                  <Toggle
                    key={key}
                    checked={notifications[key] as boolean}
                    onChange={v => setNotifications(n => n && { ...n, [key]: v })}
                    label={label}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment */}
        <TabsContent value='payment' className='mt-lg'>
          <Card className='border-border/60'>
            <CardHeader>
              <CardTitle className='text-sm'>{t('payment.title')}</CardTitle>
            </CardHeader>
            <CardContent className='space-y-lg'>
              <div className='divide-y divide-border/40'>
                <Toggle
                  checked={payment.stripeEnabled}
                  onChange={v => setPayment(p => p && { ...p, stripeEnabled: v })}
                  label={t('payment.stripeEnabled')}
                />
                <Toggle
                  checked={payment.paypalEnabled}
                  onChange={v => setPayment(p => p && { ...p, paypalEnabled: v })}
                  label={t('payment.paypalEnabled')}
                />
                <Toggle
                  checked={payment.automaticPayouts}
                  onChange={v => setPayment(p => p && { ...p, automaticPayouts: v })}
                  label={t('payment.automaticPayouts')}
                />
              </div>
              <Separator />
              <div className='grid gap-lg sm:grid-cols-2'>
                <NumberInput
                  value={payment.minimumPayoutAmount}
                  onChange={v => setPayment(p => p && { ...p, minimumPayoutAmount: v })}
                  label={t('payment.minimumPayout')}
                  min={1}
                  suffix='TND'
                />
                <NumberInput
                  value={payment.refundProcessingDays}
                  onChange={v => setPayment(p => p && { ...p, refundProcessingDays: v })}
                  label={t('payment.refundProcessingDays')}
                  min={1}
                  max={30}
                  suffix='days'
                />
              </div>
              <div className='space-y-xs'>
                <Label className='text-xs'>{t('payment.payoutFrequency')}</Label>
                <div className='flex gap-sm'>
                  {(['daily', 'weekly', 'monthly'] as const).map(freq => (
                    <button
                      key={freq}
                      onClick={() => setPayment(p => p && { ...p, payoutFrequency: freq })}
                      className={`rounded-md border px-md py-1.5 text-xs font-medium transition-colors ${
                        payment.payoutFrequency === freq
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background hover:bg-muted'
                      }`}
                    >
                      {t(`payment.${freq}` as Parameters<typeof t>[0])}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Version History */}
      {history && history.length > 0 && (
        <Card className='border-border/60'>
          <CardHeader>
            <CardTitle className='text-sm'>{t('history.title')}</CardTitle>
            <CardDescription className='text-xs'>
              {t('currentVersion')}: v{config?.version}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='overflow-hidden rounded-lg border border-border/40'>
              <table className='w-full text-xs'>
                <thead>
                  <tr className='border-b border-border/40 bg-muted/30'>
                    {[
                      t('history.version'),
                      t('history.description'),
                      t('history.createdBy'),
                      t('history.createdAt'),
                      '',
                    ].map((h, i) => (
                      <th
                        key={i}
                        className='px-md py-sm text-start font-semibold text-muted-foreground'
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className='divide-y divide-border/30'>
                  {history.map(ver => (
                    <tr key={ver.id} className='hover:bg-muted/20'>
                      <td className='px-md py-sm font-mono font-medium'>v{ver.version}</td>
                      <td className='max-w-[200px] truncate px-md py-sm text-muted-foreground'>
                        {ver.description ?? t('history.noDescription')}
                      </td>
                      <td className='px-md py-sm text-muted-foreground'>{ver.lastModifiedBy}</td>
                      <td className='px-md py-sm text-muted-foreground tabular-nums'>
                        {relativeDate(ver.createdAt)}
                      </td>
                      <td className='px-md py-sm'>
                        {!ver.isActive && (
                          <Button
                            variant='outline'
                            size='sm'
                            className='px-sm text-xs'
                            onClick={() => setRollbackDialog(ver.version)}
                          >
                            <RotateCcw className='me-xs size-3' />
                            {t('history.rollback')}
                          </Button>
                        )}
                        {ver.isActive && (
                          <Badge
                            variant='outline'
                            className='text-[10px] text-emerald-600 border-emerald-300'
                          >
                            Current
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Dialog */}
      <ConfirmActionDialog
        open={saveDialog}
        onOpenChange={setSaveDialog}
        title={t('confirmSave.title')}
        description={t('confirmSave.description')}
        confirmLabel={t('saveChanges')}
        variant='warning'
        isLoading={updateConfig.isPending}
        onConfirm={handleSave}
      />

      {/* Rollback Dialog */}
      <ConfirmActionDialog
        open={!!rollbackDialog}
        onOpenChange={open => !open && setRollbackDialog(null)}
        title={t('history.confirmRollback.title')}
        description={t('history.confirmRollback.description', { version: rollbackDialog ?? '' })}
        confirmLabel={t('history.rollback')}
        variant='warning'
        isLoading={rollbackConfig.isPending}
        onConfirm={handleRollback}
      />

      {/* Import Config Dialog */}
      <Dialog
        open={importDialog}
        onOpenChange={open => {
          if (!open) {
            setImportDialog(false);
            setImportValidation(null);
          }
        }}
      >
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-sm'>
              <Upload className='size-4' />
              Import Configuration
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-md py-sm'>
            <p className='text-xs text-muted-foreground'>
              Paste a previously exported configuration JSON. Validate before applying to check for
              errors.
            </p>
            <Textarea
              value={importJson}
              onChange={e => {
                setImportJson(e.target.value);
                setImportValidation(null);
              }}
              placeholder='{ "platformSettings": { ... }, "securitySettings": { ... }, ... }'
              rows={10}
              className='font-mono text-xs'
            />
            {importValidation && (
              <div
                className={`flex items-start gap-sm rounded-lg border px-md py-2.5 text-xs ${
                  importValidation.valid
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-rose-200 bg-rose-50 text-rose-800'
                }`}
              >
                {importValidation.valid ? (
                  <CheckCircle2 className='mt-xxs size-3.5 shrink-0' />
                ) : (
                  <XCircle className='mt-xxs size-3.5 shrink-0' />
                )}
                <div>
                  {importValidation.valid
                    ? 'Configuration is valid — ready to import.'
                    : (importValidation.errors ?? ['Validation failed']).join('; ')}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className='gap-sm'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => {
                setImportDialog(false);
                setImportValidation(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={!importJson.trim() || validateImport.isPending}
              onClick={handleValidateImport}
            >
              {validateImport.isPending ? (
                <Loader2 className='me-1.5 size-3.5 animate-spin' />
              ) : null}
              Validate
            </Button>
            <Button
              size='sm'
              disabled={!importValidation?.valid || importConfig.isPending}
              onClick={handleConfirmImport}
            >
              {importConfig.isPending ? <Loader2 className='me-1.5 size-3.5 animate-spin' /> : null}
              Apply Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
