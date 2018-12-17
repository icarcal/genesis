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
const os = require("os");
const Inquirer = require("inquirer");
const Dockerode = require("dockerode");
const chalk_1 = require("chalk");
const options_1 = require("./helpers/options");
const FileHandler_1 = require("./modules/FileHandler");
const ConsoleWriter_1 = require("./modules/ConsoleWriter");
class Genesis {
    constructor() {
        const socketPath = os.platform() === 'win32'
            ? 'npipe:////./pipe/docker_engine'
            : '/var/run/docker.sock';
        this.docker = new Dockerode({ socketPath });
        this.spinner = ConsoleWriter_1.default({
            color: 'green',
        });
    }
    inquire() {
        return __awaiter(this, void 0, void 0, function* () {
            const selectedContainers = FileHandler_1.default.getContainersFromFile();
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
                    validate: answer => {
                        if (answer.length < 1) {
                            return 'You must choose at least one topping.';
                        }
                        return true;
                    },
                },
            ]);
            return answers;
        });
    }
    definePortMappings(service) {
        const HOST_PORT = 0;
        const CONTAINER_PORT = 1;
        const mapPorts = (port) => {
            const splitedPorts = port.split(':');
            const key = `${splitedPorts[CONTAINER_PORT]}/tcp`;
            const hostPort = {
                HostPort: splitedPorts[HOST_PORT],
            };
            return {
                [key]: [hostPort],
            };
        };
        const reduceToPortMapType = (prev, next) => {
            const key = Object.keys(next)[0];
            prev[key] = next[key];
            return prev;
        };
        const portMaps = service.ports
            .map(mapPorts)
            .reduce(reduceToPortMapType, {});
        return portMaps;
    }
    createDockerContainer(containerName, service) {
        return __awaiter(this, void 0, void 0, function* () {
            this.spinner.start(`Creating ${containerName}`);
            const ports = this.definePortMappings(service);
            const containerConfig = {
                name: service.container_name,
                Image: service.image,
                HostConfig: {
                    PortBindings: ports,
                },
            };
            if (service.volumes) {
                containerConfig.HostConfig.Binds = service.volumes;
            }
            try {
                const container = yield this.docker.createContainer(containerConfig);
                this.spinner.persistInfo(`Creating ${containerName}`);
                this.spinner.persistSuccess(`${containerName} created successfully`);
                this.spinner.start(`Starting ${containerName}`);
                yield container.start();
                this.spinner.persistInfo(`Starting ${containerName}`);
                this.spinner.persistSuccess(`${containerName} started successfully`);
                this.spinner.stop();
            }
            catch (error) {
                this.spinner.persistError(`${containerName} - ${error.message}`);
                this.spinner.stop();
            }
        });
    }
    startDockerContainer(containerName) {
        return __awaiter(this, void 0, void 0, function* () {
            this.spinner.start(`Starting ${containerName}`);
            const container = this.docker.getContainer(containerName);
            yield container.start();
            this.spinner.persistSuccess(`${containerName} started successfully`);
        });
    }
    pullDockerImage(imageName) {
        return __awaiter(this, void 0, void 0, function* () {
            this.spinner.start(`Checking if image ${imageName} exists`);
            const existingImages = yield this.getExistingImages();
            const splittedImageName = imageName.split(':');
            const fullImageName = splittedImageName.length > 1
                ? imageName
                : `${imageName}:latest`;
            const existingImage = existingImages.find(image => {
                const tags = image.RepoTags || [];
                return tags.includes(fullImageName);
            });
            if (existingImage) {
                this.spinner.stop();
                return;
            }
            this.spinner.persistInfo(`${imageName} not found`);
            this.spinner.start(`Downloading ${imageName}`);
            yield new Promise((resolve, reject) => {
                this.docker.pull(imageName, {}, (error, stream) => {
                    if (error) {
                        reject();
                    }
                    const onFinishPullingImage = (error, output) => {
                        if (error) {
                            reject(error);
                        }
                        this.spinner.persistSuccess(`${imageName} downloaded successesfully`);
                        resolve();
                    };
                    this.docker.modem.followProgress(stream, onFinishPullingImage, () => { });
                });
            });
        });
    }
    getExistingContainers() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.existingContainers) {
                return this.existingContainers;
            }
            this.existingContainers = yield this.docker.listContainers({
                all: true,
            });
            return this.existingContainers;
        });
    }
    getExistingImages() {
        return __awaiter(this, void 0, void 0, function* () {
            this.existingImages = yield this.docker.listImages({
                all: true,
            });
            return this.existingImages;
        });
    }
    checkForExistingContainer(containerName) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingContainers = yield this.getExistingContainers();
            const existingContainer = existingContainers.find(container => {
                const foundContainer = container.Names.find(name => name.replace(/\//g, '') === containerName);
                return foundContainer ? true : false;
            });
            if (existingContainer) {
                this.spinner.persistError(`${containerName} already exists`);
                if (existingContainer.State === 'created') {
                    this.startDockerContainer(containerName);
                }
                return true;
            }
            return false;
        });
    }
    up({ allContainers = false }) {
        return __awaiter(this, void 0, void 0, function* () {
            const containersConfig = FileHandler_1.default.loadDockerComposeFile();
            const { services } = containersConfig;
            const containers = (allContainers)
                ? Object.keys(services)
                : FileHandler_1.default.getContainersFromFile().containers;
            const lastContainer = containers.slice(-1)[0];
            for (const containerName of containers) {
                const service = services[containerName] || null;
                this.spinner.start(`${containerName} is being created`);
                if (!service) {
                    this.spinner.persistError(`${containerName} not found`);
                    this.spinner.stop();
                    continue;
                }
                const containerExists = yield this.checkForExistingContainer(containerName);
                if (containerExists) {
                    if (lastContainer !== containerName) {
                        this.spinner.persistSeparator();
                    }
                    continue;
                }
                ;
                try {
                    yield this.pullDockerImage(service.image);
                    yield this.createDockerContainer(containerName, service);
                    if (lastContainer !== containerName) {
                        this.spinner.persistSeparator();
                    }
                }
                catch (error) {
                    this.spinner.persistError(`${containerName} - ${error.message}`);
                    if (lastContainer !== containerName) {
                        this.spinner.persistSeparator();
                    }
                    this.spinner.stop();
                }
            }
        });
    }
    configure() {
        return __awaiter(this, void 0, void 0, function* () {
            const answers = yield this.inquire();
            const { containers = [] } = answers;
            FileHandler_1.default.writeOnContainersFile(containers);
            this.spinner.persistInfo(`Run the command ${chalk_1.default.yellow('genesis up')} and get your containers running`);
        });
    }
    all() {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
}
exports.default = () => new Genesis();
