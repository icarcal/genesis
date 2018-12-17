import * as Ora from 'ora';
import chalk from 'chalk';

const persistMessage = function (message: string): any {
  this.stopAndPersist({
    symbol: '',
    text: message,
  });

  return this;
}

const persistSeparator =  function (): any {
  this.stopAndPersist({
    symbol: '',
    text: '='.repeat(20),
  });

  return this;
}

const persistError = function (message: string): any {
  this.stopAndPersist({
    symbol: chalk.red('✖'),
    text: message,
  });

  return this;
}

const persistInfo = function (message: string): any {
  this.stopAndPersist({
    symbol: chalk.blueBright('ℹ'),
    text: message,
  });

  return this;
}

const persistSuccess =  function (message: string): any {
  this.stopAndPersist({
    symbol: chalk.green('✔'),
    text: message,
  });

  return this;
}

export default (opts) => {
  const ora: any = new Ora(opts)
  ora.persistSeparator = persistSeparator.bind(ora);
  ora.persistMessage = persistMessage.bind(ora);
  ora.persistError = persistError.bind(ora);
  ora.persistInfo = persistInfo.bind(ora);
  ora.persistSuccess = persistSuccess.bind(ora);

  return ora;
}
