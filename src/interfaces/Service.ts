interface Service {
  container_name: string,
  image: string,
  ports: string[],
  volumes?: string[],
}

export default Service;
