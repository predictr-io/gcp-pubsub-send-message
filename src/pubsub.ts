import { PubSub } from '@google-cloud/pubsub';
import * as core from '@actions/core';

export interface MessageConfig {
  topicName: string;
  message: string;
  attributes?: string; // JSON string
  orderingKey?: string;
}

export interface MessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Parse message attributes from JSON string
 */
export function parseAttributes(attributesJson: string): Record<string, string> {
  try {
    const parsed = JSON.parse(attributesJson);
    
    // Validate that all values are strings
    const attributes: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'string') {
        throw new Error(
          `Attribute "${key}" must be a string, got ${typeof value}. ` +
          'All Pub/Sub attributes must be strings.'
        );
      }
      attributes[key] = value;
    }
    
    return attributes;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse attributes: ${errorMessage}`);
  }
}

/**
 * Validate topic name format
 */
export function validateTopicName(topicName: string): void {
  // Topic names must:
  // - Start with a letter
  // - Contain only letters, numbers, dashes, underscores, periods, tildes, plus, and percent signs
  // - Be between 3 and 255 characters
  const topicPattern = /^[a-zA-Z][a-zA-Z0-9._~+%-]{2,254}$/;
  
  if (!topicPattern.test(topicName)) {
    throw new Error(
      `Invalid topic name: "${topicName}". ` +
      'Topic names must start with a letter and be 3-255 characters long, ' +
      'containing only letters, numbers, and ._~+%-'
    );
  }
}

/**
 * Validate message size (max 10 MB)
 */
export function validateMessageSize(message: string): void {
  const sizeInBytes = Buffer.byteLength(message, 'utf8');
  const maxSizeBytes = 10 * 1024 * 1024; // 10 MB

  if (sizeInBytes > maxSizeBytes) {
    throw new Error(
      `Message size (${sizeInBytes} bytes) exceeds maximum allowed size ` +
      `(${maxSizeBytes} bytes / 10 MB)`
    );
  }
}

/**
 * Publish a message to a Pub/Sub topic
 */
export async function publishMessage(
  pubsub: PubSub,
  config: MessageConfig
): Promise<MessageResult> {
  try {
    // Validate inputs
    validateTopicName(config.topicName);
    validateMessageSize(config.message);

    core.info(`Publishing message to topic: ${config.topicName}`);
    core.info(`Message size: ${Buffer.byteLength(config.message, 'utf8')} bytes`);

    // Get topic reference
    const topic = pubsub.topic(config.topicName);

    // Build message data
    const dataBuffer = Buffer.from(config.message, 'utf8');
    
    // Parse attributes if provided
    let attributes: Record<string, string> | undefined;
    if (config.attributes) {
      attributes = parseAttributes(config.attributes);
      core.info(`Attributes: ${Object.keys(attributes).length} attribute(s)`);
    }

    // Build publish options
    const publishOptions: {
      orderingKey?: string;
    } = {};

    if (config.orderingKey) {
      publishOptions.orderingKey = config.orderingKey;
      core.info(`Ordering key: ${config.orderingKey}`);
    }

    // Publish message
    const messageId = await topic.publishMessage({
      data: dataBuffer,
      attributes,
      ...publishOptions
    });

    core.info('✓ Message published successfully');
    core.info(`Message ID: ${messageId}`);

    return {
      success: true,
      messageId
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.error(`Failed to publish message: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage
    };
  }
}
