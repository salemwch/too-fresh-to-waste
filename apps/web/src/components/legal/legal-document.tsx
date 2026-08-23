import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/config';

/**
 * One renderer for all six legal documents.
 *
 * They are the same shape - a dated header, an intro, then sections of prose
 * and bullet lists - and six near-identical 200-line pages is six places for
 * the markup to drift. More importantly for this change: a document whose
 * structure lives in the messages can be translated by editing JSON, while one
 * whose structure lives in JSX has to be rebuilt by hand in every language.
 *
 * It reads its own copy rather than taking it as props, so each page is a
 * dozen lines: name the namespace and the path, and the document renders.
 *
 * Paragraphs are rich text. `<b>` emphasises, `<em>` italicises a cited statute
 * name, and `<link>` becomes the contact mailto. Translators move those markers
 * to wherever their grammar needs them, which is the whole reason for the tag
 * form over string concatenation.
 */

interface LegalSubsection {
  heading?: string;
  paragraphs?: string[];
  items?: string[];
}

interface LegalSection {
  heading?: string;
  paragraphs?: string[];
  items?: string[];
  subsections?: LegalSubsection[];
}

interface LegalDocumentProps {
  locale: Locale;
  /** Namespace under `legal`, e.g. 'cookiePolicy'. */
  document: string;
  contactEmail: string;
}

export async function LegalDocument({ locale, document, contactEmail }: LegalDocumentProps) {
  const t = await getTranslations({ locale, namespace: `legal.${document}` });
  const tLegal = await getTranslations({ locale, namespace: 'legal' });

  const tags = {
    b: (chunks: ReactNode) => <strong className='text-foreground'>{chunks}</strong>,
    em: (chunks: ReactNode) => <em>{chunks}</em>,
    link: (chunks: ReactNode) => (
      <a
        href={`mailto:${contactEmail}`}
        className='text-primary-500 underline underline-offset-2 hover:opacity-75'
      >
        {chunks}
      </a>
    ),
  };

  /**
   * next-intl types `t.rich` against the literal key so it can check which
   * values a message needs. These keys are built at runtime from the document's
   * own shape, so that inference has nothing to work with and the cast is the
   * honest way to say so rather than fighting it with `as never`, which types
   * the values parameter as `undefined`.
   *
   * The strings come from our own message files, so the markup is trusted by
   * construction - next-intl interprets only the three tags supplied above and
   * escapes everything else.
   */
  const richOf = t.rich as unknown as (key: string, values: typeof tags) => ReactNode;
  const rich = (message: string): ReactNode => richOf(message, tags);

  const intro = (t.raw('intro') ?? []) as string[];
  const sections = t.raw('sections') as LegalSection[];
  const governing = tLegal('governingLanguage');

  return (
    <div className='min-h-screen bg-background'>
      <section className='bg-primary-500 py-16 px-4'>
        <div className='max-w-4xl mx-auto text-center'>
          <h1 className='text-3xl md:text-4xl font-bold text-white mb-3'>{t('title')}</h1>
          <p className='text-white/75 text-sm'>
            {tLegal('dateline', { date: tLegal('lastUpdated') })}
          </p>
        </div>
      </section>

      <article className='max-w-3xl mx-auto px-4 py-14'>
        <div className='space-y-6 text-foreground'>
          {/*
            Present on the French and Arabic renderings and absent on the
            English, which is the authoritative text - a document cannot
            sensibly defer to itself.
          */}
          {governing !== '' && (
            <aside className='rounded-2xl border border-primary-500/20 bg-primary-500/5 px-5 py-4'>
              <p className='text-sm leading-relaxed text-muted-foreground'>
                {tLegal.rich('governingLanguage', tags)}
              </p>
            </aside>
          )}

          {intro.length > 0 && (
            <section>
              {intro.map((paragraph, i) => (
                <p
                  key={paragraph}
                  className={`text-sm leading-relaxed text-muted-foreground${i > 0 ? ' mt-4' : ''}`}
                >
                  {rich(`intro.${i}`)}
                </p>
              ))}
            </section>
          )}

          {sections.map((section, si) => (
            <div key={section.heading ?? String(si)}>
              <hr className='border-border' />
              <section className='pt-6'>
                {section.heading !== undefined && (
                  <h2 className='text-2xl md:text-3xl font-bold text-primary-500 mb-3'>
                    {section.heading}
                  </h2>
                )}

                {section.paragraphs?.map((paragraph, pi) => (
                  <p
                    key={paragraph}
                    className={`text-sm leading-relaxed text-muted-foreground${pi > 0 ? ' mt-4' : ''}`}
                  >
                    {rich(`sections.${si}.paragraphs.${pi}`)}
                  </p>
                ))}

                {section.items !== undefined && section.items.length > 0 && (
                  <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground mt-3'>
                    {section.items.map((item, ii) => (
                      <li key={item}>{rich(`sections.${si}.items.${ii}`)}</li>
                    ))}
                  </ul>
                )}

                {section.subsections?.map((sub, ui) => (
                  <div key={sub.heading ?? String(ui)} className='mt-5'>
                    {sub.heading !== undefined && (
                      <h3 className='text-base font-semibold mb-2'>{sub.heading}</h3>
                    )}
                    {sub.paragraphs?.map((paragraph, pi) => (
                      <p
                        key={paragraph}
                        className={`text-sm leading-relaxed text-muted-foreground${pi > 0 ? ' mt-3' : ''}`}
                      >
                        {rich(`sections.${si}.subsections.${ui}.paragraphs.${pi}`)}
                      </p>
                    ))}
                    {sub.items !== undefined && sub.items.length > 0 && (
                      <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground mt-2'>
                        {sub.items.map((item, ii) => (
                          <li key={item}>{rich(`sections.${si}.subsections.${ui}.items.${ii}`)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </section>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
