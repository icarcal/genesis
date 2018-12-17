#!/usr/bin/env node

import * as Dotenv from 'dotenv';
import * as Commander from 'commander';
import Genesis from './Genesis';

Dotenv.config({
  path: '../.env',
});

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
  .option('-all, --all-containers', 'Select and create all containers')
  .description('Create the selected containers')
  .action((options) => {
    let allContainers: boolean = false;
    if (options.all) {
      allContainers = true;
    }

    genesis.up({ allContainers });
  });

Commander.parse(process.argv);

