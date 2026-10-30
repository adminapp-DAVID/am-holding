import { describe, it, expect } from 'vitest';
import { esLinkDrive, vistaPreviaDrive } from './drive';

describe('drive', () => {
  it('archivo de Drive → /preview', () => {
    expect(vistaPreviaDrive('https://drive.google.com/file/d/1lQjHG1DmUCv4q_U7FkhdrAsU0int2Nf1/view?usp=sharing'))
      .toEqual({ tipo: 'archivo', id: '1lQjHG1DmUCv4q_U7FkhdrAsU0int2Nf1', vista: 'https://drive.google.com/file/d/1lQjHG1DmUCv4q_U7FkhdrAsU0int2Nf1/preview' });
  });
  it('open?id= y documentos de Google', () => {
    expect(vistaPreviaDrive('https://drive.google.com/open?id=1NcWH41s_BtsLiUejml_XMorhIOQULETq').vista)
      .toBe('https://drive.google.com/file/d/1NcWH41s_BtsLiUejml_XMorhIOQULETq/preview');
    expect(vistaPreviaDrive('https://docs.google.com/spreadsheets/d/1PP9yVEvjCrM4SQW_22e2s55CLB89yZ-f/edit#gid=0').vista)
      .toBe('https://docs.google.com/spreadsheets/d/1PP9yVEvjCrM4SQW_22e2s55CLB89yZ-f/preview');
  });
  it('carpeta → vista embebida', () => {
    expect(vistaPreviaDrive('https://drive.google.com/drive/folders/1TcZt6dTqu72J5v0aekstzpXQ8Dnn40W8?usp=sharing'))
      .toEqual({ tipo: 'carpeta', id: '1TcZt6dTqu72J5v0aekstzpXQ8Dnn40W8', vista: 'https://drive.google.com/embeddedfolderview?id=1TcZt6dTqu72J5v0aekstzpXQ8Dnn40W8#list' });
  });
  it('otros links no se incrustan', () => {
    expect(esLinkDrive('https://dropbox.com/x')).toBe(false);
    expect(vistaPreviaDrive('https://dropbox.com/x')).toBeNull();
    expect(vistaPreviaDrive('')).toBeNull();
  });
});
