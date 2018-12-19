#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Dotenv = require("dotenv");
const Commander = require("commander");
const Genesis_1 = require("./Genesis");
Dotenv.config({
    path: '../.env',
});
const genesis = Genesis_1.default();
Commander
    .version(process.env.npm_package_version);
Commander
    .command('configure')
    .description('Select the containers')
    .action(() => {
    genesis.configure();
});
Commander
    .command('up')
    .option('-a, --all')
    .description('Create the selected containers')
    .action((options) => {
    let allContainers = false;
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
