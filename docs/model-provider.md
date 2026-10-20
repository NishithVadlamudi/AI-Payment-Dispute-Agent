# Provider choice for the free-tier demo

Decision: use **gemini-3.5-flash-lite** through the **Gemini Developer API** by default, with the official `@google/genai` SDK and native function calling. OpenAI remains an explicit opt-in. There is no automatic provider fallback.

This choice favors a direct SDK integration, streamed answers, and native multi-step function calls for the four investigation tools and the approval-only refund request tool. The initial comparison used official documentation. After the cloud key was published, all three live demo scenarios passed with Flash Lite. The heavier `gemini-flash-latest` alias resolved to Gemini 3.8 Flash and produced timeouts and a temporary 503 in this environment. This is a three-scenario readiness check; broader model evaluation remains Phase 4 work.

| Option | Fit for this project | Limitation |
| --- | --- | --- |
| Gemini Developer API | Official SDK documents streaming, JSON Schema function declarations, and native tool results; a good default for an eligible AI Studio free-tier project | Confirm model availability, free-tier eligibility, quotas, and data-use terms in your own project |
| Groq | Official cookbook demonstrates function calling and parallel tools; a credible alternative when low latency matters | Model selection and free-account limits need account-level verification; not benchmarked here |
| OpenRouter free variants | Potential access to different providers through one integration | Tool support and availability depend on the selected endpoint; current free-variant documentation could not be reached from this environment |
| Local Ollama | Avoids hosted inference usage fees | Needs local compute and cannot run inside a Vercel serverless function; requires a separate inference host |

## What was verified

On October 19, 2026, the official Google SDK README documented `gemini-flash-latest`, `generateContentStream`, `parametersJsonSchema`, and function-call/result continuation. Google's current function-calling cookbook also demonstrates multi-turn and parallel function calls. Groq's official cookbook includes function-calling tutorials and describes obtaining an API key for free; a free key by itself does not establish a specific free inference allowance.

The provider pricing and quota pages returned network-policy errors in this execution environment. **Current numerical quotas and eligibility were not independently verified.** Do not read this document as a promise of unlimited free use or that every model behind an alias is free.

## Configuration and billing behavior

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=<server-side AI Studio key>
GEMINI_MODEL=gemini-3.5-flash-lite
```

The default uses the explicit model ID validated with the live demo. Check its current availability and free-tier eligibility in your project; `GEMINI_MODEL` can select another eligible model ID. For a strictly free demo, use a project without paid billing enabled and verify its account settings. The application cannot enforce a provider's billing tier; the global spending controls in the project plan remain Phase 3 work.

The existing published binding `AI_Payment_Dispute_Agent_Key` is accepted as an alias for `GEMINI_API_KEY`. Node.js start/development commands use the configured HTTPS proxy and system CA store with TLS verification enabled.

The adapter explicitly selects the Gemini Developer API rather than the enterprise API. SDK automatic function execution and automatic generation continuation are disabled: the server's validated dispatcher and eight-turn loop stay in control. A quota error produces an explanation and stops. It never switches to OpenAI or another paid provider. Thought signatures are retained only in server-side history, and thought text is excluded from streamed answers and tool activity.

## Sources

- [Official Google JavaScript SDK: streaming and native function calling](https://github.com/googleapis/js-genai#function-calling)
- [Official Gemini function-calling cookbook](https://github.com/google-gemini/cookbook/blob/main/quickstarts/Function_calling.ipynb)
- [Official Groq cookbook](https://github.com/groq/groq-api-cookbook)
- [Google AI Studio: create a key and inspect your project](https://aistudio.google.com/apikey)
- [Gemini pricing: check current eligibility](https://ai.google.dev/gemini-api/docs/pricing)
- [Groq rate limits](https://console.groq.com/docs/rate-limits)
- [OpenRouter free-variant documentation](https://openrouter.ai/docs/guides/routing/model-variants/free)
