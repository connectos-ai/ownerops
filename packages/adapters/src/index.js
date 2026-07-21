export class CapabilityNotImplementedError extends Error {
  constructor(capability) {
    super(`${capability} is not implemented by this adapter`);
    this.name = 'CapabilityNotImplementedError';
  }
}

export class MockEmailSource {
  constructor(messages = []) {
    this.messages = messages;
  }

  async listThreads() {
    return this.messages.map((message) => ({
      id: message.id,
      subject: message.subject,
      receivedAt: message.receivedAt
    }));
  }

  async readThread(id) {
    const message = this.messages.find((item) => item.id === id);
    if (!message) throw new Error(`Message not found: ${id}`);
    return message;
  }
}

export class LocalTaskDestination {
  constructor() {
    this.tasks = [];
  }

  async createTask(task) {
    this.tasks.push(task);
    return task;
  }

  async listTasks() {
    return [...this.tasks];
  }
}
