# n8n Integration Setup

The three exported workflows in this repository are templates. They are inactive exports and are not evidence of a live n8n deployment.

## Required setup after importing

1. Import each JSON file into your n8n workspace.
2. Reconnect Gmail, Google Calendar, and OpenAI credentials using n8n's credential manager. Exported credential IDs are local to the original n8n workspace and will not authenticate in another workspace.
3. Set the HTTP Request node URL to your deployed CEO Command Center API:
   - Approval Agent: `https://YOUR_API_DOMAIN/api/approvals`
   - Executive Briefing Agent: `https://YOUR_API_DOMAIN/api/dashboard/briefing`
   - Scheduling & Calendar Agent: `https://YOUR_API_DOMAIN/api/meetings/`
4. Configure the HTTP Request node's `x-api-key` header using an n8n Header Auth credential. Do not paste the secret into workflow JSON or commit it to Git.
5. Set the backend's `SERVICE_API_KEY` to the same newly generated random secret (at least 32 bytes). The previous value was embedded in tracked workflow exports and must be treated as compromised; rotate it before activating any workflow.
6. Configure the backend's `N8N_WEBHOOK_URL` only if the approval-decision callback workflow is installed and ready.
7. Test each workflow manually with non-production test data. Confirm the backend response and n8n execution result before activating schedules/triggers.

## Important security boundary

The service key is for machine-to-machine ingestion endpoints only. It is not a CEO login and does not grant administrator access to human-only read or decision endpoints. Keep the credential in n8n's credential store and the backend's private environment variables.

## Deployment dependencies

Live workflow activation requires access to the target n8n instance and valid provider credentials. Those cannot be created or verified from this GitHub repository alone.
