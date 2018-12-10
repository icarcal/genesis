"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const inquirer = require("inquirer");
const asyncOptions = () => __awaiter(this, void 0, void 0, function* () {
    return inquirer.prompt([
        {
            type: 'checkbox',
            message: 'Select the containers',
            name: 'toppings',
            choices: [
                { value: 'app-service', name: 'App Service' },
                { value: 'media-tool', name: 'Media tool' },
                { value: 'mma-front', name: 'MMA Front' },
                { value: 'mma-service', name: 'MMA Service' },
                { value: 'mongo', name: 'MongoDB' },
                { value: 'mysql', name: 'Mysql' },
                { value: 'ssh', name: 'SSH' },
                { value: 'rabbit', name: 'RabbitMQ' },
                { value: 'user-service', name: 'User Service' },
                { value: 'tool-front-end', name: 'Tool' },
            ],
            validate: (answer) => {
                if (answer.length < 1) {
                    return 'You must choose at least one topping.';
                }
                return true;
            },
        },
    ]);
});
exports.default = asyncOptions;
//# sourceMappingURL=options.js.map