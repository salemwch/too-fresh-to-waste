import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import type {
  CarbonMetricsResponse,
  SocialImpactResponse,
  EsgTierResponse,
  MonthlyGoalResponse,
} from '../dto/sustainability.dto';

interface ReportData {
  merchantName: string;
  establishmentName?: string;
  city?: string;
  tier: EsgTierResponse;
  goal: MonthlyGoalResponse;
  carbon: CarbonMetricsResponse;
  social: SocialImpactResponse;
  generatedAt: Date;
}

const TEAL = rgb(0.118, 0.267, 0.282); // #1E4448
const CORAL = rgb(1, 0.475, 0.451); // #FF7973
const LIGHT_GRAY = rgb(0.96, 0.96, 0.96);
const MID_GRAY = rgb(0.5, 0.5, 0.5);

@Injectable()
export class PdfReportService {
  private readonly logger = new Logger(PdfReportService.name);

  async generateCarbonBalanceReport(data: ReportData): Promise<Buffer> {
    this.logger.log(`Generating carbon balance PDF for merchant ${data.merchantName}`);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage(PageSizes.A4);
    const { width, height } = page.getSize();

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const obliqueFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const margin = 50;
    const contentWidth = width - margin * 2;
    let y = height - margin;

    // ── Header band ────────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: TEAL });

    page.drawText('TOO FRESH TO WASTE', {
      x: margin,
      y: height - 32,
      size: 11,
      font: boldFont,
      color: rgb(1, 1, 1),
      opacity: 0.7,
    });

    page.drawText('Bilan Carbone · Rapport ESG', {
      x: margin,
      y: height - 58,
      size: 20,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    page.drawText(`Généré le ${data.generatedAt.toLocaleDateString('fr-FR')}`, {
      x: width - margin - 130,
      y: height - 58,
      size: 10,
      font: regularFont,
      color: rgb(1, 1, 1),
      opacity: 0.8,
    });

    y = height - 110;

    // ── Merchant info ──────────────────────────────────────────────────────
    page.drawText('INFORMATIONS MERCHANT', {
      x: margin,
      y,
      size: 8,
      font: boldFont,
      color: MID_GRAY,
    });
    y -= 16;

    page.drawText(data.merchantName, { x: margin, y, size: 14, font: boldFont, color: TEAL });
    y -= 14;
    if (data.establishmentName) {
      page.drawText(data.establishmentName + (data.city ? ` · ${data.city}` : ''), {
        x: margin,
        y,
        size: 10,
        font: regularFont,
        color: MID_GRAY,
      });
      y -= 12;
    }
    page.drawText(
      `Statut ESG: ${data.tier.currentLabel}${data.tier.currentBadge ? ` ${data.tier.currentBadge}` : ''}`,
      {
        x: margin,
        y,
        size: 10,
        font: regularFont,
        color: CORAL,
      },
    );
    y -= 24;

    // ── Divider ────────────────────────────────────────────────────────────
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: LIGHT_GRAY,
    });
    y -= 20;

    // ── Section: Carbon Impact ─────────────────────────────────────────────
    this.drawSectionHeader(page, 'IMPACT CARBONE (SCOPE 3)', margin, y, boldFont, TEAL);
    y -= 20;

    const carbonRows = [
      ['Paniers sauvés', `${data.carbon.bagsSaved} paniers`],
      ['Poids alimentaire rescapé', `${data.carbon.foodWeightKg} kg`],
      ['CO2 évité', `${data.carbon.carbonKgAvoided} kg CO2`],
      ['Eau économisée', `${data.carbon.waterLitersAvoided.toLocaleString('fr-FR')} litres`],
      ['Emballages évités', `${data.carbon.packagingKgSaved} kg plastique`],
      ['Énergie économisée', `${data.carbon.energyKwhSaved} kWh`],
      ['Équivalent voiture', `${data.carbon.carKmEquivalent} km non parcourus`],
      ['Équivalent arbres', `${data.carbon.treesEquivalent} arbres plantés`],
    ];

    for (const [label, value] of carbonRows) {
      page.drawRectangle({
        x: margin,
        y: y - 4,
        width: contentWidth,
        height: 18,
        color: LIGHT_GRAY,
        opacity: 0.5,
      });
      page.drawText(label!, { x: margin + 6, y, size: 10, font: regularFont, color: TEAL });
      page.drawText(value!, {
        x: margin + contentWidth - 6 - value!.length * 5.5,
        y,
        size: 10,
        font: boldFont,
        color: TEAL,
      });
      y -= 20;
    }
    y -= 10;

    // ── Section: Social Impact ─────────────────────────────────────────────
    this.drawSectionHeader(page, 'IMPACT SOCIAL', margin, y, boldFont, TEAL);
    y -= 20;

    const socialRows = [
      ['Repas distribués', `${data.social.mealsDistributed} repas`],
      ['Personnes servies (estimé)', `~${data.social.peopleServedEstimate} bénéficiaires`],
      ['Valeur alimentaire sauvée', `~${data.social.estimatedValueTnd.toFixed(2)} TND`],
    ];

    for (const [label, value] of socialRows) {
      page.drawRectangle({
        x: margin,
        y: y - 4,
        width: contentWidth,
        height: 18,
        color: LIGHT_GRAY,
        opacity: 0.5,
      });
      page.drawText(label!, { x: margin + 6, y, size: 10, font: regularFont, color: TEAL });
      page.drawText(value!, {
        x: margin + contentWidth - 6 - value!.length * 5.5,
        y,
        size: 10,
        font: boldFont,
        color: TEAL,
      });
      y -= 20;
    }
    y -= 10;

    // ── Section: ESG Tier ──────────────────────────────────────────────────
    this.drawSectionHeader(page, 'PROGRESSION ESG', margin, y, boldFont, TEAL);
    y -= 20;

    for (const tier of data.tier.allTiers) {
      const reached = tier.reached;
      const marker = reached ? '✓' : '○';
      const color = reached ? CORAL : MID_GRAY;
      page.drawText(`${marker}  ${tier.label} (${tier.threshold}+ paniers)`, {
        x: margin + 8,
        y,
        size: 10,
        font: reached ? boldFont : regularFont,
        color,
      });
      y -= 16;
    }
    y -= 10;

    // ── Section: Methodology Note ─────────────────────────────────────────
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: LIGHT_GRAY,
    });
    y -= 14;
    page.drawText('MÉTHODOLOGIE', { x: margin, y, size: 8, font: boldFont, color: MID_GRAY });
    y -= 12;
    const note =
      'Calculs basés sur les coefficients ADEME 2023 (Guide BILAN CARBONE®). Facteur moyen: 3.5 kg CO2/kg aliment rescapé.';
    page.drawText(note, {
      x: margin,
      y,
      size: 8,
      font: obliqueFont,
      color: MID_GRAY,
      maxWidth: contentWidth,
    });
    y -= 12;
    page.drawText(
      'Ce rapport est formaté pour un audit ISO 14001. Données certifiées par Too Fresh to Waste.',
      {
        x: margin,
        y,
        size: 8,
        font: obliqueFont,
        color: MID_GRAY,
        maxWidth: contentWidth,
      },
    );

    // ── Footer ─────────────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: 0, width, height: 30, color: TEAL });
    page.drawText('Too Fresh to Waste · www.toofreshto waste.com · ESG Report 2026', {
      x: margin,
      y: 10,
      size: 8,
      font: regularFont,
      color: rgb(1, 1, 1),
      opacity: 0.7,
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  private drawSectionHeader(
    page: ReturnType<PDFDocument['addPage']>,
    title: string,
    x: number,
    y: number,
    font: Awaited<ReturnType<PDFDocument['embedFont']>>,
    color: ReturnType<typeof rgb>,
  ) {
    page.drawRectangle({
      x,
      y: y - 4,
      width: 3,
      height: 16,
      color: CORAL,
    });
    page.drawText(title, { x: x + 10, y, size: 11, font, color });
  }
}
