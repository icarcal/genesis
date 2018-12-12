import * as Inquirer from 'inquirer';
import * as YAML from 'yamljs';
import { Docker } from 'node-docker-api';
import chalk from 'chalk';
import choices from './helpers/options';

interface ContainerAnswers {
  containers?: Array<String>
}

class Genesis {
  static loadDockerCompose(): Object {
    return YAML.load(process.env.DOCKER_COMPOSE_PATH);
  }

  static async requestContainers() {
    const docker = new Docker({ socketPath: '/var/run/docker.sock' })
    // TODO: READ FROM ALREADY SELECTED

    const answers: ContainerAnswers = await Inquirer.prompt([
      {
        type: 'checkbox',
        message: 'Select the containers',
        name: 'containers',
        choices: choices,
        validate: (answer) => {
          if (answer.length < 1) {
            return 'You must choose at least one topping.';
          }

          return true;
        },
      },
    ]);

    const containersConfig: Object = this.loadDockerCompose();
    const { containers } = answers;
    const { services }: any = containersConfig;

    // TODO: UPDATE ALREADY SELECTED

    containers.forEach((container: String) => {
      const service = Object.keys(services).find(service => service === container);
      if (service) {
        console.log(`${container} not found` );
        return;
      }

      console.log(`${container} is being created` );
    });
  }
}

export default Genesis;
