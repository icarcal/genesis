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
const fs = require("fs");
const os = require("os");
const Inquirer = require("inquirer");
const YAML = require("yamljs");
const dotenv = require("dotenv");
const Ora = require("ora");
const Dockerode = require("dockerode");
const chalk_1 = require("chalk");
const options_1 = require("./helpers/options");
class Genesis {
    static loadDockerCompose() {
        dotenv.config({
            path: '../.env',
        });
        return YAML.load(process.env.DOCKER_COMPOSE_PATH);
    }
    static getContainerFileConfigs() {
        const filePath = '../data/';
        const fileName = 'selected-containers.json';
        const fullPath = `${filePath}/${fileName}`;
        return {
            filePath,
            fileName,
            fullPath,
        };
    }
    static writeOnContainersFile(data = null) {
        const containerConfig = this.getContainerFileConfigs();
        const fileData = {
            containers: data || []
        };
        fs.writeFileSync(containerConfig.fullPath, JSON.stringify(fileData));
    }
    static definePortMappings(service) {
        const HOST_PORT = 0;
        const CONTAINER_PORT = 1;
        const mapPorts = (port) => {
            const splitedPorts = port.split(':');
            const key = `${splitedPorts[CONTAINER_PORT]}/tcp`;
            const hostPort = {
                HostPort: splitedPorts[HOST_PORT]
            };
            return {
                [key]: [
                    hostPort,
                ]
            };
        };
        const reduceToPortMapType = (prev, next) => {
            const key = Object.keys(next)[0];
            prev[key] = next[key];
            return prev;
        };
        const portMaps = service.ports.map(mapPorts)
            .reduce(reduceToPortMapType, {});
        return portMaps;
    }
    static getContainersFromFile() {
        const containerConfig = this.getContainerFileConfigs();
        const containersFile = fs.readdirSync(containerConfig.filePath)
            .find(file => file === containerConfig.fileName);
        if (!containersFile) {
            this.writeOnContainersFile();
        }
        const fileBuffer = fs.readFileSync(containerConfig.fullPath);
        const selectedContainers = JSON.parse(fileBuffer.toString());
        return selectedContainers;
    }
    static createDockerContainer(docker, containerName, service) {
        return __awaiter(this, void 0, void 0, function* () {
            const spinner = Ora({
                text: `Creating ${containerName}`,
                color: 'green',
            }).start();
            const ports = this.definePortMappings(service);
            const containerConfig = {
                name: service.container_name,
                Image: service.image,
                HostConfig: {
                    PortBindings: ports,
                }
            };
            if (service.volumes) {
                containerConfig.HostConfig.Binds = service.volumes;
            }
            try {
                const container = yield docker.createContainer(containerConfig);
                spinner.stopAndPersist({
                    symbol: chalk_1.default.blueBright('ℹ'),
                    text: `Creating ${containerName}`,
                });
                spinner.stopAndPersist({
                    symbol: chalk_1.default.green('✔'),
                    text: `${containerName} created successfully`,
                });
                spinner.start(`Starting ${containerName}`);
                yield container.start();
                spinner.stopAndPersist({
                    symbol: chalk_1.default.blueBright('ℹ'),
                    text: `Starting ${containerName}`,
                });
                spinner.stopAndPersist({
                    symbol: chalk_1.default.green('✔'),
                    text: `${containerName} started successfully`,
                });
                spinner.stop();
            }
            catch (error) {
                spinner.stopAndPersist({
                    symbol: chalk_1.default.red('✖'),
                    text: `${containerName} - ${error.message}`,
                });
                spinner.stop();
            }
        });
    }
    static requestContainers() {
        return __awaiter(this, void 0, void 0, function* () {
            dotenv.config();
            const socketPath = (os.platform() === 'win32')
                ? 'npipe:////./pipe/docker_engine'
                : '/var/run/docker.sock';
            const docker = new Dockerode({ socketPath });
            const selectedContainers = this.getContainersFromFile();
            const choicesWithSelected = options_1.default.map((choice) => {
                const selectedChoice = selectedContainers.containers.find(container => container === choice.value);
                if (selectedChoice) {
                    choice.checked = true;
                }
                return choice;
            });
            const answers = yield Inquirer.prompt([
                {
                    type: 'checkbox',
                    message: 'Select the containers',
                    name: 'containers',
                    choices: choicesWithSelected,
                    validate: (answer) => {
                        if (answer.length < 1) {
                            return 'You must choose at least one topping.';
                        }
                        return true;
                    },
                },
            ]);
            const containersConfig = this.loadDockerCompose();
            const { containers = [] } = answers;
            const { services } = containersConfig;
            this.writeOnContainersFile(containers);
            for (const containerName of containers) {
                const service = services[containerName] || null;
                const spinner = Ora({
                    text: `${containerName} is being created`,
                    color: 'green',
                }).start();
                if (!service) {
                    spinner.stopAndPersist({
                        symbol: chalk_1.default.red('✖'),
                        text: `${containerName} not found`,
                    });
                    spinner.stop();
                    return;
                }
                try {
                    spinner.start(`Cheking if image ${service.image} exists`);
                    yield new Promise((fulfilled, rejected) => {
                        docker.pull(service.image, (err, stream) => {
                            if (err) {
                                rejected(err);
                            }
                            spinner.start(`Downloading image ${service.image}`);
                            const onFinished = (err) => __awaiter(this, void 0, void 0, function* () {
                                if (err) {
                                    spinner.stop();
                                    rejected(err);
                                }
                                spinner.stopAndPersist({
                                    symbol: chalk_1.default.green('✔'),
                                    text: `Image ${service.image} downloaded`,
                                });
                                spinner.stop();
                                try {
                                    yield this.createDockerContainer(docker, containerName, service);
                                    fulfilled();
                                }
                                catch (err) {
                                    rejected(err);
                                }
                            });
                            docker.modem.followProgress(stream, onFinished, () => { });
                        });
                    });
                }
                catch (error) {
                    spinner.stopAndPersist({
                        symbol: chalk_1.default.red('✖'),
                        text: `${containerName} - ${error.message}`,
                    });
                    spinner.stop();
                }
            }
        });
    }
}
exports.default = Genesis;
//# sourceMappingURL=Genesis.js.map