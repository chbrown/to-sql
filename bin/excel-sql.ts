#!/usr/bin/env node
import {logger, Level} from 'loge';
import {basename, extname} from 'path';
import * as yargs from 'yargs';
import * as xlsx from 'xlsx';

import {toIdentifier, createDatabase, describeWorkbook} from '../index';

function exit(error: Error) {
  if (error) {
    logger.error(`ERROR: ${error.toString()}`);
    process.exit(1);
  }
  logger.info('DONE');
  process.exit(0);
}

function main() {
  let argvparser = yargs
    .usage('Usage: excel-sql MySpreadsheet.xlsx')
    .describe({
      database: 'database name to use',
      help: 'print this help message',
      noop: 'only print information about what would be created',
      verbose: 'print extra output',
      version: 'print version',
    })
    .alias({
      help: 'h',
      noop: 'n',
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

    if (argv.noop) {
      return describeWorkbook(workbook, database, exit);
    }

    createDatabase(workbook, database, exit);
  }
}

if (require.main === module) {
  main();
}
