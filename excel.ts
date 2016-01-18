import * as xlsx from 'xlsx';

function createRange(start: number, end: number): number[] {
  let indices: number[] = new Array(end - start);
  for (let index = start; index < end; index++) {
    indices[index - start] = index;
  }
  return indices;
}

export interface CellAddress {
  /** column index */
  c: number;
  /** row index */
  r: number;
}

export interface CellRange {
  /** start address */
  s: CellAddress;
  /** end address */
  e: CellAddress;
}

/*! Extracted from https://github.com/SheetJS/js-xlsx/blob/v0.8.0/xlsx.js#L11461-L11491 */
export function decodeRange(range: string): CellRange {
  var o = {s:{c:0,r:0},e:{c:0,r:0}};
  var idx = 0, i = 0, cc = 0;
  var len = range.length;
  for(idx = 0; i < len; ++i) {
    if((cc=range.charCodeAt(i)-64) < 1 || cc > 26) break;
    idx = 26*idx + cc;
  }
  o.s.c = --idx;

  for(idx = 0; i < len; ++i) {
    if((cc=range.charCodeAt(i)-48) < 0 || cc > 9) break;
    idx = 10*idx + cc;
  }
  o.s.r = --idx;

  if(i === len || range.charCodeAt(++i) === 58) { o.e.c=o.s.c; o.e.r=o.s.r; return o; }

  for(idx = 0; i != len; ++i) {
    if((cc=range.charCodeAt(i)-64) < 1 || cc > 26) break;
    idx = 26*idx + cc;
  }
  o.e.c = --idx;

  for(idx = 0; i != len; ++i) {
    if((cc=range.charCodeAt(i)-48) < 0 || cc > 9) break;
    idx = 10*idx + cc;
  }
  o.e.r = --idx;
  return o;
}

export function encodeRow(row: number) {
  return '' + (row + 1);
}

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/**
encodeCol(0)     => 'A'
encodeCol(1)     => 'B'
encodeCol(25)    => 'Z'
encodeCol(26)    => 'AA'
encodeCol(27)    => 'AB'
encodeCol(27*26) => 'AAA'

It's a weird arithemetic.
*/
export function encodeCol(col: number) {
  var s = '';
  col++;
  do {
    s = alphabet[(col - 1) % 26] + s;
    col = (col - 1) / 26 | 0;
  } while (col > 0);
  return s;
}

function formatCell(cell: xlsx.IWorkSheetCell) {
  if (cell === undefined) {
    return undefined;
  }
  // cell.t can be one of 'b', 'e', 'n', or 's' ('d' is only available if options.cellDates is set)
  if (cell.t == 'b') {
    // Type b is the Boolean type. v is interpreted according to JS truth tables
    return cell.v;
  }
  else if (cell.t == 'e') {
    // Type e is the Error type. v holds the number and w holds the common name
    return cell.w;
  }
  else if (cell.t == 'n') {
    // Type n is the Number type. This includes all forms of data that Excel stores as numbers, such as dates/times and Boolean fields. Excel exclusively uses data that can be fit in an IEEE754 floating point number, just like JS Number, so the v field holds the raw number. The w field holds formatted text.
    return cell.v; // or cell.w ?
  }
  else if (cell.t == 's') {
    // Type s is the String type. v should be explicitly stored as a string to avoid possible confusion.
    return cell.w ? cell.w : cell.v;
  }
}

export function readTable(sheet: xlsx.IWorkSheet) {
  const range = decodeRange(<any>sheet['!ref']);
  const columns = createRange(range.s.c, range.e.c + 1).map(encodeCol);
  return createRange(range.s.r, range.e.r + 1).map(rowIndex => {
    let rowEncoding = encodeRow(rowIndex);
    return columns.map(colEncoding => formatCell(sheet[colEncoding + rowEncoding]));
  });
}
