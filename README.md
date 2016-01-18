## excel-sql

[![npm version](https://badge.fury.io/js/excel-sql.svg)](https://www.npmjs.com/package/excel-sql)

Node.js script to read an Excel spreadsheet into a PostgreSQL database.

    $ npm install -g excel-sql

Example:

    $ excel-sql MySpreadsheet.xlsx
    Creating database MySpreadsheet
    Creating table Sheet1
    Inserting 171 rows
    Creating table Sheet2
    Inserting 0 rows

Uses the fabulous [`xlsx`](https://www.npmjs.com/package/xlsx) library for parsing the Excel spreadsheet.

It does some simple regular expression-based type inference, automatically distinguishing between `TEXT`, `INTEGER`, and `REAL`, as well as some formats of `DATE` and `TIME`.


### To-do

* Support more types in the type inference part
* Infer foreign relationships if possible


## License

Copyright 2016 Christopher Brown. [MIT Licensed](http://chbrown.github.io/licenses/MIT/#2016)
