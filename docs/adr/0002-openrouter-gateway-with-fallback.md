# All model calls go through one server-side gateway, OpenRouter by default

Status: accepted, amended

Amendment: model choice is dynamic. The app fetches OpenRouter's model list and offers free models by default. A key with paid access lets the user choose any model. A key is checked by reading its status, with no model call, when it is entered. The list is fetched each time the settings page opens. A fixed `config/models.json` remains only as the fallback order.

Every model call goes through a single server-side gateway that defaults to OpenRouter, so the free tier can be used first. Direct Anthropic and OpenAI adapters are optional and used only when their keys are set. Each task has a primary model and a fallback list in `config/models.json`, and a rate limit moves the call to the next entry. We chose this over calling one provider directly so that free-model limits and quality changes can be handled by editing config, not code.
