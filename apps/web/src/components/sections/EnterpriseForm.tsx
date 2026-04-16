'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';

export function EnterpriseForm() {
  const t = useTranslations('companies');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [form, setForm] = useState({
    businessName: '',
    firstName: '',
    lastName: '',
    phone: '',
    message: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    // Simulate submission — wire to real API when available
    await new Promise(r => setTimeout(r, 1200));
    setStatus('success');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className='relative rounded-3xl overflow-hidden'
      style={{
        background: 'linear-gradient(135deg, rgba(0,82,80,0.15) 0%, rgba(2,15,12,0.95) 100%)',
        border: '1px solid rgba(0,82,80,0.4)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Corner accent */}
      <div
        className='absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-20'
        style={{ background: 'radial-gradient(circle, #ff7973, transparent 70%)' }}
        aria-hidden='true'
      />

      <div className='p-8 md:p-10 relative z-10'>
        <p
          className='text-xs font-bold uppercase tracking-[0.2em] mb-2'
          style={{ color: '#ff7973' }}
        >
          {t('hero.eyebrow')}
        </p>
        <h2
          className='text-2xl md:text-3xl font-bold text-white mb-2'
          style={{ fontFamily: 'var(--font-playfair)' }}
        >
          {t('form.title')}
        </h2>
        <p className='text-sm mb-8' style={{ color: 'rgba(240,236,228,0.6)' }}>
          {t('form.sub')}
        </p>

        <AnimatePresence mode='wait'>
          {status === 'success' ? (
            <motion.div
              key='success'
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className='flex flex-col items-center text-center py-8 gap-4'
            >
              <div
                className='w-16 h-16 rounded-full flex items-center justify-center'
                style={{ background: 'rgba(0,82,80,0.3)', border: '1px solid #005250' }}
              >
                <svg
                  className='w-8 h-8 text-[#7fb89a]'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M5 13l4 4L19 7'
                  />
                </svg>
              </div>
              <p className='text-white font-semibold text-lg'>{t('form.success')}</p>
            </motion.div>
          ) : (
            <motion.form
              key='form'
              onSubmit={handleSubmit}
              className='space-y-4'
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Business Name */}
              <div>
                <label
                  className='block text-xs font-semibold mb-1.5'
                  style={{ color: 'rgba(240,236,228,0.7)' }}
                >
                  {t('form.fields.businessName')} *
                </label>
                <input
                  type='text'
                  name='businessName'
                  required
                  value={form.businessName}
                  onChange={handleChange}
                  className='w-full rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#005250] transition-all'
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                />
              </div>

              {/* First / Last Name */}
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label
                    className='block text-xs font-semibold mb-1.5'
                    style={{ color: 'rgba(240,236,228,0.7)' }}
                  >
                    {t('form.fields.firstName')} *
                  </label>
                  <input
                    type='text'
                    name='firstName'
                    required
                    value={form.firstName}
                    onChange={handleChange}
                    className='w-full rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#005250] transition-all'
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                    }}
                  />
                </div>
                <div>
                  <label
                    className='block text-xs font-semibold mb-1.5'
                    style={{ color: 'rgba(240,236,228,0.7)' }}
                  >
                    {t('form.fields.lastName')} *
                  </label>
                  <input
                    type='text'
                    name='lastName'
                    required
                    value={form.lastName}
                    onChange={handleChange}
                    className='w-full rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#005250] transition-all'
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                    }}
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label
                  className='block text-xs font-semibold mb-1.5'
                  style={{ color: 'rgba(240,236,228,0.7)' }}
                >
                  {t('form.fields.phone')} *
                </label>
                <input
                  type='tel'
                  name='phone'
                  required
                  value={form.phone}
                  onChange={handleChange}
                  className='w-full rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#005250] transition-all'
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                />
              </div>

              {/* Optional message */}
              <div>
                <label
                  className='block text-xs font-semibold mb-1.5'
                  style={{ color: 'rgba(240,236,228,0.7)' }}
                >
                  {t('form.fields.message')}
                </label>
                <textarea
                  name='message'
                  rows={3}
                  value={form.message}
                  onChange={handleChange}
                  className='w-full rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#005250] transition-all resize-none'
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                />
              </div>

              <motion.button
                type='submit'
                disabled={status === 'submitting'}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className='w-full py-4 rounded-xl font-bold text-sm tracking-wide text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-70'
                style={{ background: 'linear-gradient(135deg, #005250 0%, #007a78 100%)' }}
              >
                {status === 'submitting' ? (
                  <>
                    <svg className='w-4 h-4 animate-spin' fill='none' viewBox='0 0 24 24'>
                      <circle
                        className='opacity-25'
                        cx='12'
                        cy='12'
                        r='10'
                        stroke='currentColor'
                        strokeWidth='4'
                      />
                      <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8v8H4z' />
                    </svg>
                    {t('form.submitting')}
                  </>
                ) : (
                  <>
                    {t('form.submit')}
                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M17 8l4 4m0 0l-4 4m4-4H3'
                      />
                    </svg>
                  </>
                )}
              </motion.button>

              {status === 'error' && (
                <p className='text-center text-sm' style={{ color: '#ff7973' }}>
                  {t('form.error')}
                </p>
              )}
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
