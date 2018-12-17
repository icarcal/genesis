"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const YAML = require("yamljs");
class FileHandler {
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
    static loadDockerComposeFile() {
        return YAML.load(process.env.DOCKER_COMPOSE_PATH);
    }
    static getContainersFromFile() {
        const containerConfig = this.getContainerFileConfigs();
        const containersFile = fs
            .readdirSync(containerConfig.filePath)
            .find(file => file === containerConfig.fileName);
        if (!containersFile) {
            this.writeOnContainersFile();
        }
        const fileBuffer = fs.readFileSync(containerConfig.fullPath);
        const selectedContainers = JSON.parse(fileBuffer.toString());
        return selectedContainers;
    }
    static writeOnContainersFile(data = null) {
        const containerConfig = this.getContainerFileConfigs();
        const fileData = {
            containers: data || [],
        };
        fs.writeFileSync(containerConfig.fullPath, JSON.stringify(fileData));
    }
}
exports.default = FileHandler;
