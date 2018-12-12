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
const YAML = require("yamljs");
const node_docker_api_1 = require("node-docker-api");
const options_1 = require("./helpers/options");
class Genesis {
    static loadDockerCompose() {
        return YAML.load(process.env.DOCKER_COMPOSE_PATH);
    }
    static requestContainers() {
        return __awaiter(this, void 0, void 0, function* () {
            const docker = new node_docker_api_1.Docker({ socketPath: '/var/run/docker.sock' });
            // TODO: READ FROM ALREADY SELECTED
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
            const containersConfig = this.loadDockerCompose();
            const { containers } = answers;
            const { services } = containersConfig;
            // TODO: UPDATE ALREADY SELECTED
            containers.forEach((container) => {
                const service = Object.keys(services).find(service => service === container);
                if (service) {
                    console.log(`${container} not found`);
                    return;
                }
                console.log(`${container} is being created`);
            });
        });
    }
}
exports.default = Genesis;
//# sourceMappingURL=Genesis.js.map