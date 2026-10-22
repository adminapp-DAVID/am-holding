import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';

vi.mock('./supabaseClient', () => ({ supabase: {} }));
const { pdfGirado, paginasPdf } = await import('./girarSoportes');

const pdfDePrueba = async (n) => {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < n; i++) pdf.addPage([300, 400]);
  return new Blob([await pdf.save()], { type: 'application/pdf' });
};
const giros = async (blob) => (await PDFDocument.load(await blob.arrayBuffer())).getPages().map(p => p.getRotation().angle);

describe('girar páginas de un PDF ya subido', () => {
  it('gira solo la página elegida', async () => {
    const original = await pdfDePrueba(3);
    expect(await paginasPdf(original)).toBe(3);
    expect(await giros(await pdfGirado(original, 90, 2))).toEqual([0, 90, 0]);
  });
  it('gira todas, acumula el giro y acepta giro a la izquierda', async () => {
    const una = await pdfGirado(await pdfDePrueba(2), 90, null);
    expect(await giros(una)).toEqual([90, 90]);
    expect(await giros(await pdfGirado(una, -90, 1))).toEqual([0, 90]);
  });
  it('página inexistente', async () => {
    await expect(pdfGirado(await pdfDePrueba(1), 90, 5)).rejects.toThrow(/no existe/);
  });
});
