import * as os from 'os';
import * as Inquirer from 'inquirer';
import * as Dockerode from 'dockerode';
import chalk from 'chalk';
import choices from './helpers/options';

import FileHandler from './modules/FileHandler';
import ConsoleWritter from './modules/ConsoleWriter';
import {
  ContainerAnswers,
  SelectedContainers,
  Service,
} from './interfaces';

class Genesis {
  docker: Dockerode;
  spinner: any;
  existingImages: Dockerode.ImageInfo[];
  existingContainers: Dockerode.ContainerInfo[];

  constructor() {
    const socketPath =
      os.platform() === 'win32'
        ? 'npipe:////./pipe/docker_engine'
        : '/var/run/docker.sock';

    this.docker = new Dockerode({ socketPath });
    this.spinner = ConsoleWritter({
      color: 'green',
    });
  }

  async inquire(): Promise<ContainerAnswers> {
    const selectedContainers: SelectedContainers = FileHandler.getContainersFromFile();
    const choicesWithSelected: Object[] = choices.map(
      (choice: Inquirer.Answers) => {
        const selectedChoice: String = selectedContainers.containers.find(
          container => container === choice.value,
        );

        if (selectedChoice) {
          choice.checked = true;
        }

        return choice;
      },
    );

    const answers: ContainerAnswers = await Inquirer.prompt([
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

    return answers
  }

  definePortMappings(service: Service): Dockerode.PortMap {
    const HOST_PORT: number = 0;
    const CONTAINER_PORT: number = 1;

    const mapPorts = (port: string) => {
      const splitedPorts: string[] = port.split(':');
      const key: string = `${splitedPorts[CONTAINER_PORT]}/tcp`;
      const hostPort: Dockerode.PortBinding = {
        HostPort: splitedPorts[HOST_PORT],
      };

      return {
        [key]: [hostPort],
      };
    };

    const reduceToPortMapType = (prev: Object, next: Object) => {
      const key: string = Object.keys(next)[0];
      prev[key] = next[key];
      return prev;
    };

    const portMaps: Dockerode.PortMap = service.ports
      .map(mapPorts)
      .reduce(reduceToPortMapType, {});

    return portMaps;
  }

  async createDockerContainer(
    containerName: string,
    service: Service,
  ) {
    this.spinner.start(`Creating ${containerName}`);

    const ports: Dockerode.PortMap = this.definePortMappings(service);
    const containerConfig: Dockerode.ContainerCreateOptions = {
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
      const container: Dockerode.Container = await this.docker.createContainer(
        containerConfig,
      );

      this.spinner.persistInfo(`Creating ${containerName}`);
      this.spinner.persistSuccess(`${containerName} created successfully`);
      this.spinner.start(`Starting ${containerName}`);

      await container.start();

      this.spinner.persistInfo(`Starting ${containerName}`);
      this.spinner.persistSuccess(`${containerName} started successfully`);

      this.spinner.stop();
    } catch (error) {
      this.spinner.persistError(`${containerName} - ${error.message}`);
      this.spinner.stop();
    }
  }

  async startDockerContainer(containerName: string) {
    this.spinner.start(`Starting ${containerName}`);

    const container: Dockerode.Container = this.docker.getContainer(containerName);

    await container.start();

    this.spinner.persistSuccess(`${containerName} started successfully`);
  }

  async pullDockerImage(imageName: string): Promise<void> {
    this.spinner.start(`Checking if image ${imageName} exists`);

    const existingImages: Dockerode.ImageInfo[] = await this.getExistingImages();

    const splittedImageName: string[] = imageName.split(':');
    const fullImageName: string = splittedImageName.length > 1
      ? imageName
      : `${imageName}:latest`;

    const existingImage: Dockerode.ImageInfo = existingImages.find(
      image => {
        const tags: string[] = image.RepoTags || [];
        return tags.includes(fullImageName);
      },
    );

    if (existingImage) {
      this.spinner.stop();
      return;
    }

    this.spinner.persistInfo(`${imageName} not found`);
    this.spinner.start(`Downloading ${imageName}`);

    await new Promise((resolve, reject) => {
      this.docker.pull(imageName, {}, (error, stream) => {
        if (error) {
          reject();
        }

        const onFinishPullingImage = (error, output) => {
          if (error) {
            reject(error);
          }

          this.spinner.persistSuccess(`${imageName} downloaded successesfully`)
          resolve();
        };

        this.docker.modem.followProgress(stream, onFinishPullingImage, () => {});
      });
    });
  }

  async getExistingContainers(): Promise<Dockerode.ContainerInfo[]> {
    if (this.existingContainers) {
      return this.existingContainers
    }

    this.existingContainers = await this.docker.listContainers({
      all: true,
    });

    return this.existingContainers;
  }

  async getExistingImages(): Promise<Dockerode.ImageInfo[]> {
    this.existingImages = await this.docker.listImages({
      all: true,
    });

    return this.existingImages;
  }

  async checkForExistingContainer(containerName: string): Promise<boolean> {
    const existingContainers: Dockerode.ContainerInfo[] = await this.getExistingContainers();

    const existingContainer: Dockerode.ContainerInfo = existingContainers.find(
      container => {
        const foundContainer = container.Names.find(
          name => name.replace(/\//g, '') === containerName,
        );
        return foundContainer ? true : false;
      },
    );

    if (existingContainer) {
      this.spinner.persistError(`${containerName} already exists`);
      if (existingContainer.State === 'created') {
        this.startDockerContainer(containerName);
      }

      return true;
    }

    return false;
  }

  async up ({ allContainers = false }) {
    const containersConfig: Object = FileHandler.loadDockerComposeFile();
    const { services }: any = containersConfig;
    const containers: string[] = (allContainers)
      ? Object.keys(services)
      : FileHandler.getContainersFromFile().containers;
    const lastContainer = containers.slice(-1)[0];

    for (const containerName of containers) {
      const service: Service = services[containerName] || null;

      this.spinner.start(`${containerName} is being created`);

      if (!service) {
        this.spinner.persistError(`${containerName} not found`);
        this.spinner.stop();
        continue;
      }

      const containerExists = await this.checkForExistingContainer(containerName);
      if (containerExists) {
        if (lastContainer !== containerName) {
          this.spinner.persistSeparator();
        }
        continue;
      };

      try {
        await this.pullDockerImage(service.image);
        await this.createDockerContainer(
          containerName,
          service,
        );

        if (lastContainer !== containerName) {
          this.spinner.persistSeparator();
        }
      } catch (error) {
        this.spinner.persistError(`${containerName} - ${error.message}`);
        if (lastContainer !== containerName) {
          this.spinner.persistSeparator();
        }
        this.spinner.stop();
      }
    }
  }

  async configure() {
    const answers = await this.inquire();
    const { containers = [] }: { containers?: string[] } = answers;
    FileHandler.writeOnContainersFile(containers);
    this.spinner.persistInfo(`Run the command ${chalk.yellow('genesis up')} and get your containers running`);
  }

  async all() {

  }
}

export default (): Genesis => new Genesis();
