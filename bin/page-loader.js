#!/usr/bin/env DEBUG=*,-follow-redirects node
import { Command } from 'commander';
import pageLoader from '../src/index.js';

const program = new Command();

const configureErrorOutput = (error) => {
  if (error.isAxiosError) {
    return `error while loading resource ${error.config.url} with code: ${error.code}`;
  }
  return '';
};

program
  .name('page-loader')
  .version('1.0.0')
  .description('Page loader utility')
  .argument('<url>', 'url to load')
  .option('-o, --output [dir]', 'output dir')
  .action((url, options) => {
    pageLoader(url, options.output)
      .then((result) => {
        console.log(`Page was successfully downloaded into '${result}'`);
        process.exit();
      })
      .catch((error) => {
        console.error('[ERR]', configureErrorOutput(error), '\n', error);
        process.exit(1);
      });
  })
  .parse(process.argv);
