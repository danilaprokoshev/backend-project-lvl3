#!/usr/bin/env node
import { Command } from 'commander';
import pageLoader from '../src/index.js';

const program = new Command();

program
  .name('page-loader')
  .version('1.0.0')
  .description('Page loader utility')
  .argument('<url>', 'url to load')
  .option('-o, --output [dir]', 'output dir')
  .action((url, options) => {
    pageLoader(url, options.output)
      .then((result) => console.log(result));
  })
  .parse(process.argv);
