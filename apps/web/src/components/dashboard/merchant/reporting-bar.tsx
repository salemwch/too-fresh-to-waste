'use client';

import { useState } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { dashboardService } from '@/services/dashboard.service';

export function ReportingBar() {
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    if (loading) return;
    setLoading(true);
    try {
      const response = await dashboardService.downloadCarbonBalanceReport();
      const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bilan-carbone-${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Rapport PDF téléchargé avec succès.');
    } catch {
      toast.error('Erreur lors de la génération du rapport. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='glass rounded-2xl p-[20px] md:p-[24px] shadow-soft flex items-center justify-between gap-[16px] flex-wrap'>
      <div className='flex items-center gap-[16px] min-w-0'>
        <div className='h-12 w-12 rounded-xl bg-primary-500/[0.08] grid place-items-center text-primary-500 shrink-0'>
          <FileText size={20} />
        </div>
        <div className='min-w-0'>
          <div className='font-display text-lg text-primary-500 leading-tight'>
            Besoin de votre Bilan Carbone&nbsp;?
          </div>
          <p className='text-xs text-primary-500/65 mt-1'>
            Rapport PDF formaté pour votre audit ISO&nbsp;14001 · données impact 2026 incluses.
          </p>
        </div>
      </div>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className='inline-flex items-center gap-2 px-[20px] py-3 rounded-full bg-primary-500 text-white text-sm font-medium hover:opacity-90 transition shadow-soft shrink-0 disabled:opacity-60'
      >
        {loading ? <Loader2 size={16} className='animate-spin' /> : <Download size={16} />}
        {loading ? 'Génération…' : 'Générer le rapport 2026'}
      </button>
    </div>
  );
}
