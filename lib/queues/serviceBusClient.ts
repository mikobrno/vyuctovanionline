import { ServiceBusClient, ServiceBusSender, ServiceBusReceiver } from '@azure/service-bus'

let client: ServiceBusClient | null = null
const senders = new Map<string, ServiceBusSender>()
const receivers = new Map<string, ServiceBusReceiver>()

function getConnectionString() {
  return process.env.SERVICE_BUS_CONNECTION_STRING
}

export function getServiceBusSender(queueName: string) {
  const connectionString = getConnectionString()
  if (!connectionString) {
    return null
  }

  if (!client) {
    client = new ServiceBusClient(connectionString)
  }

  if (!senders.has(queueName)) {
    senders.set(queueName, client.createSender(queueName))
  }

  return senders.get(queueName) ?? null
}

export function getServiceBusReceiver(queueName: string) {
  const connectionString = getConnectionString()
  if (!connectionString) {
    return null
  }

  if (!client) {
    client = new ServiceBusClient(connectionString)
  }

  if (!receivers.has(queueName)) {
    receivers.set(queueName, client.createReceiver(queueName))
  }

  return receivers.get(queueName) ?? null
}

export async function closeServiceBusClient() {
  if (client) {
    await client.close()
    client = null
    senders.clear()
    for (const receiver of receivers.values()) {
      await receiver.close()
    }
    receivers.clear()
  }
}
