import * as Inquirer from 'inquirer';
import choices from './helpers/options';

interface ContainerAnswers {
  containers?: Array<String>
}

class Genesis {
  static async requestContainers() {
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

    const { containers } = answers;

    containers.forEach((container: String) => {
      console.log(container);
    });
  }
}

export default Genesis;
