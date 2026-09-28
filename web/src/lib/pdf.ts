import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from './format';

const NAVY: [number, number, number] = [10, 22, 40];
const GOLD: [number, number, number] = [201, 169, 98];
const INK: [number, number, number] = [45, 55, 72];

export interface PdfSection {
  title: string;
  head: string[];
  body: (string | number)[][];
  /** Column indexes rendered right-aligned (amounts). */
  numericColumns?: number[];
}

export interface PdfReportOptions {
  title: string;
  company: { name: string; legalName?: string; address?: string; email?: string };
  range: { from: string | Date; to: string | Date };
  summary?: { label: string; value: string }[];
  sections: PdfSection[];
  filename: string;
  generatedBy?: string;
}

/** Builds a branded, multi-section PDF report and triggers the download. */
export function buildReportPdf(options: PdfReportOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ---- header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 96, 'F');

  doc.setTextColor(...GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(options.company.name || 'Voxpact Financials', 40, 44);

  doc.setTextColor(235, 240, 248);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(options.title, 40, 63);

  doc.setFontSize(8);
  doc.setTextColor(170, 190, 215);
  doc.text(
    `${formatDate(options.range.from)} — ${formatDate(options.range.to)}`,
    40,
    79,
  );

  const metaRight = [
    `Generated ${formatDate(new Date(), 'dd MMM yyyy, HH:mm')}`,
    options.generatedBy ? `By ${options.generatedBy}` : '',
    options.company.address ?? '',
  ].filter(Boolean);
  metaRight.forEach((line, i) => {
    doc.text(line, pageWidth - 40, 44 + i * 12, { align: 'right' });
  });

  let cursor = 124;

  // ---- summary strip
  if (options.summary?.length) {
    const boxWidth = (pageWidth - 80 - (options.summary.length - 1) * 10) / options.summary.length;
    options.summary.forEach((item, i) => {
      const x = 40 + i * (boxWidth + 10);
      doc.setFillColor(246, 248, 251);
      doc.setDrawColor(222, 230, 240);
      doc.roundedRect(x, cursor, boxWidth, 52, 6, 6, 'FD');
      doc.setFontSize(7.5);
      doc.setTextColor(120, 140, 165);
      doc.text(item.label.toUpperCase(), x + 10, cursor + 18);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...INK);
      doc.text(item.value, x + 10, cursor + 38);
      doc.setFont('helvetica', 'normal');
    });
    cursor += 76;
  }

  // ---- sections
  options.sections.forEach((section) => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(section.title, 40, cursor);
    cursor += 8;

    autoTable(doc, {
      startY: cursor,
      head: [section.head],
      body: section.body.map((row) => row.map((cell) => String(cell))),
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 6, textColor: INK, lineColor: [226, 232, 240] },
      headStyles: { fillColor: NAVY, textColor: [235, 240, 248], fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: [249, 250, 252] },
      columnStyles: (section.numericColumns ?? []).reduce(
        (acc, index) => ({ ...acc, [index]: { halign: 'right' as const } }),
        {} as Record<number, { halign: 'right' }>,
      ),
      margin: { left: 40, right: 40 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursor = (doc as any).lastAutoTable.finalY + 28;

    if (cursor > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      cursor = 60;
    }
  });

  // ---- footers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 232, 240);
    doc.line(40, h - 44, pageWidth - 40, h - 44);
    doc.setFontSize(7.5);
    doc.setTextColor(140, 155, 175);
    doc.text(
      `${options.company.legalName || options.company.name} · ${options.company.email ?? ''}`.trim(),
      40,
      h - 28,
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 40, h - 28, { align: 'right' });
  }

  doc.save(options.filename);
}

export const money = (value: number) => formatCurrency(value);
