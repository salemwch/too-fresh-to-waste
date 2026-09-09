'use client';

import { useState } from 'react';

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}

function SliderRow({ label, value, min, max, step, unit, onChange }: SliderRowProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className='flex items-baseline justify-between mb-sm'>
        <p className='text-white/75 text-xs font-bold uppercase tracking-[0.15em]'>{label}</p>
        <div className='flex items-baseline gap-xs'>
          <span className='font-heading text-3xl font-bold text-white tabular-nums leading-none'>
            {value}
          </span>
          <span className='text-white/75 text-sm font-medium'>{unit}</span>
        </div>
      </div>
      <input
        type='range'
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className='revenue-slider w-full'
        style={{
          background: `linear-gradient(to right, #FFA000 0%, #FFA000 ${pct}%, rgba(255,255,255,0.14) ${pct}%, rgba(255,255,255,0.14) 100%)`,
        }}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      />
      <div className='flex justify-between mt-1.5'>
        <span className='text-white/75 text-[10px]'>
          {min}
          {unit}
        </span>
        <span className='text-white/75 text-[10px]'>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-US');
}

function formatCO2(kg: number) {
  return kg >= 1000 ? (kg / 1000).toFixed(1) + ' t' : Math.round(kg) + ' kg';
}

function formatWater(l: number) {
  if (l >= 1_000_000) return (l / 1_000_000).toFixed(1) + 'M L';
  if (l >= 1_000) return Math.round(l / 1000) + 'K L';
  return Math.round(l) + ' L';
}

export default function RevenueCalculator() {
  const [bags, setBags] = useState(10);
  const [price, setPrice] = useState(20);
  const [discount, setDiscount] = useState(60);
  const [days, setDays] = useState(25);

  const bagPrice = (price * (100 - discount)) / 100;
  const revenuePerMonth = bags * bagPrice * days;
  const revenuePerYear = revenuePerMonth * 12;
  const bagsPerYear = bags * days * 12;
  // Impact: 2 kg CO₂ saved per bag, 300 L water saved per bag (WRAP avg)
  const co2Saved = bagsPerYear * 2;
  const waterSaved = bagsPerYear * 300;

  return (
    <div className='grid lg:grid-cols-2 gap-2xl lg:gap-3xl items-start'>
      {/* ── LEFT - Sliders ── */}
      <div className='bg-white/5 border border-white/10 rounded-3xl p-lg lg:p-xl space-y-md'>
        <div>
          <p className='text-white/70 text-[10px] font-bold uppercase tracking-[0.2em] mb-xs'>
            Your business
          </p>
          <p className='text-white font-heading text-2xl font-bold leading-snug'>
            Adjust your scenario
          </p>
        </div>

        <SliderRow
          label='Bags sold per day'
          value={bags}
          min={1}
          max={50}
          step={1}
          unit=' bags'
          onChange={setBags}
        />

        <SliderRow
          label='Original product value'
          value={price}
          min={1}
          max={100}
          step={1}
          unit=' TND'
          onChange={setPrice}
        />

        <SliderRow
          label='Your discount'
          value={discount}
          min={40}
          max={90}
          step={5}
          unit='%'
          onChange={setDiscount}
        />

        <SliderRow
          label='Days open this month'
          value={days}
          min={10}
          max={31}
          step={1}
          unit=' days'
          onChange={setDays}
        />
      </div>

      {/* ── RIGHT - Results ── */}
      <div className='space-y-lg'>
        {/* Monthly + annual */}
        <div className='bg-white/10 border border-white/10 rounded-3xl p-3xl relative overflow-hidden'>
          {/* coral glow */}

          <p className='text-white/75 text-[10px] font-bold uppercase tracking-widest mb-sm'>
            Monthly revenue
          </p>
          <div className='flex items-baseline gap-sm mb-sm'>
            <span className='font-heading text-5xl lg:text-6xl font-bold text-white tabular-nums leading-none'>
              {fmt(revenuePerMonth)}
            </span>
            <span className='text-white/75 text-xl font-normal'>TND</span>
          </div>
          <p className='text-white/75 text-xs'>
            {bags} bags × {bagPrice % 1 === 0 ? bagPrice : bagPrice.toFixed(1)} TND × {days} days
          </p>

          <div className='mt-xl pt-xl border-t border-white/10 flex items-baseline justify-between gap-lg'>
            <p className='text-white/75 text-[10px] font-bold uppercase tracking-widest shrink-0'>
              Per year
            </p>
            <p className='font-heading text-3xl font-bold text-brand-coral tabular-nums'>
              {fmt(revenuePerYear)}{' '}
              {/*
                Not coral. The figure above is 28px bold, so it counts as large
                text and clears the 3:1 bar at 3.11 on this ground (#35575A -
                the stacked white tints lift it well off the flat teal). This
                suffix is 18px regular, which is normal text needing 4.5, and
                coral at 80% measured 2.46. It is a unit label, so it does not
                need the accent to do its job.
              */}
              <span className='text-white/75 text-lg font-normal'>TND</span>
            </p>
          </div>
        </div>

        {/* Impact metrics */}
        <div className='grid grid-cols-3 gap-md'>
          <div className='bg-white/5 border border-white/10 rounded-2xl p-lg text-center'>
            <p className='font-heading text-xl font-bold text-white tabular-nums'>
              {fmt(bagsPerYear)}
            </p>
            <p className='text-white/80 text-[10px] mt-xs leading-tight'>Bags saved / year</p>
          </div>
          <div className='bg-white/5 border border-white/10 rounded-2xl p-lg text-center'>
            <p className='font-heading text-xl font-bold text-emerald-400 tabular-nums'>
              {formatCO2(co2Saved)}
            </p>
            <p className='text-white/80 text-[10px] mt-xs leading-tight'>CO₂ avoided / year</p>
          </div>
          <div className='bg-white/5 border border-white/10 rounded-2xl p-lg text-center'>
            <p className='font-heading text-xl font-bold text-sky-300 tabular-nums'>
              {formatWater(waterSaved)}
            </p>
            <p className='text-white/80 text-[10px] mt-xs leading-tight'>Water saved / year</p>
          </div>
        </div>

        <p className='text-white/75 text-[10px] text-center leading-relaxed'>
          * Estimates based on WRAP &amp; WWF food waste data. CO₂ at 2 kg/bag · water at 300 L/bag.
        </p>
      </div>
    </div>
  );
}
