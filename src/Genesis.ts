import * as fs from 'fs';
import * as os from 'os';
import * as Inquirer from 'inquirer';
import * as YAML from 'yamljs';
import * as dotenv from 'dotenv';
import * as Ora from 'ora';
import * as Dockerode from 'dockerode';
import chalk from 'chalk';
import choices from './helpers/options';

interface ContainerAnswers {
  containers?: string[]
}

interface ContainerFileConfig {
  filePath: string,
  fileName: string,
  fullPath: string
}

interface SelectedContainers {
  containers: String[]
}

interface Service {
  container_name: string,
  image: string,
  ports: string[],
  volumes?: string[],
}

class Genesis {
  static loadDockerCompose(): Object {
    dotenv.config({
      path: '../.env',
    });
    return YAML.load(process.env.DOCKER_COMPOSE_PATH);
  }

  static getContainerFileConfigs(): ContainerFileConfig {
    const filePath: string = '../data/';
    const fileName: string = 'selected-containers.json';
    const fullPath: string = `${filePath}/${fileName}`;

    return {
      filePath,
      fileName,
      fullPath,
    }
  }

  static writeOnContainersFile(data: string[] = null): void {
    const containerConfig: ContainerFileConfig = this.getContainerFileConfigs();

    const fileData = {
      containers: data || []
    };

    fs.writeFileSync(
      containerConfig.fullPath,
      JSON.stringify(fileData)
    );
  }

  static definePortMappings(service: Service): Dockerode.PortMap {
    const HOST_PORT: number = 0;
    const CONTAINER_PORT: number = 1;

    const mapPorts = (port: string) => {
      const splitedPorts: string[] = port.split(':');
      const key: string = `${splitedPorts[CONTAINER_PORT]}/tcp`;
      const hostPort: Dockerode.PortBinding = {
        HostPort: splitedPorts[HOST_PORT]
      };

      return {
        [key]: [
          hostPort,
        ]
      }
    };

    const reduceToPortMapType = (prev: Object, next: Object) => {
      const key: string = Object.keys(next)[0];
      prev[key] = next[key];
      return prev;
    }

    const portMaps:Dockerode.PortMap = service.ports.map(mapPorts)
      .reduce(reduceToPortMapType, {});

    return portMaps;
  }

  static getContainersFromFile(): SelectedContainers {
    const containerConfig: ContainerFileConfig = this.getContainerFileConfigs();
    const containersFile: string = fs.readdirSync(containerConfig.filePath)
      .find(file => file === containerConfig.fileName);

    if (!containersFile) {
      this.writeOnContainersFile();
    }

    const fileBuffer: Buffer = fs.readFileSync(containerConfig.fullPath);
    const selectedContainers: SelectedContainers = JSON.parse(fileBuffer.toString());

    return selectedContainers;
  }

  static async createDockerContainer(docker: Dockerode, containerName: string, service: Service) {
    const spinner: any = Ora({
      text: `Creating ${containerName}`,
      color: 'green',
    }).start();
    const ports: Dockerode.PortMap = this.definePortMappings(service);
    const containerConfig: Dockerode.ContainerCreateOptions = {
      name: service.container_name,
      Image: service.image,
      HostConfig: {
        PortBindings: ports,
      }
    }

    if (service.volumes) {
      containerConfig.HostConfig.Binds = service.volumes
    }

    try {
      const container: Dockerode.Container = await docker.createContainer(containerConfig);
      spinner.stopAndPersist({
        symbol: chalk.blueBright('ℹ'),
        text: `Creating ${containerName}`,
      });

      spinner.stopAndPersist({
        symbol: chalk.green('✔'),
        text: `${containerName} created successfully`,
      });

      spinner.start(`Starting ${containerName}`);
      await container.start();
      spinner.stopAndPersist({
        symbol: chalk.blueBright('ℹ'),
        text: `Starting ${containerName}`,
      });

      spinner.stopAndPersist({
        symbol: chalk.green('✔'),
        text: `${containerName} started successfully`,
      });

      spinner.stop();
    } catch (error) {
      spinner.stopAndPersist({
        symbol: chalk.red('✖'),
        text: `${containerName} - ${error.message}`,
      });

      spinner.stop();
    }

  }

  static async requestContainers() {
    dotenv.config();

    const socketPath = (os.platform() === 'win32')
      ? 'npipe:////./pipe/docker_engine'
      : '/var/run/docker.sock';
    const docker = new Dockerode({ socketPath });

    const selectedContainers: SelectedContainers = this.getContainersFromFile();
    const choicesWithSelected: Object[] = choices.map((choice: Inquirer.Answers) => {
      const selectedChoice: String = selectedContainers.containers.find(container => container === choice.value);

      if (selectedChoice) {
        choice.checked = true;
      }

      return choice;
    });

    const answers: ContainerAnswers = await Inquirer.prompt([
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

    const containersConfig: Object = this.loadDockerCompose();
    const { containers = [] } : { containers?: string[]} = answers;
    const { services }: any = containersConfig;

    this.writeOnContainersFile(containers);

    for (const containerName of containers) {
      const service: Service = services[containerName] || null;

      const spinner: any = Ora({
        text: `${containerName} is being created`,
        color: 'green',
      }).start();

      if (!service) {
        spinner.stopAndPersist({
          symbol: chalk.red('✖'),
          text: `${containerName} not found`,
        });
        spinner.stop();
        return;
      }

      try {
        spinner.start(`Cheking if image ${service.image} exists`);

        await new Promise((fulfilled, rejected) => {
          docker.pull(service.image, (err, stream) => {
            if (err) {
              rejected(err);
            }

            spinner.start(`Downloading image ${service.image}`);

            const onFinished = async (err) => {
              if (err) {
                spinner.stop();
                rejected(err);
              }

              spinner.stopAndPersist({
                symbol: chalk.green('✔'),
                text: `Image ${service.image} downloaded`,
              });
              spinner.stop();

              try {
                await this.createDockerContainer(docker, containerName, service);
                fulfilled();
              } catch(err) {
                rejected(err);
              }
            }

            docker.modem.followProgress(stream, onFinished, () => {});
          });
        });
      } catch (error) {
        spinner.stopAndPersist({
          symbol: chalk.red('✖'),
          text: `${containerName} - ${error.message}`,
        });

        spinner.stop();
      }
    }
  }
}

export default Genesis;
