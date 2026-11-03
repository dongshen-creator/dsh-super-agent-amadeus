import { buildMemoryContext, memoryMetaFrom, summarizeHits } from "./fragment.js";
import { defineTool } from "@deepseek-ai/dsh-tools";
// src/tool.ts
/**
* The `amadeus_recall` and `amadeus_remember` tools.
*/
function makeRecallTool(client) {
	return defineTool({
		name: "amadeus_recall",
		description: "Search long-term memory about this user before answering a question that depends on past conversations, preferences, or facts the user told you earlier. Returns the matching memories as plain facts. If nothing matches it says so — do not guess at memories.",
		parameters: {
			query: {
				type: "string",
				required: true,
				description: "What to look for, phrased as the user's question or the fact you need."
			},
			limit: {
				type: "number",
				description: "Maximum memories to return (1-20, default from config)."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					text: {
						type: "string",
						required: true
					},
					context: {
						type: "string",
						required: true
					},
					hits: {
						type: "array",
						required: true,
						items: {
							type: "object",
							additionalProperties: false,
							properties: {
								memory: {
									type: "string",
									required: true
								},
								score: { type: "number" },
								id: { type: "string" }
							}
						}
					},
					userId: {
						type: "string",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: value.text
			}],
			presentationMeta: (args, value) => ({
				kind: "amadeus-memory",
				query: typeof args.query === "string" ? args.query : "",
				hits: value.hits,
				userId: value.userId
			})
		},
		isConcurrencySafe: () => true,
		presentCall: (args) => ({
			card: "generic",
			title: "检索长期记忆",
			kind: "search",
			input: { query: args.query }
		}),
		presentResult: (_args, result) => {
			if (result.isError) return void 0;
			const meta = memoryMetaFrom(result.meta);
			if (meta === void 0) return void 0;
			return {
				card: "generic",
				title: `记忆 · ${meta.hits.length} 条`
			};
		},
		async execute(args, exec) {
			const query = typeof args.query === "string" ? args.query.trim() : "";
			if (query === "") throw new Error("amadeus_recall: `query` is required");
			const limit = Math.min(Math.max(typeof args.limit === "number" ? Math.trunc(args.limit) : 5, 1), 20);
			const hits = await client.search(query, limit, exec.signal);
			return {
				text: summarizeHits(hits, query),
				context: buildMemoryContext(hits, query),
				hits,
				userId: client.userId
			};
		}
	});
}
function makeRememberTool(client) {
	return defineTool({
		name: "amadeus_remember",
		description: "Save one exchange to long-term memory so it can be recalled in later conversations. Use after a turn that revealed a durable fact about the user (preferences, plans, relationships). Skip small talk and secrets the user asked you not to keep.",
		parameters: {
			userText: {
				type: "string",
				required: true,
				description: "What the user said or revealed, quoted faithfully."
			},
			assistantText: {
				type: "string",
				required: true,
				description: "Your reply to that turn."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					text: {
						type: "string",
						required: true
					},
					userId: {
						type: "string",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: value.text
			}]
		},
		isConcurrencySafe: () => true,
		presentCall: () => ({
			card: "generic",
			title: "写入长期记忆",
			kind: "edit"
		}),
		async execute(args, exec) {
			const userText = typeof args.userText === "string" ? args.userText.trim() : "";
			const assistantText = typeof args.assistantText === "string" ? args.assistantText.trim() : "";
			if (userText === "") throw new Error("amadeus_remember: `userText` is required");
			if (assistantText === "") throw new Error("amadeus_remember: `assistantText` is required");
			await client.store({
				userText,
				assistantText
			}, exec.signal);
			return {
				text: "已写入长期记忆，下次会话可以检索到。",
				userId: client.userId
			};
		}
	});
}
export { makeRecallTool, makeRememberTool };
