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
    .option('-all, --all-containers', 'Select and create all containers')
    .description('Create the selected containers')
    .action((options) => {
    let allContainers = false;
    if (options.all) {
        allContainers = true;
    }
    genesis.up({ allContainers });
});
Commander.parse(process.argv);
