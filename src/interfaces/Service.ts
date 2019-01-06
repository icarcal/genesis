interface Service {
  container_name?: string,
  image?: string,
  ports?: string[],
  volumes?: string[],
  build?: {
    context?: string,
    dockerfile?: string,
  }
  env_file?: string,
  environment?: object[],
  networks?: string[],
}

export default Service;
