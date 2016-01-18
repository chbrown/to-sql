#!/usr/bin/env node
import {logger, Level} from 'loge';
import {basename, extname} from 'path';
import * as yargs from 'yargs';
import * as xlsx from 'xlsx';

import {toIdentifier, createDatabase} from '../index';

function main() {
  let argvparser = yargs
    .usage('Usage: excel-sql MySpreadsheet.xlsx')
    .describe({
      database: 'database name to use',
      help: 'print this help message',
      verbose: 'print extra output',
      version: 'print version',
    })
    .alias({
      help: 'h',
      verbose: 'v',
    })
    .boolean(['help', 'verbose', 'version']);

  let argv = argvparser.argv;
  logger.level = argv.verbose ? Level.debug : Level.info;

  let filename = argv._[0];
  if (filename) {
    let ext = extname(filename);
    let base = basename(filename, ext);
    argvparser = argvparser.default({
      database: toIdentifier(base),
    });
  }

  if (argv.help) {
    yargs.showHelp();
  }
  else if (argv.version) {
    console.log(require('./package').version);
  }
  else {
    argvparser = argvparser.demand(1);
    let argv = argvparser.argv;
    let filename = argv._[0];
    let database = argv.database;

    const workbook = xlsx.readFile(filename, {});

    createDatabase(workbook, database, error => {
      if (error) {
        logger.error(`ERROR: ${error.toString()}`);
        process.exit(1);
      }
      logger.info('DONE');
      process.exit(0);
    });
  }
}

if (require.main === module) {
  main();
}
