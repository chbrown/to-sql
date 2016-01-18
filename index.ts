import * as async from 'async';
import {logger} from 'loge';
import {Connection} from 'sqlcmd-pg';
import * as xlsx from 'xlsx';

import * as excel from './excel';

/**
Prepare a string for use as a database identifier, like a table or column name.
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

function isEmpty(value: string): boolean {
  return (value === undefined) || /^\s*$/.test(value);
}

const regExpTests = [
  {
    id: 'DATE',
    // DATE: '2016-01-18', '20160118' (but not '2016-01-40', '2016-0118', or '201601-18')
    regExp: /^[12]\d{3}(-?)[01]\d\1[0123]\d$/
  },
  {
    // INTEGER is a subset of some DATE formats, so it must come after
    id: 'INTEGER',
    // INTEGER: '-100', '0', '99' (but not '-')
    regExp: /^-?\d+$/
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

function inferColumnType(values: string[]) {
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

export function createTable(worksheet: xlsx.IWorkSheet,
                            table: string,
                            db: Connection,
                            callback: (error?: Error) => void) {
  const [columns, ...rows] = excel.readTable(worksheet);
  const columnDeclarations = columns.map((columnName, i) => {
    const values = rows.map(row => row[i]);
    const columnType = inferColumnType(values);
    return `${toIdentifier(columnName)} ${columnType}`;
  });

  logger.info(`Creating table ${table}`);
  db.CreateTable(table)
  .add(...columnDeclarations)
  .execute(error => {
    if (error) return callback(error);

    logger.info(`Inserting ${rows.length} rows`);
    async.eachSeries(rows, (row, callback) => {
      let args: any[] = [];
      let values = row.map(value => {
        let argIndex = args.push(value);
        return `$${argIndex}`;
      });
      db.executeSQL(`INSERT INTO ${table} VALUES (${values.join(', ')})`, args, callback);
    }, callback);
  });
}

export function createDatabase(workbook: xlsx.IWorkBook,
                               database: string,
                               callback: (error?: Error) => void) {
  const db = new Connection({host: '127.0.0.1', port: 5432, database});

  // connect db log events to local logger
  db.on('log', (ev) => {
    logger.debug(ev.format, ...ev.args);
  });

  logger.info(`Creating database ${database}`);
  return db.createDatabase(error => {
    if (error) return callback(error);

    // could be async.each, no problem
    async.eachSeries(workbook.SheetNames, (sheetName, callback) => {
      const worksheet = workbook.Sheets[sheetName];
      const table = toIdentifier(sheetName);
      createTable(worksheet, table, db, callback);
    }, callback);
  });
}
