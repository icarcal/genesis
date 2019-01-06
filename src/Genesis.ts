import * as os from 'os';
import * as Inquirer from 'inquirer';
import * as Dockerode from 'dockerode';
import chalk from 'chalk';

import FileHandler from './modules/FileHandler';
import ConsoleWritter from './modules/ConsoleWriter';
import {
  ContainerAnswers,
  SelectedContainers,
  Service,
} from './interfaces';
import { readFileSync, readdirSync } from 'fs';

class Genesis {
  docker: Dockerode;
  spinner: any;
  existingImages: Dockerode.ImageInfo[];
  existingContainers: Dockerode.ContainerInfo[];
  path: string;

  constructor() {
    const socketPath =
      os.platform() === 'win32'
        ? 'npipe:////./pipe/docker_engine'
        : '/var/run/docker.sock';

    this.docker = new Dockerode({ socketPath });
    this.spinner = ConsoleWritter({
      color: 'green',
    });
    this.path = process.cwd();
  }

  getContainersFromCompose(): string[] {
    const compose: Object = FileHandler.loadDockerComposeFile(this.path);

    if (!compose) {
      return null;
    }

    const { services }: any = compose;
    const containers: string[] = Object.keys(services);

    return containers;
  }

  async inquire(): Promise<ContainerAnswers> {
    const choices: string[] = this.getContainersFromCompose();

    if (!choices) {
      return null;
    }

    const selectedContainers: SelectedContainers = FileHandler.getContainersFromFile();
    const choicesWithSelected: Object[] = choices.map(
      (choice: string) => {
        const choiceObject: Inquirer.Answers = {
          value: choice,
          name: choice,
        };

        if (selectedContainers.containers.includes(choice)) {
          choiceObject.checked = true;
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

    const containerConfig: Dockerode.ContainerCreateOptions = {
      name: service.container_name,
      Image: service.image,
      HostConfig: {},
    };

    if (service.ports) {
      const ports: Dockerode.PortMap = this.definePortMappings(service);
      containerConfig.HostConfig.PortBindings = ports;
    }

    if (service.volumes) {
      const fullPathVolumes = service.volumes.map((volume) => {
        return volume.replace(/.\//, `${this.path}/`);
      });

      containerConfig.HostConfig.Binds = fullPathVolumes;
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

    const imageExists: boolean = await this.checkForExistingImage(imageName);

    if (imageExists) {
      this.spinner.stop();
      return;
    }

    this.spinner.persistInfo(`${imageName} not found`);
    this.spinner.start(`Downloading ${imageName}`);

    await new Promise((resolve, reject) => {
      this.docker.pull(imageName, {}, (error, stream) => {
        if (error) {
          return reject(error);
        }

        const onFinishPullingImage = (error, output) => {
          if (error) {
            return reject(error);
          }

          this.spinner.persistSuccess(`${imageName} downloaded successfully`)
          return resolve(output);
        };

        const onPullProgress = (event) => {
          if (event.status && event.status !== '\n') {
            this.spinner.persistInfo(`${event.status} - ${event.id}`);
          }
        }

        this.docker.modem.followProgress(stream, onFinishPullingImage, onPullProgress);
      });
    });
  }

  async buildDockerImage(containerName: string, service: Service): Promise<void> {
    this.spinner.start(`Building ${containerName}`);

    if (service.image) {
      const imageExists: boolean = await this.checkForExistingImage(service.image);

      if (imageExists) {
        return;
      }
    }

    const imageName = service.image || null;
    const context = service.build.context.replace(/.\//, `${this.path}/`);
    const src = readdirSync(context);
    const stream = await this.docker.buildImage({
      context,
      src,
    }, {
      t: imageName,
      nocache: true,
    });

    return new Promise((resolve, reject) => {
      const onFinishedBuild = (error, output) => {
        if (error) {
          this.spinner.persistError(error);
          return reject(error)
        }

        this.spinner.persistSuccess(`Image ${imageName} build`);
        return resolve(output);
      }

      const onBuildProgress = (event) => {
        if (event.stream && event.stream !== '\n') {
          this.spinner.persistInfo(event.stream.replace(/\n/, ''));
        }
      }

      this.docker.modem.followProgress(stream, onFinishedBuild, onBuildProgress);
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
    if (this.existingImages) {
      return this.existingImages;
    }

    const images = await this.docker.listImages({
      all: true,
    });

    this.existingImages = images;

    return images;
  }

  async checkForExistingImage(imageName: string): Promise<boolean> {
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

    return (existingImage) ? true : false;
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
      const containerStatusCheck = ['created', 'exited'];
      if (containerStatusCheck.includes(existingContainer.State)) {
        await this.startDockerContainer(containerName);
      }

      return true;
    }

    return false;
  }

  async defineBuildType(containerName:string, service: Service): Promise<void> {
    if (service.build) {
      await this.buildDockerImage(containerName, service);
      return;
    }

    await this.pullDockerImage(service.image);
    return;
  }

  async up ({ allContainers = false }) {
    const containersConfig: Object = FileHandler.loadDockerComposeFile(this.path);

    if (!containersConfig) {
      return this.spinner.persistError('No docker-compose.yml found in this directory');
    }

    const { services }: any = containersConfig;
    const containers: string[] = (allContainers)
      ? Object.keys(services)
      : FileHandler.getContainersFromFile().containers;
    const lastContainer = containers.slice(-1)[0];

    FileHandler.writeOnContainersFile(containers);

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
        await this.defineBuildType(containerName, service);
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

    if (!answers) {
      return this.spinner.persistError('No docker-compose.yml found in this directory');
    }

    const { containers = [] }: { containers?: string[] } = answers;
    FileHandler.writeOnContainersFile(containers);
    this.spinner.persistInfo(`Run the command ${chalk.yellow('genesis up')} and get your containers running`);
  }

  async down() {
    const {containers} = FileHandler.getContainersFromFile();
    this.existingContainers = await this.docker.listContainers({
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
      const containerToDestroy = await this.docker.getContainer(container.Id);
      this.spinner.start(`Stopping container ${container.Names[0]}`);
      await containerToDestroy.stop();
      this.spinner.persistSuccess(`Container ${container.Names[0]} stopped`);

      this.spinner.start(`Removing container ${container.Names[0]}`);
      await containerToDestroy.remove();
      this.spinner.persistSuccess(`Container ${container.Names[0]} removed`);

      if (lastContainer.Id !== container.Id) {
        this.spinner.persistSeparator();
      }
    }
  }
}

export default (): Genesis => new Genesis();
