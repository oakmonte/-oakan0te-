/** Whether an uploaded file is plausibly a CSV, judged from its first bytes.
 *
 *  The picker's `accept=".csv"` is only a hint: Android's chooser still offers
 *  the photo gallery, and a JPEG then reached the importer and failed deep in
 *  the CSV parser with a message no seller could read (reported 2026-10-08).
 *  Text has no NUL bytes and almost no control characters; images, PDFs and
 *  spreadsheets (.xlsx is a zip) are full of both. */
export function csvProblem(head: Uint8Array): string | null {
  const starts = (...sig: number[]) => sig.every((b, i) => head[i] === b);
  if (starts(0xff, 0xd8, 0xff) || starts(0x89, 0x50, 0x4e, 0x47) || starts(0x47, 0x49, 0x46)) {
    return "That's a photo, not a CSV. Export your products as a .csv file and upload that.";
  }
  if (starts(0x50, 0x4b, 0x03, 0x04)) {
    return "That looks like an Excel file. Save it as CSV (File → Save as → .csv) and upload that.";
  }
  if (starts(0x25, 0x50, 0x44, 0x46)) {
    return "That's a PDF, not a CSV. Export your products as a .csv file and upload that.";
  }
  let control = 0;
  for (const b of head) {
    if (b === 0)
      return "That file isn't a CSV. Export your products as a .csv file and upload that.";
    if (b < 0x09 || (b > 0x0d && b < 0x20)) control++;
  }
  if (head.length > 0 && control / head.length > 0.02) {
    return "That file isn't a CSV. Export your products as a .csv file and upload that.";
  }
  return null;
}

export async function csvFileProblem(file: Blob): Promise<string | null> {
  return csvProblem(new Uint8Array(await file.slice(0, 1024).arrayBuffer()));
}
