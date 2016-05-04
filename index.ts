import * as async from 'async';
import {basename, extname} from 'path';
import {createReadStream} from 'fs';
import {logger} from 'loge';
import {Connection} from 'sqlcmd-pg';
import * as xlsx from 'xlsx';
import {Parser} from 'sv';

import * as excel from './excel';

interface RawTable {
  name: string;
  data: string[][];
}

function createLocalConnection(database: string): Connection {
  const db = new Connection({host: '127.0.0.1', port: 5432, database});
  // connect db log events to local logger
  db.on('log', (ev) => {
    logger.debug(ev.format, ...ev.args);
  });
  return db;
}

/**
Prepare a string for use as a database identifier, like a table or column name.

It is idempotent (can be run multiple times with no ill effect)
*/
export function toIdentifier(input: string) {
  return input
    // replace # with 'id'
    .replace(/#/g, 'id')
    // replace illegal characters with whitespace
    .replace(/\W+/g, ' ')
    .trim()
    // replace whitespace with underscores
    .replace(/\s+/g, '_');
}

/**
Cut off the basename part of a filepath, without the extension, for use as a database identifier.
*/
export function pathToIdentifier(path: string) {
  let ext = extname(path);
  let base = basename(path, ext);
  return toIdentifier(base);
}

function isEmpty(value: string): boolean {
  return (value === undefined) || /^\s*$/.test(value);
}

const regExpTests = [
  {
    id: 'DATETIME',
    // DATETIME: '2016-01-18T01:45:53Z', '2016-01-18 15:10:20'
    regExp: /^[12]\d{3}(-?)[01]\d\1[0123]\d[T ][012]?\d:[0-5]\d(:[0-5]\d)?Z?$/
  },
  {
    id: 'DATE',
    // DATE: '2016-01-18', '20160118' (but not '2016-01-40', '2016-0118', or '201601-18')
    regExp: /^[12]\d{3}(-?)[01]\d\1[0123]\d$/
  },
  {
    // INTEGER is a subset of some DATE formats, so it must come after
    id: 'INTEGER',
    // INTEGER: '-100', '0', '99' (but not '-' or '9223372036854775808')
    regExp: /^-?\d{1,10}$/
  },
  {
    // BIGINT is a superset of INTEGER, but we want to prefer INTEGER if possible
    id: 'BIGINT',
    // BIGINT: '-1000000000000000000', '0', or '9223372036854775808' (but not '-')
    regExp: /^-?\d{1,19}$/
  },
  {
    // REAL is a subset of INTEGER, so it must come after
    id: 'REAL',
    // REAL: '-100.05', '20', '99.004' (but not '.')
    regExp: /^-?(\d+|\.\d+|\d+\.\d*)$/
  },
  {
    id: 'TIME',
    // TIME: '23:54', '01:45', '4:90' (but not '2016-0118' or '201601-18')
    regExp: /^[012]?\d:[0-5]\d$/
  },
];

/**
@param {string[]} values -
@returns {string} A SQL column definition, e.g., "created_at TIMESTAMP NOT NULL"
*/
function inferColumnType(values: string[]): string {
  const nonEmptyValues = values.filter(value => !isEmpty(value));
  let dataType = 'TEXT';
  if (nonEmptyValues.length > 0) {
    regExpTests.some(({id, regExp}) => {
      const matches = nonEmptyValues.every(value => regExp.test(value));
      if (matches) {
        dataType = id;
      }
      // short-circuit by returning true if we found a match
      return matches;
    });
  }
  return [
    dataType,
    ...((nonEmptyValues.length === values.length) ? ['NOT NULL'] : []),
  ].join(' ');
}

export function createTable(database: string,
                            name: string,
                            data: string[][],
                            callback: (error?: Error) => void) {
  const db = createLocalConnection(database);
  const [columns, ...rows] = data;
  const columnDeclarations = columns.map((column, i) => {
    const columnName = toIdentifier(column || `column_${i}`).toLowerCase();
    const values = rows.map(row => row[i]);
    const columnType = inferColumnType(values);
    return `"${columnName}" ${columnType}`;
  });

  const tableIdentifier = toIdentifier(name).toLowerCase();
  logger.info(`Creating table ${tableIdentifier}`);
  db.CreateTable(tableIdentifier)
  .add(...columnDeclarations)
  .execute(error => {
    if (error) return callback(error);

    logger.info(`Inserting ${rows.length} rows`);
    async.eachSeries(rows, (row, callback) => {
      let args: any[] = [];
      let values = row.map(value => {
        let argIndex = args.push(isEmpty(value) ? null : value);
        return `$${argIndex}`;
      });
      db.executeSQL(`INSERT INTO ${tableIdentifier} VALUES (${values.join(', ')})`, args, callback);
    }, callback);
  });
}

export function createDatabase(name: string, callback: (error?: Error) => void) {
  logger.info(`Creating database ${name}`);
  const db = createLocalConnection(name);
  return db.createDatabaseIfNotExists(callback);
}

/**
Read RawTable objects from Excel spreadsheet (no identifier sanitization)
*/
export function readExcel(filename: string): RawTable[] {
  const workbook = xlsx.readFile(filename, {});
  return workbook.SheetNames.map(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const data = excel.readTable(worksheet);
    return {name: sheetName, data};
  });
}

export function readSV(filename: string, callback: (error: Error, table?: RawTable) => void) {
  let name = pathToIdentifier(filename);
  let objects: {[index: string]: string}[] = [];
  createReadStream(filename).pipe(new Parser())
  .on('error', error => callback(error))
  .on('data', object => objects.push(object))
  .on('end', () => {
    // TODO: customizing sv.Parser so that we can get out string[] rows if we want
    const columns = Object.keys(objects[0]);
    const rows = objects.map(object => {
      return columns.map(column => object[column]);
    });
    callback(null, {name, data: [columns, ...rows]});
  });
}
