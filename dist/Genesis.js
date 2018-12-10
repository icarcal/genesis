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
const Inquirer = require("inquirer");
const options_1 = require("./helpers/options");
class Genesis {
    static requestContainers() {
        return __awaiter(this, void 0, void 0, function* () {
            const answers = yield Inquirer.prompt([
                {
                    type: 'checkbox',
                    message: 'Select the containers',
                    name: 'containers',
                    choices: options_1.default,
                    validate: (answer) => {
                        if (answer.length < 1) {
                            return 'You must choose at least one topping.';
                        }
                        return true;
                    },
                },
            ]);
            const { containers } = answers;
            containers.forEach((container) => {
                console.log(container);
            });
        });
    }
}
exports.default = Genesis;
//# sourceMappingURL=Genesis.js.map