import * as fs from 'fs';
import * as YAML from 'yamljs';
import {
  ContainerFileConfig,
  SelectedContainers,
} from '../interfaces';

class FileHandler {
  static getContainerFileConfigs(): ContainerFileConfig {
    const filePath: string = `${__dirname}/../../data`;
    const fileName: string = 'selected-containers.json';
    const fullPath: string = `${filePath}/${fileName}`;

    return {
      filePath,
      fileName,
      fullPath,
    };
  }

  static loadDockerComposeFile(path: string): Object {
    const defaulFileName = 'docker-compose.yml';

    try {
      return YAML.load(`${path}/${defaulFileName}`);
    } catch(err) {
      return null;
    }
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
