"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Ora = require("ora");
const chalk_1 = require("chalk");
const persistMessage = function (message) {
    this.stopAndPersist({
        symbol: '',
        text: message,
    });
    return this;
};
const persistSeparator = function () {
    this.stopAndPersist({
        symbol: '',
        text: '='.repeat(20),
    });
    return this;
};
const persistError = function (message) {
    this.stopAndPersist({
        symbol: chalk_1.default.red('✖'),
        text: message,
    });
    return this;
};
const persistInfo = function (message) {
    this.stopAndPersist({
        symbol: chalk_1.default.blueBright('ℹ'),
        text: message,
    });
    return this;
};
const persistSuccess = function (message) {
    this.stopAndPersist({
        symbol: chalk_1.default.green('✔'),
        text: message,
    });
    return this;
};
exports.default = (opts) => {
    const ora = new Ora(opts);
    ora.persistSeparator = persistSeparator.bind(ora);
    ora.persistMessage = persistMessage.bind(ora);
    ora.persistError = persistError.bind(ora);
    ora.persistInfo = persistInfo.bind(ora);
    ora.persistSuccess = persistSuccess.bind(ora);
    return ora;
};
