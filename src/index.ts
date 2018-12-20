#!/usr/bin/env node

import * as Commander from 'commander';
import Genesis from './Genesis';

const genesis = Genesis();

Commander
  .version(process.env.npm_package_version)

Commander
  .command('configure')
  .description('Select the containers')
  .action(() => {
    genesis.configure();
  })

Commander
  .command('up')
  .option('-a, --all')
  .description('Create the selected containers')
  .action((options) => {
    let allContainers: boolean = false;
    if (options.all) {
      allContainers = true;
    }

    genesis.up({ allContainers });
  });

Commander
  .command('down')
  .option('-c, --container <name>')
  .description('Destroy the selected container')
  .action(() => {
    genesis.down();
  });

Commander.parse(process.argv);

