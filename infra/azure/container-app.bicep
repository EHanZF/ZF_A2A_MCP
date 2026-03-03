param location string
param name string = 'mcp-app'
param environmentName string = 'mcp-env'
param registryServer string
param registryUsername string
param registryPassword string
param image string

resource acaEnv 'Microsoft.Web/containerAppsEnvironments@2022-03-01' = {
  name: environmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
    }
  }
}

resource aca 'Microsoft.Web/containerApps@2022-03-01' = {
  name: name
  location: location
  properties: {
    environmentId: acaEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
      }
      registries: [
        {
          server: registryServer
          username: registryUsername
          passwordSecretRef: 'registryPwd'
        }
      ]
      secrets: [
        {
          name: 'registryPwd'
          value: registryPassword
        }
      ]
    }
    template: {
      containers: [
        {
          name: name
          image: image
          resources: {
            cpu: 0.5
            memory: '1.0Gi'
          }
        }
      ]
    }
  }
}
