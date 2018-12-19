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
        this.path = process.cwd();
    }
    getContainersFromCompose() {
        const compose = FileHandler_1.default.loadDockerComposeFile(this.path);
        if (!compose) {
            return null;
        }
        const { services } = compose;
        const containers = Object.keys(services);
        return containers;
    }
    inquire() {
        return __awaiter(this, void 0, void 0, function* () {
            const choices = this.getContainersFromCompose();
            if (!choices) {
                return null;
            }
            const selectedContainers = FileHandler_1.default.getContainersFromFile();
            const choicesWithSelected = choices.map((choice) => {
                const choiceObject = {
                    value: choice,
                    name: choice,
                };
                if (selectedContainers.containers.includes(choice)) {
                    choiceObject.checked = true;
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
                const fullPathVolumes = service.volumes.map((volume) => {
                    return volume.replace(/.\//, `${this.path}/`);
                });
                containerConfig.HostConfig.Binds = fullPathVolumes;
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
                const containerStatusCheck = ['created', 'exited'];
                if (containerStatusCheck.includes(existingContainer.State)) {
                    yield this.startDockerContainer(containerName);
                }
                return true;
            }
            return false;
        });
    }
    up({ allContainers = false }) {
        return __awaiter(this, void 0, void 0, function* () {
            const containersConfig = FileHandler_1.default.loadDockerComposeFile(this.path);
            if (!containersConfig) {
                return this.spinner.persistError('No docker-compose.yml found in this directory');
            }
            const { services } = containersConfig;
            const containers = (allContainers)
                ? Object.keys(services)
                : FileHandler_1.default.getContainersFromFile().containers;
            const lastContainer = containers.slice(-1)[0];
            FileHandler_1.default.writeOnContainersFile(containers);
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
            if (!answers) {
                return this.spinner.persistError('No docker-compose.yml found in this directory');
            }
            const { containers = [] } = answers;
            FileHandler_1.default.writeOnContainersFile(containers);
            this.spinner.persistInfo(`Run the command ${chalk_1.default.yellow('genesis up')} and get your containers running`);
        });
    }
    down() {
        return __awaiter(this, void 0, void 0, function* () {
            const { containers } = FileHandler_1.default.getContainersFromFile();
            this.existingContainers = yield this.docker.listContainers({
                all: true,
            });
            const containersToBeDestroyed = this.existingContainers.filter((existingContainer) => {
                const filteredContainers = existingContainer.Names.filter((name) => {
                    return containers.includes(name.replace(/\//g, ''));
                });
                if (filteredContainers.length > 0) {
                    return true;
                }
                return false;
            });
            const lastContainer = containersToBeDestroyed.slice(-1)[0];
            for (const container of containersToBeDestroyed) {
                const containerToDestroy = yield this.docker.getContainer(container.Id);
                this.spinner.start(`Stopping container ${container.Names[0]}`);
                yield containerToDestroy.stop();
                this.spinner.persistSuccess(`Container ${container.Names[0]} stopped`);
                this.spinner.start(`Removing container ${container.Names[0]}`);
                yield containerToDestroy.remove();
                this.spinner.persistSuccess(`Container ${container.Names[0]} removed`);
                if (lastContainer.Id !== container.Id) {
                    this.spinner.persistSeparator();
                }
            }
        });
    }
}
exports.default = () => new Genesis();
