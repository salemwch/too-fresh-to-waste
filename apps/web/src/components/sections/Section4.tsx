'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { HeartHandshake, Sparkles, Trophy } from 'lucide-react';

interface StepCard {
  id: number;
  icon: string;
  iconAlt: string;
}

const STEP_CARDS: StepCard[] = [
  { id: 1, icon: '/icons/browsing.png', iconAlt: 'Browse offers' },
  { id: 2, icon: '/icons/booking.png', iconAlt: 'Reserve a bag' },
  { id: 3, icon: '/icons/order.png', iconAlt: 'Collect your food' },
];

const REWARD_CARDS = [
  { key: 'points', Icon: Sparkles },
  { key: 'families', Icon: HeartHandshake },
  { key: 'prize', Icon: Trophy },
] as const;

export default function Section4() {
  const t = useTranslations('section4');
  const tr = useTranslations('rewards');
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const [introVisible, setIntroVisible] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!wrap || !track || !stage) return;

    let raf: number;
    function update() {
      const rect = wrap!.getBoundingClientRect();
      /*
       * Measure against the stage, not the viewport. A sticky element stays
       * pinned for `wrapHeight - stageHeight`. Using innerHeight here would
       * finish the horizontal travel before the pin released, leaving the last
       * stretch of scroll parked on a static frame.
       */
      const total = wrap!.offsetHeight - stage!.offsetHeight;
      const progress = total > 0 ? Math.max(0, Math.min(1, -rect.top / total)) : 0;
      const maxShift = track!.scrollWidth - window.innerWidth;
      track!.style.transform = `translateX(${-progress * Math.max(0, maxShift)}px)`;

      // scaleX rather than width: it stays on the compositor and never lays out
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${progress})`;

      /*
       * Reveal on arrival, not on travel. The header is persistent now, so
       * gating it on `progress > 0` left it blank for the whole approach and it
       * only appeared once the pin had already started.
       */
      if (!introVisible && rect.top < window.innerHeight * 0.85) setIntroVisible(true);

      raf = requestAnimationFrame(update);
    }
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [introVisible]);

  return (
    <>
      {/*
        The wrapper carries the teal, not just the stage. The stage is sized to
        its content and is shorter than the viewport, so during the pin the
        strip below it is the wrapper - and painting that cream left a large
        empty band under the cards for most of the scroll. Teal here means the
        ground reads as one continuous section however tall the stage is.
      */}
      <div ref={wrapRef} className='s4-scroll-wrap'>
        {/*
          The wave lives on the wrapper, not on `.s4-pinned`. The pinned
          section carries `overflow: hidden` so the horizontal track can run
          off-screen without widening the page, and that clip also swallowed
          this wave, which sits entirely above the section's own box.
        */}
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 1440 320'
          className='s4-wave'
          preserveAspectRatio='none'
          aria-hidden='true'
        >
          <path
            fill='hsl(var(--primary))'
            fillOpacity='1.00'
            d='M 0 270 L 0 185.52490399562885 C 102.85714285714286 185.52490399562885 102.85714285714286 278.99517607344757 205.71428571428572 278.99517607344757 C 308.57142857142856 278.99517607344757 308.57142857142856 202.65754578736295 411.42857142857144 202.65754578736295 C 514.2857142857142 202.65754578736295 514.2857142857142 211.86036557464226 617.1428571428571 211.86036557464226 C 720 211.86036557464226 720 155.39411761119555 822.8571428571429 155.39411761119555 C 925.7142857142858 155.39411761119555 925.7142857142858 242.90942100346388 1028.5714285714287 242.90942100346388 C 1131.4285714285716 242.90942100346388 1131.4285714285716 227.68305379355218 1234.2857142857142 227.68305379355218 C 1337.142857142857 227.68305379355218 1337.142857142857 242.284257936268 1440 242.284257936268 C 1440 242.284257936268 1440 320 1440 320 L 1440 320 L 0 320 Z'
          />
        </svg>

        <section
          ref={stageRef}
          id='how-to-use'
          className='s4-pinned'
          aria-labelledby='how-to-use-heading'
        >
          {/*
            The title is stage furniture, not a track panel. As the first item
            in the track it scrolled away, which left the top of a 100vh stage
            empty for the rest of the pin - the dead space this section kept
            being accused of. Persistent, it holds that space with content.

            It also no longer renders an eyebrow: there is no section4.eyebrow
            key, so the eyebrow was printing t('title') and the same sentence
            appeared twice, once small and once large.
          */}
          <div className={`s4-stage-header ${introVisible ? 's4-stage-header--visible' : ''}`}>
            <h2 id='how-to-use-heading' className='s4-heading'>
              {t('title')}
            </h2>
            <p className='s4-sub'>{t('description')}</p>
          </div>

          {/* Horizontal track */}
          <div ref={trackRef} className='s4-track'>
            {/* Step cards - exact same design */}
            {STEP_CARDS.map((card, i) => (
              <div key={card.id} className='s4-card-slot'>
                {/*
                  Absolutely positioned so the slot keeps its 200px box. Adding
                  it to the flow would make the step slots taller than the
                  rewards grid, and the two stopped lining up - the misalignment
                  that was reported earlier.
                */}
                <span className='s4-step-num' aria-hidden='true'>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <article className='card-wrapper'>
                  <div className='card-circle'>
                    <Image
                      src={card.icon}
                      alt={card.iconAlt}
                      width={32}
                      height={32}
                      className='card-circle-icon'
                      loading='lazy'
                    />
                  </div>
                  <div className='card'>
                    <h3 className='card-title'>{t(`slides.step${card.id}.title`)}</h3>
                    <p className='card-desc'>{t(`slides.step${card.id}.description`)}</p>
                  </div>
                </article>
              </div>
            ))}

            {/*
              The rewards copy is a panel in the horizontal flow, reached
              between the last step card and the first reward card - the same
              shape as the intro panel that opens the track.

              It used to be absolutely positioned at bottom:100% above the
              grid, floating outside the flow. That is what forced the stage's
              160px top padding: the header hung 141px above the track and the
              section's overflow:hidden clipped it below that. In the flow it
              costs no vertical room at all, so the cards can sit near the wave.
            */}
            <div className='s4-rewards-intro'>
              <p className='s4-r-eyebrow'>{tr('eyebrow')}</p>
              <h3 className='s4-r-heading'>{tr('title')}</h3>
              <p className='s4-r-sub'>{tr('description')}</p>
            </div>

            <div className='s4-rewards-slot'>
              <div className='s4-rewards-inner'>
                <div className='s4-r-grid'>
                  {REWARD_CARDS.map(({ key, Icon }) => (
                    <div key={key} className='s4-r-card'>
                      {/*
                        shrink-0 is load-bearing: the card is a flex column, so
                        the icon is a flex item and defaults to flex-shrink:1.
                        On the one card whose body overflows, the SVG was the
                        thing that gave, which is why only "A child gets what
                        they need" had a visibly smaller icon than its siblings.
                      */}
                      <Icon
                        className='text-secondary size-7 shrink-0'
                        strokeWidth={1.5}
                        aria-hidden='true'
                      />
                      <h4 className='s4-r-card-title'>{tr(`${key}.label`)}</h4>
                      <p className='s4-r-card-body'>{tr(`${key}.body`)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/*
            Scroll position for a track that runs off both edges. Decorative
            only: it reports the same thing the cards already show, so it is
            hidden from assistive tech rather than announced as a live value.
          */}
          <div className='s4-progress' aria-hidden='true'>
            <span ref={fillRef} className='s4-progress-fill' />
          </div>
        </section>
      </div>

      <style jsx global>{`
        /* ── Scroll wrapper: tall to create scroll room ── */
        .s4-scroll-wrap {
          height: 300vh;
          position: relative;
          background-color: hsl(var(--primary));
        }

        /* ── Wave: the cream-to-teal edge, above the pinned section ── */
        .s4-wave {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          transform: translateY(-99%);
          z-index: 11;
          pointer-events: none;
        }

        /* ── Pinned section ── */
        .s4-pinned {
          position: sticky;
          top: 0;
          /*
           * Sized to its content, not to the viewport. At 100vh the stage held
           * 200px of cards inside 694px of teal, so ~494px was empty no matter
           * how it was distributed - moving the cards up only shifted the gap
           * to the bottom. Height auto plus the padding below ends the teal
           * shortly after the cards, and the wrapper carries cream for the
           * rest of the pin.
           *
           * The top padding clears the site header, which is position:fixed at
           * 56px with z-index 50 and therefore sits over this stage while it
           * is pinned at top:0. 24px alone put the card badges 42px behind it.
           * The badges need 14px, the header needs 56.
           *
           * Full viewport again, as a three-row column: title, track, progress.
           * Sizing the stage to its content only moved the empty teal below it
           * onto the wrapper. The stage is meant to be the viewport; what was
           * missing was content to hold the space, not a shorter stage.
           */
          height: 100vh;
          padding-top: 80px;
          padding-bottom: 40px;
          background-color: hsl(var(--primary));
          overflow: hidden;
          display: flex;
          /*
           * No backticks in this block: it is a template literal, and one
           * terminates the style tag and blanks the whole page.
           */
          flex-direction: column;
          align-items: stretch;
          justify-content: space-between;
          z-index: 10;
        }

        /*
         * No ambient overlay here. Two radial gradients (teal at 0.07, gold at
         * 0.04) used to sit over this section, which tinted the ground away
         * from flat primary and made the wave above read as a different green
         * than the section it flows into - the wave is flat primary and had
         * nothing painted on top of it. Flat ground is also what the design
         * rules require: tinted radial glows are a banned decoration.
         */
        /* ── Horizontal track ── */
        .s4-track {
          display: flex;
          align-items: center;
          padding-inline-start: 8vw;
          will-change: transform;
          /*
           * The track is wider than the stage and must not be stretched to the
           * column's width, or the flex row would compress its slots instead of
           * overflowing them. The stage clips the overflow.
           */
          flex-shrink: 0;
          align-self: flex-start;
        }

        /* ── Scroll progress ── */
        .s4-progress {
          flex-shrink: 0;
          margin-inline: 8vw;
          height: 2px;
          border-radius: 999px;
          background: rgba(249, 243, 240, 0.14);
          overflow: hidden;
        }

        .s4-progress-fill {
          display: block;
          height: 100%;
          background: hsl(var(--secondary));
          transform: scaleX(0);
          /* grows from the reading-start edge in both directions */
          transform-origin: left center;
        }

        [dir='rtl'] .s4-progress-fill {
          transform-origin: right center;
        }

        /* ── Persistent stage header ── */
        .s4-stage-header {
          flex-shrink: 0;
          padding-inline: 8vw;
          max-width: 720px;
        }

        .s4-heading {
          color: hsl(var(--secondary));
          font-size: clamp(28px, 4.4vw, 48px);
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: 14px;
          opacity: 0;
          transform: translateY(28px);
          transition: all 1.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .s4-sub {
          color: rgba(249, 243, 240, 0.72);
          font-size: 16px;
          line-height: 1.6;
          max-width: 420px;
          opacity: 0;
          transform: translateY(20px);
          transition: all 1.6s 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .s4-stage-header--visible .s4-heading,
        .s4-stage-header--visible .s4-sub {
          opacity: 1;
          transform: translateY(0);
        }

        /* ── Card slots ── */
        .s4-card-slot {
          width: 340px;
          flex-shrink: 0;
          padding: 0 14px;
          /* anchor for the absolutely placed step number */
          position: relative;
        }

        /* ── Step numbers: chrome above each card, outside its box ── */
        .s4-step-num {
          position: absolute;
          bottom: 100%;
          inset-inline-start: 14px;
          margin-bottom: 16px;
          font-family: var(--font-heading);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.26em;
          color: hsl(var(--secondary) / 0.65);
        }

        .s4-card-slot .card-wrapper {
          height: 100%;
        }

        .s4-card-slot .card {
          /* paired with .s4-r-grid height - see the note there */
          min-height: 240px;
        }

        /* ── Cards: same design as before ── */
        .card-wrapper {
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .card {
          background-color: #fff;
          padding: 24px;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          text-align: left;
          border-radius: 30px;
          transition:
            transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
            box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.18);
        }

        .card-circle {
          width: 60px;
          height: 60px;
          background-color: #fff;
          position: absolute;
          top: -10px;
          right: -10px;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1;
          padding: 14px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        }

        .card-circle-icon {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .card-title {
          font-size: 1.2rem;
          font-weight: 700;
          margin-bottom: 10px;
          padding-right: 70px;
          color: #1a1a1a;
        }

        /*
         * 16px, and no right inset. The badge is 60px tall at top:-10px, so it
         * occupies the card's first 50px; the description starts around 57px,
         * clear of it. That 65px of padding was protecting against an overlap
         * that cannot happen, and it cost a quarter of the line width - which
         * is most of why this copy read as cramped. The title keeps its inset
         * because the title genuinely does run under the badge.
         */
        .card-desc {
          font-size: 1rem;
          line-height: 1.55;
          color: #666;
          margin-bottom: 0;
          flex-grow: 1;
        }

        /* ── Rewards slot ── */
        .s4-rewards-slot {
          min-width: 900px;
          flex-shrink: 0;
          padding-inline-start: 56px;
          padding-inline-end: 8vw;
          display: flex;
          align-items: center;
        }

        .s4-rewards-inner {
          position: relative;
          width: 800px;
        }

        /*
         * Reads between the Collect card and the first reward card. Sized and
         * spaced like a card slot so the track carries a real text beat
         * rather than one panel and one floating caption.
         */
        .s4-rewards-intro {
          width: 380px;
          flex-shrink: 0;
          padding: 0 44px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
        }

        .s4-r-eyebrow {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.75);
        }

        .s4-r-heading {
          font-family: var(--font-heading);
          font-size: clamp(20px, 2.5vw, 26px);
          font-weight: 800;
          line-height: 1.15;
          color: #fff;
        }

        .s4-r-sub {
          font-size: 14px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.72);
          max-width: 420px;
        }

        /* Rewards bento grid - horizontal 3 columns, match step card height */
        .s4-r-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          overflow: hidden;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.08);
          /*
           * 240, not 200, and it must stay equal to .s4-card-slot .card
           * min-height or the rewards grid stops lining up with the step cards.
           * At 200 the "A child gets what they need" body needed 232px and was
           * silently cut by the overflow:hidden below - the same truncation
           * reported on mobile, present on desktop too and not caused by the
           * type bump, only made more obvious by it.
           */
          height: 240px;
        }

        .s4-r-card {
          background: hsl(var(--primary));
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 20px;
          overflow: hidden;
          transition: background 0.3s ease;
        }

        .s4-r-card:hover {
          background: hsl(var(--primary) / 0.85);
        }

        .s4-r-card-title {
          font-family: var(--font-heading);
          font-size: 16px;
          font-weight: 700;
          color: #fff;
        }

        .s4-r-card-body {
          font-size: 14px;
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.75);
        }

        /* ── Mobile: stack vertically, no horizontal scroll ── */
        @media (max-width: 1023px) {
          .s4-scroll-wrap {
            height: auto;
          }

          .s4-pinned {
            position: relative;
            height: auto;
            /* shorthand resets the desktop clamp above */
            padding: 80px 24px 64px;
            flex-direction: column;
            /* the stacked column centres again; flex-start is desktop-only */
            align-items: center;
          }

          .s4-track {
            flex-direction: column;
            padding-inline-start: 0;
            gap: 24px;
            width: 100%;
            max-width: 480px;
            margin: 0 auto;
            transform: none !important;
            /* undo the desktop overflow row: stacked, it must not overflow */
            flex-shrink: 1;
            align-self: stretch;
          }

          .s4-stage-header {
            width: 100%;
            max-width: none;
            padding-inline: 0;
            margin-bottom: 32px;
            text-align: center;
          }

          /* nothing drives the reveal without a pin, so show it outright */
          .s4-stage-header .s4-heading,
          .s4-stage-header .s4-sub {
            opacity: 1;
            transform: none;
          }

          .s4-sub {
            max-width: none;
            margin: 0 auto;
          }

          /* in the flow above each card: there is no room beside a stacked card */
          .s4-step-num {
            position: static;
            display: block;
            margin-bottom: 8px;
          }

          /* the bar tracks a pin that does not exist below this breakpoint */
          .s4-progress {
            display: none;
          }

          .s4-card-slot {
            min-width: auto;
            max-width: none;
            width: 100%;
            padding: 0;
          }

          .s4-rewards-slot {
            min-width: auto;
            padding-inline-start: 0;
            padding-inline-end: 0;
            width: 100%;
          }

          /* stacked: the panel is a full-width text block above the grid */
          .s4-rewards-intro {
            width: 100%;
            padding: 0;
            text-align: center;
          }

          /*
            Height auto, not the desktop 200px. Stacked into one column that
            200px had to hold all three reward cards at ~66px each, and with
            overflow:hidden on the card every body paragraph was cut off - only
            the labels survived.
          */
          .s4-r-grid {
            grid-template-columns: 1fr;
            height: auto;
          }

          .s4-r-card {
            overflow: visible;
          }

          /* equal boxes once the wrap difference is gone */
          .s4-card-slot .card {
            min-height: 200px;
          }

          .s4-rewards-inner {
            max-width: none;
            width: 100%;
          }
        }

        /* ── RTL support ── */
        [dir='rtl'] .card-title {
          padding-right: 0;
          padding-left: 70px;
        }

        [dir='rtl'] .card-circle {
          right: auto;
          left: -10px;
        }

        /*
         * Same rule as the .sr-* reveals: drop the movement, keep the fade.
         * This block used to force opacity:1 and no transition, which is the
         * thing that made every reveal look broken on a machine with the OS
         * setting on. It also still named .s4-eyebrow, which no longer exists.
         */
        @media (prefers-reduced-motion: reduce) {
          .s4-heading,
          .s4-sub {
            transform: none !important;
            transition: opacity 1.5s ease !important;
          }

          .card,
          .s4-r-card {
            transition: none !important;
          }

          .s4-progress-fill {
            transition: none !important;
          }
        }
      `}</style>
    </>
  );
}
