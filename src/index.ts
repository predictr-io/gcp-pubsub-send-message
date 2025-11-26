import * as core from '@actions/core';
import { PubSub } from '@google-cloud/pubsub';
import {
  publishMessage,
  MessageConfig
} from './pubsub';

async function run(): Promise<void> {
  try {
    // Get inputs
    const projectId = core.getInput('project-id', { required: true });
    const topicName = core.getInput('topic-name', { required: true });
    const message = core.getInput('message', { required: true });
    const attributes = core.getInput('attributes') || undefined;
    const orderingKey = core.getInput('ordering-key') || undefined;

    core.info('GCP Pub/Sub Send Message');
    core.info(`Project ID: ${projectId}`);
    core.info(`Topic: ${topicName}`);

    // Create Pub/Sub client
    // Uses Application Default Credentials (ADC) from environment
    // Set via google-github-actions/auth or GOOGLE_APPLICATION_CREDENTIALS
    const pubsub = new PubSub({ projectId });

    // Build configuration
    const config: MessageConfig = {
      topicName,
      message,
      attributes,
      orderingKey
    };

    // Publish message
    const result = await publishMessage(pubsub, config);

    // Handle result
    if (!result.success) {
      throw new Error(result.error || 'Failed to publish message');
    }

    // Set outputs
    if (result.messageId) {
      core.setOutput('message-id', result.messageId);
    }

    // Summary
    core.info('');
    core.info('='.repeat(50));
    core.info('Message published successfully');
    if (result.messageId) {
      core.info(`Message ID: ${result.messageId}`);
    }
    core.info('='.repeat(50));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(errorMessage);
  }
}

run();
