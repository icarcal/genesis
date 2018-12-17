import * as fs from 'fs';
import * as YAML from 'yamljs';
import {
  ContainerFileConfig,
  SelectedContainers,
} from '../interfaces';

class FileHandler {
  static getContainerFileConfigs(): ContainerFileConfig {
    const filePath: string = '../data/';
    const fileName: string = 'selected-containers.json';
    const fullPath: string = `${filePath}/${fileName}`;

    return {
      filePath,
      fileName,
      fullPath,
    };
  }

  static loadDockerComposeFile(): Object {
    return YAML.load(process.env.DOCKER_COMPOSE_PATH);
  }

  static getContainersFromFile(): SelectedContainers {
    const containerConfig: ContainerFileConfig = this.getContainerFileConfigs();
    const containersFile: string = fs
      .readdirSync(containerConfig.filePath)
      .find(file => file === containerConfig.fileName);

    if (!containersFile) {
      this.writeOnContainersFile();
    }

    const fileBuffer: Buffer = fs.readFileSync(containerConfig.fullPath);
    const selectedContainers: SelectedContainers = JSON.parse(
      fileBuffer.toString(),
    );

    return selectedContainers;
  }

  static writeOnContainersFile(data: string[] = null): void {
    const containerConfig: ContainerFileConfig = this.getContainerFileConfigs();

    const fileData = {
      containers: data || [],
    };

    fs.writeFileSync(containerConfig.fullPath, JSON.stringify(fileData));
  }
}

export default FileHandler;