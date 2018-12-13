import * as Inquirer from 'inquirer';

const choices: Array<Inquirer.Answers> = [
  // { value: 'app-service', name: 'App Service' },
  // { value: 'media-tool', name: 'Media tool' },
  // { value: 'mma-front', name: 'MMA Front' },
  // { value: 'mma-service', name: 'MMA Service' },
  { value: 'mailcatcher', name: 'Mail Catcher' },
  { value: 'mongo', name: 'MongoDB' },
  // { value: 'mysql', name: 'Mysql' },
  // { value: 'ssh', name: 'SSH' },
  { value: 'rabbitmq', name: 'RabbitMQ' },
  { value: 'redis', name: 'Redis' }
  // { value: 'user-service', name: 'User Service' },
  // { value: 'tool-front-end', name: 'Tool' },
];

export default choices;
