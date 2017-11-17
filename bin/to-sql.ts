#!/usr/bin/env node
import {logger, Level} from 'loge';
import * as async from 'async';
import * as optimist from 'optimist';

import {createTable, readExcel, readSV} from '../index';

function exit(error?: Error) {
  if (error) {
    logger.error(`ERROR: ${error.toString()}`);
    process.exit(1);
  }
  logger.info('DONE');
  process.exit(0);
}

function readFiles(excelPaths: string[],
                   svPaths: string[],
                   callback: (error?: Error) => void) {
  async.parallel([
    callback => {
      async.eachSeries(excelPaths, (excelPath, callback) => {
        logger.debug('reading as excel: %s', excelPath);
        const tables = readExcel(excelPath);
        // could be async.each, no problem, but series is easier to debug
        async.eachSeries(tables, ({name, data}, callback) => {
          createTable(name, data, callback);
        }, callback);
      }, callback);
    },
    callback => {
      async.eachSeries(svPaths, (svPath, callback) => {
        logger.debug('reading as sv: %s', svPath);
        readSV(svPath, (error, {name, data}) => {
          if (error) return callback(error);

          createTable(name, data, callback);
        });
      }, callback);
    },
  ], callback);
}

function isExcel(name: string): boolean {
  return /\.xlsx$/.test(name);
}

function main() {
  let argvparser = optimist
  .usage('Usage: to-sql --excel MySpreadsheet.xlsx')
  .options({
    excel: {
      describe: 'excel file to read (one table per worksheet)',
      type: 'string',
    },
    sv: {
      describe: 'sv files to read (one table per file)',
      type: 'array',
    },
    help: {
      alias: 'h',
      describe: 'print this help message',
      type: 'boolean',
    },
    verbose: {
      alias: 'v',
      describe: 'print extra output',
      type: 'boolean',
    },
    version: {
      describe: 'print version',
      type: 'boolean',
    },
  });

  let argv = argvparser.argv;
  logger.level = argv.verbose ? Level.debug : Level.info;

  if (argv.help) {
    argvparser.showHelp();
  }
  else if (argv.version) {
    console.log(require('../package').version);
  }
  else {
    argv = argvparser.argv;
    const excelPaths = [...(argv.excel ? [argv.excel] : []), ...argv._.filter(isExcel)];
    const svPaths = [...(argv.sv || []), ...argv._.filter(arg => !isExcel(arg))];

    return readFiles(excelPaths, svPaths, exit);
  }
}

if (require.main === module) {
  main();
}
