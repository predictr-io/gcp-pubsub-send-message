# GCP Pub/Sub Send Message

A GitHub Action to publish messages to Google Cloud Pub/Sub topics. Seamlessly integrate message publishing into your CI/CD workflows with support for ordered delivery and custom attributes.

## Features

- **Publish messages** - Send messages to Pub/Sub topics
- **Message attributes** - Support for custom message attributes
- **Ordered delivery** - Optional ordering keys for message ordering
- **Emulator support** - Test with Pub/Sub emulator in CI
- **Simple integration** - Works with existing Pub/Sub topics

## Prerequisites

Configure GCP credentials before using this action.

### Option 1: Workload Identity Federation (Production - Recommended)

Use `google-github-actions/auth@v2` with Workload Identity Federation:

```yaml
- name: Authenticate to Google Cloud
  uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
    service_account: 'my-service-account@my-project.iam.gserviceaccount.com'
```

### Option 2: Service Account Key

Use `google-github-actions/auth@v2` with a service account key:

```yaml
- name: Authenticate to Google Cloud
  uses: google-github-actions/auth@v2
  with:
    credentials_json: '${{ secrets.GCP_CREDENTIALS }}'
```

### Option 3: Pub/Sub Emulator (Testing)

Use the Pub/Sub emulator for testing within the workflow:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      pubsub-emulator:
        image: gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators
        ports:
          - 8085:8085
        options: >-
          --entrypoint=gcloud
        # Start emulator
        command: >
          beta emulators pubsub start
          --host-port=0.0.0.0:8085
          --project=test-project
    
    steps:
      - name: Publish to emulator
        uses: predictr-io/gcp-pubsub-send-message@v1
        env:
          PUBSUB_EMULATOR_HOST: localhost:8085
        with:
          project-id: 'test-project'
          topic-name: 'test-topic'
          message: 'Test message'
```

## Usage

### Publish Simple Message

Publish a basic message to a Pub/Sub topic:

```yaml
- name: Publish message to Pub/Sub
  uses: predictr-io/gcp-pubsub-send-message@v1
  with:
    project-id: 'my-gcp-project'
    topic-name: 'my-topic'
    message: 'Hello from GitHub Actions!'
```

### Publish Message with Attributes

Publish a message with custom attributes:

```yaml
- name: Publish message with attributes
  uses: predictr-io/gcp-pubsub-send-message@v1
  with:
    project-id: 'my-gcp-project'
    topic-name: 'my-topic'
    message: '{"orderId": "12345", "amount": 99.99}'
    attributes: '{"orderType": "premium", "priority": "high"}'
```

### Publish with Ordering Key

Publish a message with an ordering key for ordered delivery:

```yaml
- name: Publish ordered message
  uses: predictr-io/gcp-pubsub-send-message@v1
  with:
    project-id: 'my-gcp-project'
    topic-name: 'my-topic'
    message: '{"event": "user-signup", "userId": "user123"}'
    ordering-key: 'user-123'
```

**Note:** The topic must have message ordering enabled for ordering keys to work.

### Complete Pipeline Example

Trigger downstream processing via Pub/Sub:

```yaml
name: Deploy and Notify

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    permissions:
      contents: 'read'
      id-token: 'write'
    
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}

      - name: Deploy application
        run: |
          echo "Deploying..."

      - name: Publish deployment notification
        id: notify
        uses: predictr-io/gcp-pubsub-send-message@v1
        with:
          project-id: ${{ secrets.GCP_PROJECT_ID }}
          topic-name: 'deployment-events'
          message: |
            {
              "event": "deployment",
              "repository": "${{ github.repository }}",
              "sha": "${{ github.sha }}",
              "actor": "${{ github.actor }}",
              "timestamp": "${{ github.event.head_commit.timestamp }}"
            }
          attributes: |
            {
              "eventType": "deployment",
              "environment": "production",
              "source": "github-actions"
            }

      - name: Log message ID
        run: |
          echo "Message published with ID: ${{ steps.notify.outputs.message-id }}"
```

### Testing with Emulator

Complete example using the Pub/Sub emulator:

```yaml
name: Test Pub/Sub Integration

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      pubsub-emulator:
        image: gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators
        ports:
          - 8085:8085
        options: --entrypoint=gcloud
        command: >
          beta emulators pubsub start
          --host-port=0.0.0.0:8085
          --project=test-project
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Create test topic
        run: |
          # Install gcloud if needed or use curl to hit emulator API
          curl -X PUT http://localhost:8085/v1/projects/test-project/topics/test-topic
      
      - name: Publish test message
        uses: predictr-io/gcp-pubsub-send-message@v1
        env:
          PUBSUB_EMULATOR_HOST: localhost:8085
        with:
          project-id: 'test-project'
          topic-name: 'test-topic'
          message: 'Integration test message'
          attributes: '{"test": "true"}'
```

## Inputs

### Required Inputs

| Input | Description |
|-------|-------------|
| `project-id` | GCP project ID (e.g., `my-project`) |
| `topic-name` | Pub/Sub topic name (just the name, not the full path like `projects/my-project/topics/my-topic`) |
| `message` | Message data content (string, max 10 MB) |

### Optional Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `attributes` | Message attributes as JSON object (e.g., `{"key": "value"}`) | - |
| `ordering-key` | Ordering key for ordered message delivery | - |

## Outputs

| Output | Description |
|--------|-------------|
| `message-id` | Unique identifier assigned to the message by Pub/Sub |

## Message Attributes Format

Message attributes must be provided as a JSON object where all values are strings:

```json
{
  "attributeName": "attributeValue",
  "environment": "production",
  "source": "github-actions"
}
```

**Important:** Unlike AWS SQS, Pub/Sub attributes are simple string key-value pairs. All values must be strings.

### Example

```yaml
attributes: |
  {
    "author": "John Doe",
    "priority": "high",
    "version": "1.0"
  }
```

## Ordering Keys

Ordering keys ensure messages with the same key are delivered in the order they were published:

- **Enable ordering** on the topic before using ordering keys
- Messages with the same ordering key are delivered in order
- Messages with different keys may be delivered out of order
- Useful for event sourcing, state machines, and ordered event processing

```yaml
ordering-key: 'user-123'
```

## Topic Name Format

Provide just the topic name, not the full resource path:

**✓ Correct:**
```yaml
topic-name: 'my-topic'
```

**✗ Incorrect:**
```yaml
topic-name: 'projects/my-project/topics/my-topic'
```

The action constructs the full topic path automatically using the project ID.

## Error Handling

The action handles common scenarios:

- **Invalid topic name**: Fails with validation error
- **Message too large**: Fails with size limit error (max 10 MB)
- **Topic not found**: Fails with GCP API error
- **Permission errors**: Fails with authentication/authorization error
- **Invalid JSON**: Fails with JSON parsing error for attributes

## Authentication Notes

### Workload Identity Federation

Recommended for production. Requires setup in GCP:

1. Create Workload Identity Pool
2. Create Workload Identity Provider (for GitHub)
3. Grant service account permissions to the pool
4. Use in workflow as shown above

Benefits: No long-lived credentials, automatic rotation, more secure.

### Service Account Key

Simpler but less secure. Store the JSON key in GitHub Secrets:

```yaml
credentials_json: '${{ secrets.GCP_CREDENTIALS }}'
```

### Emulator

For testing only. Set `PUBSUB_EMULATOR_HOST` environment variable:

```yaml
env:
  PUBSUB_EMULATOR_HOST: localhost:8085
```

## Required IAM Permissions

The service account or Workload Identity needs:

- `pubsub.topics.publish` - To publish messages
- `pubsub.topics.get` - To verify topic exists (optional)

**Predefined Role:** `roles/pubsub.publisher`

## Version References

Users can reference the action:
- **Recommended:** `predictr-io/gcp-pubsub-send-message@v1` (floating major version, gets updates)
- **Pinned:** `predictr-io/gcp-pubsub-send-message@v1.0.0` (specific version, never changes)

## Comparison with AWS SQS

| Feature | AWS SQS | GCP Pub/Sub |
|---------|---------|-------------|
| Message size | 256 KB | 10 MB |
| Attributes | Typed (String, Number, Binary) | String only |
| FIFO | Separate queue type | Ordering key on any topic |
| Delivery | Pull (polling) | Push or Pull |
| Dead letter | DLQ configuration | Dead letter topic |

## License

MIT

## Contributing

Contributions welcome! Please submit a Pull Request.
