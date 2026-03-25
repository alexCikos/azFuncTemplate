targetScope = 'resourceGroup'

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Naming prefix used in resource names, for example "hello-template".')
@minLength(2)
@maxLength(20)
param namePrefix string

@description('Deployment environment label used in names and tags')
@allowed([
  'dev'
  'test'
  'prod'
])
param environmentName string = 'dev'

@description('Optional extra tags merged onto all resources')
param tags object = {}

@description('Microsoft Entra tenant ID used for optional Graph app-only token requests.')
param graphTenantId string = ''

@description('Application (client) ID for the optional Graph runtime app registration.')
param graphClientId string = ''

@secure()
@description('Client secret for the optional Graph runtime app registration.')
param graphClientSecret string = ''

@description('Graph scope used for optional client_credentials token requests.')
param graphScope string = 'https://graph.microsoft.com/.default'

var workloadSlug = toLower(replace(replace(namePrefix, '_', '-'), ' ', '-'))
var normalizedPrefix = toLower(replace(replace(replace(namePrefix, '-', ''), '_', ''), ' ', ''))
var suffix = uniqueString(resourceGroup().id)

var storageName = take('sa${normalizedPrefix}${suffix}', 24)
var functionAppName = toLower(take('func-${workloadSlug}-${environmentName}-${suffix}', 60))
var planName = toLower(take('${workloadSlug}-${environmentName}-asp', 40))
var logAnalyticsName = toLower(take('${workloadSlug}-${environmentName}-law', 63))
var appInsightsName = toLower(take('${workloadSlug}-${environmentName}-appi', 260))

var commonTags = union(
  {
    workload: 'azure-function-template'
    environment: environmentName
    managedBy: 'bicep'
  },
  tags
)

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageName
  location: location
  tags: commonTags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
  }
}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  tags: commonTags
  properties: {
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: commonTags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: planName
  location: location
  tags: commonTags
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true
  }
}

resource func 'Microsoft.Web/sites@2023-01-01' = {
  name: functionAppName
  location: location
  tags: commonTags
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      linuxFxVersion: 'Node|22'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~22'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'GRAPH_TENANT_ID'
          value: graphTenantId
        }
        {
          name: 'GRAPH_CLIENT_ID'
          value: graphClientId
        }
        {
          name: 'GRAPH_CLIENT_SECRET'
          value: graphClientSecret
        }
        {
          name: 'GRAPH_SCOPE'
          value: graphScope
        }
        {
          name: 'APP_TEMPLATE_NAME'
          value: workloadSlug
        }
        {
          name: 'ENVIRONMENT_NAME'
          value: environmentName
        }
      ]
    }
  }
}

output functionAppResourceName string = func.name
output functionAppDefaultHostName string = func.properties.defaultHostName
output storageAccountName string = storage.name
output appInsightsConnectionString string = appInsights.properties.ConnectionString
