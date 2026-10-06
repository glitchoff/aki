/**
 * Builds small, valid PDFs in memory so the extract pipeline can be exercised
 * end-to-end without shipping binary fixtures.
 */

type Obj = string | Uint8Array;

export function buildPdf(pages: string[], images = false): Uint8Array {
  const objects: Obj[] = [];
  const add = (body: Obj) => {
    objects.push(body);
    return objects.length; // 1-based object number
  };

  // Reserve 1 = catalog, 2 = pages tree.
  add("");
  add("");
  const fontRef = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldRef = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  let imageRef = 0;
  if (images) {
    // 2x2 RGB image.
    const pixels = new Uint8Array([
      255, 0, 0, 0, 255, 0,
      0, 0, 255, 255, 255, 0,
    ]);
    imageRef = add(
      `<< /Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${pixels.length} >>\nstream\n${bytesToLatin1(pixels)}\nendstream`,
    );
  }

  const fontDict = `/F1 ${fontRef} 0 R /F2 ${boldRef} 0 R`;
  const xobjects = images ? ` /XObject << /Im1 ${imageRef} 0 R >>` : "";

  const kids: string[] = [];
  for (const content of pages) {
    const streamObj = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageObj = add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << ${fontDict} >>${xobjects} >> /Contents ${streamObj} 0 R >>`,
    );
    kids.push(`${pageObj} 0 R`);
  }

  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${kids.length} >>`;

  // Serialise, tracking byte offsets for the xref table.
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return latin1ToBytes(pdf);
}

/** Text-drawing operators. `size` is in points; `y` is the PDF baseline. */
export function textOp(text: string, x: number, y: number, size = 12, bold = false): string {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${escapePdf(text)}) Tj ET\n`;
}

/** Places an image as an 200x100pt rectangle with its lower-left at x,y. */
export function imageOp(x: number, y: number): string {
  return `q 200 0 0 100 ${x} ${y} cm /Im1 Do Q\n`;
}

function escapePdf(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function bytesToLatin1(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

function latin1ToBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}