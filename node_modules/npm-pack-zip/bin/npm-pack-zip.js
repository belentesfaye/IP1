#!/usr/bin/env node

'use strict';

const console = require('console');
const {pack} = require('../index');

const argv = require('yargs')
  .usage('Usage: $0 --src [source] --dst [destination]')
  .option('source', {
    alias: 'src',
    default: '',
  })
  .option('destination', {
    alias: 'dst',
    default: '',
  })
  .option('add-version', {
    alias: 'ver',
    default: false,
  })
  .option('info', {
    alias: 'i',
    default: false,
  })
  .option('verbose', {
    alias: 'v',
    default: false,
  })
  .option('static-date-modified', {
    alias: 'sdm',
    default: false,
  })
  .argv;

const source = argv.source;
const destination = argv.destination;
const info = argv.info;
const verbose = argv.verbose;
const addVersion = argv.addVersion;
const staticDateModified = argv.staticDateModified;
pack({source, destination, info, verbose, addVersion, staticDateModified})
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
