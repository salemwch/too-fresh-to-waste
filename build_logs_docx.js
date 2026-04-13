const fs = require('fs');
const path = require('path');

const {
  loadBusinessPlanBlocks,
  buildDocumentXml,
  buildZip,
  toMarkdown,
  CONTENT_TYPES_XML,
  ROOT_RELS_XML,
  DOC_RELS_XML,
  STYLES_XML,
  NUMBERING_XML,
} = require('./build_business_plan_v2.js');

const LOGS_PATH = path.join(__dirname, 'logs.md');
const TEMP_LOGS_PATH = path.join(__dirname, 'logs.__tables__.md');
const STAMP = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const DOCX_PATH = path.join(__dirname, `Too_Fresh_To_Waste_Logs_${STAMP}.docx`);
const MD_PATH = path.join(__dirname, `Too_Fresh_To_Waste_Logs_${STAMP}.md`);

function normalizeLine(line) {
  return line.replace(/\u00a0/g, ' ').replace(/\s+$/g, '');
}

function isBlank(line) {
  return !line || !line.trim();
}

function isLikelySentence(line) {
  const text = line.trim();
  if (!text) return false;
  if (text.length > 90) return true;
  return (
    /[.!?]\s*$/.test(text) || /\b(and|or|with|from|while|because|through|that|which)\b/i.test(text)
  );
}

function isLikelyTableValue(line) {
  const text = line.trim();
  if (!text) return false;
  if (text.length > 80) return false;
  if (/^[•·▪]/.test(text)) return false;
  if (/^(I{1,3}|IV|V|VI{0,3}|IX|X|XI{0,3}|XII|XIII)\./.test(text)) return false;
  if (/^[A-Z]\.\s+/.test(text)) return false;
  if (/^\d+\.\s+/.test(text)) return false;
  return !isLikelySentence(text);
}

function makeTableBlock(colCount, lines) {
  return [`[TBL:${colCount}]`, ...lines, '[/TBL]'];
}

function consumeFixedTable(lines, start, colCount, stopMatchers = []) {
  const cells = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) break;
    if (stopMatchers.some(m => m.test(line))) break;
    if (!isLikelyTableValue(line)) break;
    cells.push(line.trim());
    i++;
  }

  if (cells.length >= colCount * 2) {
    return { next: i, out: makeTableBlock(colCount, cells) };
  }

  return null;
}

function preprocessTables(src) {
  const lines = src.split(/\r?\n/).map(normalizeLine);
  const out = [];

  for (let i = 0; i < lines.length; ) {
    const line = lines[i].trim();

    if (line === 'Promoteur Principal' && lines[i + 1]?.trim() === 'Co-Fondateur') {
      const cells = [];
      let j = i;
      while (j < lines.length && !isBlank(lines[j])) {
        cells.push(lines[j].trim());
        j++;
      }
      out.push(
        ...makeTableBlock(3, [
          'Attribut',
          'Promoteur Principal',
          'Co-Fondateur',
          ...cells.slice(2),
        ]),
      );
      i = j;
      continue;
    }

    if (
      line === 'COÛT' &&
      lines[i + 1]?.trim() === 'DT' &&
      lines[i + 2]?.trim() === '%' &&
      lines[i + 3]?.trim() === 'FINANCEMENT'
    ) {
      const cells = [];
      let j = i;
      while (j < lines.length && !isBlank(lines[j])) {
        cells.push(lines[j].trim());
        j++;
      }
      out.push(...makeTableBlock(6, cells));
      i = j;
      continue;
    }

    const next2 = lines.slice(i, i + 2).map(x => x.trim());
    const next3 = lines.slice(i, i + 3).map(x => x.trim());
    const next4 = lines.slice(i, i + 4).map(x => x.trim());

    if (next2[0] === 'Attribut' && next2[1] === 'Valeur') {
      const result = consumeFixedTable(lines, i, 2, [
        /^[A-Z]\.\s+/,
        /^(I{1,3}|IV|V|VI{0,3}|IX|X|XI{0,3}|XII|XIII)\./,
      ]);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next2[0] === 'KPI' && next2[1] === 'Year 1') {
      const result = consumeFixedTable(lines, i, 4);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next2[0] === 'Regulation' && next2[1] === 'Relevance') {
      const result = consumeFixedTable(lines, i, 2);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next2[0] === 'Domain' && next2[1] === 'Level') {
      const result = consumeFixedTable(lines, i, 2);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next2[0] === 'Détail' || (next2[0] === 'Attribut' && next2[1] === 'Détail')) {
      const result = consumeFixedTable(lines, i, 2);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (
      next4[0] === '#' &&
      next4[1] === 'Rôle' &&
      next4[2] === 'Genre' &&
      next4[3] === 'Responsabilité'
    ) {
      const result = consumeFixedTable(lines, i, 4);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next3[0] === 'Factor' && next3[1] === 'Analysis') {
      const result = consumeFixedTable(lines, i, 2);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next3[0] === 'Force' && next3[1] === 'Level' && next3[2] === 'Analysis') {
      const result = consumeFixedTable(lines, i, 3);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next3[0] === 'Segment' && next3[1] === 'Rationale' && next3[2] === 'Acquisition Channel') {
      const result = consumeFixedTable(lines, i, 3);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next3[0] === 'Segment' && next3[1] === 'Rationale' && next3[2] === 'Friction Level') {
      const result = consumeFixedTable(lines, i, 3);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (
      next4[0] === 'Too Fresh To Waste' &&
      next4[1] === 'Save the Plate' &&
      next4[2] === 'Too Good To Go'
    ) {
      const cells = ['Criteria', ...next4];
      let j = i + 4;
      while (j < lines.length && !isBlank(lines[j])) {
        if (!isLikelyTableValue(lines[j])) break;
        cells.push(lines[j].trim());
        j++;
      }
      out.push(...makeTableBlock(4, cells));
      i = j;
      continue;
    }

    if (next2[0] === 'FORCES (Strengths)' && next2[1] === 'FAIBLESSES (Weaknesses)') {
      const result = consumeFixedTable(lines, i, 2);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next2[0] === 'OPPORTUNITÉS (Opportunities)' && next2[1] === 'MENACES (Threats)') {
      const result = consumeFixedTable(lines, i, 2);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next4[0] === 'Channel' && next4[1] === 'Platform' && next4[2] === 'Day 1') {
      const result = consumeFixedTable(lines, i, 3);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next3[0] === 'Channel' && next3[1] === 'Target Audience' && next3[2] === 'Activation') {
      const result = consumeFixedTable(lines, i, 3);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next3[0] === 'Metric' && next3[1] === 'Year 1' && next3[2] === 'Year 2') {
      const result = consumeFixedTable(lines, i, 4);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next3[0] === 'Rôle' && next3[1] === 'Effectif' && next3[2] === 'Statut') {
      const result = consumeFixedTable(lines, i, 3);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next3[0] === 'Composante' && next3[1] === 'Montant (DT)' && next3[2] === 'Taux %') {
      const result = consumeFixedTable(lines, i, 4);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next3[0] === 'Source' && next3[1] === 'Montant (DT)' && next3[2] === 'Taux %') {
      const result = consumeFixedTable(lines, i, 3);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next2[0] === 'Hypothèse' && next2[1] === 'Valeur') {
      const result = consumeFixedTable(lines, i, 2);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next3[0] === 'Flux de Revenus' && next3[1] === 'Calcul' && next3[2] === 'Montant (DT)') {
      const result = consumeFixedTable(lines, i, 3);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next4[0] === 'Année 1' && next4[1] === 'Année 2' && next4[2] === 'Année 3') {
      const cells = ['KPI', ...next4];
      let j = i + 4;
      while (j < lines.length && !isBlank(lines[j])) {
        if (!isLikelyTableValue(lines[j])) break;
        cells.push(lines[j].trim());
        j++;
      }
      out.push(...makeTableBlock(4, cells));
      i = j;
      continue;
    }

    if (
      next4[0] === 'Actif' &&
      next4[1] === 'Coût (DT)' &&
      next4[2] === 'Taux' &&
      next4[3] === 'Année 1'
    ) {
      const result = consumeFixedTable(lines, i, 6);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (
      next4[0] === 'Catégorie' &&
      next4[1] === 'Année 1 (DT)' &&
      next4[2] === 'Année 2 (DT)' &&
      next4[3] === 'Année 3 (DT)'
    ) {
      const result = consumeFixedTable(lines, i, 4);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next2[0] === 'Pessimiste' && next2[1] === 'Base') {
      const cells = ['Metric', ...next2];
      let j = i + 2;
      while (j < lines.length && !isBlank(lines[j])) {
        if (!isLikelyTableValue(lines[j])) break;
        cells.push(lines[j].trim());
        j++;
      }
      out.push(...makeTableBlock(3, cells));
      i = j;
      continue;
    }

    if (next3[0] === 'Année 1 (DT)' && next3[1] === 'Année 2 (DT)' && next3[2] === 'Année 3 (DT)') {
      const cells = ['Metric', ...next3];
      let j = i + 3;
      while (j < lines.length && !isBlank(lines[j])) {
        if (!isLikelyTableValue(lines[j])) break;
        cells.push(lines[j].trim());
        j++;
      }
      out.push(...makeTableBlock(4, cells));
      i = j;
      continue;
    }

    if (next2[0] === 'Année' && next2[1] === 'Cash-flow Net (DT)') {
      const result = consumeFixedTable(lines, i, 3);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (
      next4[0] === 'Ratio' &&
      next4[1] === 'Année 1' &&
      next4[2] === 'Année 2' &&
      next4[3] === 'Année 3'
    ) {
      const result = consumeFixedTable(lines, i, 4);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (next3[0] === 'Phase' && next3[1] === 'Période' && next3[2] === 'Objectifs Clés') {
      const result = consumeFixedTable(lines, i, 3);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    if (
      next4[0] === 'Risque' &&
      next4[1] === 'Prob.' &&
      next4[2] === 'Impact' &&
      next4[3] === 'Stratégie de Mitigation'
    ) {
      const result = consumeFixedTable(lines, i, 4);
      if (result) {
        out.push(...result.out);
        i = result.next;
        continue;
      }
    }

    out.push(lines[i]);
    i++;
  }

  return `${out.join('\n')}\n`;
}

function main() {
  const source = fs.readFileSync(LOGS_PATH, 'utf8');
  const transformed = preprocessTables(source);
  fs.writeFileSync(TEMP_LOGS_PATH, transformed, 'utf8');

  const blocks = loadBusinessPlanBlocks(TEMP_LOGS_PATH);
  const md = toMarkdown(blocks);
  fs.writeFileSync(MD_PATH, md, 'utf8');

  const documentXml = buildDocumentXml(blocks);
  const files = [
    { name: '[Content_Types].xml', data: CONTENT_TYPES_XML },
    { name: '_rels/.rels', data: ROOT_RELS_XML },
    { name: 'word/_rels/document.xml.rels', data: DOC_RELS_XML },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/styles.xml', data: STYLES_XML },
    { name: 'word/numbering.xml', data: NUMBERING_XML },
  ];

  const zipBuf = buildZip(files);
  fs.writeFileSync(DOCX_PATH, zipBuf);

  console.log('TEMP:', TEMP_LOGS_PATH);
  console.log('MD  :', MD_PATH, `(${md.length} chars)`);
  console.log('DOCX:', DOCX_PATH, `(${zipBuf.length} bytes, ${blocks.length} blocks)`);
}

main();
